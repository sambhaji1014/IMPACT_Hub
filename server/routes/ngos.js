/**
 * ImpactHub - NGO API Router
 * Directory, public NGO profile, attendance & hours confirmation, and CSV participant export
 */

const express = require('express');
const { markAttendanceSchema } = require('../validators');

function createNgosRouter(prisma, authManager, rewardsEngine) {
  const router = express.Router();

  // 1. List NGOs
  router.get('/', async (req, res) => {
    try {
      const { category, search, verifiedOnly } = req.query;

      const where = {};
      if (category && category !== 'all') where.cause = category;
      if (verifiedOnly === 'true') where.verificationStatus = 'VERIFIED';

      if (search) {
        const q = String(search).trim();
        where.OR = [
          { orgName: { contains: q } },
          { description: { contains: q } },
          { city: { contains: q } },
          { cause: { contains: q } }
        ];
      }

      const ngos = await prisma.ngoProfile.findMany({
        where,
        orderBy: { orgName: 'asc' },
        include: {
          _count: {
            select: { campaigns: true, drives: true }
          }
        }
      });

      const formatted = ngos.map(n => ({
        id: n.id,
        name: n.orgName,
        orgName: n.orgName,
        category: n.cause,
        cause: n.cause,
        location: n.city ? `${n.city}, India` : 'India',
        city: n.city,
        description: n.description,
        logo: n.logo || 'assets/images/fallback-logo.svg',
        banner: n.banner || 'assets/images/fallback-banner.svg',
        website: n.website || 'https://impacthub.org/ngos',
        verified: n.verificationStatus === 'VERIFIED',
        verificationStatus: n.verificationStatus,
        registrationNumber: n.registrationNumber,
        activeCampaignsCount: n._count.campaigns,
        volunteersCount: 45 + n._count.drives * 12,
        rating: 4.9
      }));

      res.json({ success: true, ngos: formatted });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch NGOs', error: err.message });
    }
  });

  // 2. Get Public NGO Profile
  router.get('/:id', async (req, res) => {
    try {
      const ngo = await prisma.ngoProfile.findUnique({
        where: { id: req.params.id },
        include: {
          campaigns: { where: { status: 'ACTIVE' } },
          drives: { where: { status: 'ACTIVE' } },
          user: { select: { name: true, city: true } }
        }
      });

      if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });

      res.json({
        success: true,
        ngo: {
          ...ngo,
          name: ngo.orgName,
          verified: ngo.verificationStatus === 'VERIFIED',
          activeCampaigns: ngo.campaigns,
          activeDrives: ngo.drives
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error retrieving NGO profile', error: err.message });
    }
  });

  // 3. NGO Attendance & Hours Confirmation (Triggers Volunteer Rewards)
  router.put('/registrations/:id/attendance', authManager.requireRole(['ngo', 'admin']), async (req, res) => {
    try {
      const parsed = markAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { status, hoursConfirmed } = parsed.data;

      const reg = await prisma.driveRegistration.findUnique({
        where: { id: req.params.id },
        include: {
          drive: { include: { ngo: true } },
          volunteer: true
        }
      });

      if (!reg) return res.status(404).json({ success: false, message: 'Registration record not found' });

      // Ownership check: logged-in NGO must own this drive (or be admin)
      const isOwner = reg.drive.ngo?.userId === req.user.id;
      const isAdmin = req.user.roles.includes('admin');
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'You can only update attendance for drives organized by your NGO.' });
      }

      // Update registration
      const updatedReg = await prisma.driveRegistration.update({
        where: { id: req.params.id },
        data: {
          status,
          hoursConfirmed: status === 'ATTENDED' ? Number(hoursConfirmed) : 0
        }
      });

      // Award or reverse rewards
      let rewardResult = null;
      if (status === 'ATTENDED') {
        rewardResult = await rewardsEngine.awardVolunteerHours({
          volunteerId: reg.volunteerId,
          registrationId: reg.id,
          hours: Number(hoursConfirmed),
          ngoUserId: req.user.id
        });
      } else if (reg.status === 'ATTENDED' && status !== 'ATTENDED') {
        // Attendance was corrected to NO_SHOW or CANCELLED: reverse rewards!
        await rewardsEngine.reverseRewardEvent({
          refId: reg.id,
          reason: `Attendance corrected to ${status} by NGO coordinator.`
        });
      }

      await authManager.logAudit({
        userId: req.user.id,
        action: 'MARK_ATTENDANCE',
        entity: 'DriveRegistration',
        entityId: reg.id,
        details: { status, hoursConfirmed, volunteerEmail: reg.volunteerEmail },
        req
      });

      res.json({
        success: true,
        message: `Attendance marked as ${status}. ${status === 'ATTENDED' ? `Volunteer awarded points for ${hoursConfirmed} verified hours!` : ''}`,
        registration: updatedReg,
        reward: rewardResult
      });
    } catch (err) {
      console.error('Mark Attendance Error:', err);
      res.status(500).json({ success: false, message: 'Failed to update attendance', error: err.message });
    }
  });

  // 4. Export Participants CSV
  router.get('/drives/:driveId/export.csv', authManager.requireRole(['ngo', 'admin']), async (req, res) => {
    try {
      const drive = await prisma.drive.findUnique({
        where: { id: req.params.driveId },
        include: {
          ngo: true,
          registrations: true
        }
      });

      if (!drive) return res.status(404).send('Drive not found');

      const isOwner = drive.ngo?.userId === req.user.id || req.user.roles.includes('admin');
      if (!isOwner) return res.status(403).send('Unauthorized to export this drive roster');

      const headers = ['Registration ID', 'Volunteer Name', 'Email', 'Phone', 'Pass Code', 'Status', 'Confirmed Hours', 'Registered Date'];
      const rows = drive.registrations.map(r => [
        r.id,
        `"${(r.volunteerName || '').replace(/"/g, '""')}"`,
        r.volunteerEmail || '',
        r.volunteerPhone || '',
        r.passCode,
        r.status,
        r.hoursConfirmed,
        new Date(r.createdAt).toISOString()
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="roster-drive-${drive.id}.csv"`);
      res.send(csvContent);
    } catch (err) {
      res.status(500).send('Error generating CSV');
    }
  });

  return router;
}

module.exports = createNgosRouter;
