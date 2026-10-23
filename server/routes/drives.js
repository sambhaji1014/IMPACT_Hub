/**
 * ImpactHub - Volunteer Drives API Router
 * Drive discovery, capacity validation, waitlist, digital passes with QR, .ics calendar, and certificates
 */

const express = require('express');
const crypto = require('crypto');
const { driveSchema, driveJoinSchema } = require('../validators');
const PDFGenerator = require('../pdfGenerator');

function createDrivesRouter(prisma, authManager, rewardsEngine) {
  const router = express.Router();

  // 1. List Volunteer Drives
  router.get('/', async (req, res) => {
    try {
      const { category, city, search, sort = 'urgent', status = 'ACTIVE' } = req.query;

      const where = {};
      if (status && status !== 'all') where.status = status.toUpperCase();
      if (category && category !== 'all') where.category = { equals: category };
      if (city && city !== 'all') where.city = { contains: city };

      if (search) {
        const q = String(search).trim();
        where.OR = [
          { title: { contains: q } },
          { description: { contains: q } },
          { city: { contains: q } },
          { address: { contains: q } },
          { requiredSkills: { contains: q } },
          { ngo: { orgName: { contains: q } } }
        ];
      }

      let orderBy = { startsAt: 'asc' };
      if (sort === 'urgent') orderBy = { startsAt: 'asc' };
      if (sort === 'popular') orderBy = { registeredCount: 'desc' };

      const drives = await prisma.drive.findMany({
        where,
        orderBy,
        include: {
          ngo: {
            select: {
              id: true,
              orgName: true,
              verificationStatus: true,
              logo: true,
              city: true
            }
          }
        }
      });

      const formatted = drives.map(d => {
        const slotsRemaining = Math.max(0, d.slots - d.registeredCount);
        const percentFilled = Math.min(100, Math.round((d.registeredCount / (d.slots || 1)) * 100));
        const isFull = slotsRemaining <= 0;

        return {
          id: d.id,
          ngoId: d.ngoId,
          ngoName: d.ngo?.orgName || 'Community NGO',
          ngoVerified: d.ngo?.verificationStatus === 'VERIFIED',
          title: d.title,
          category: d.category,
          city: d.city,
          location: `${d.city} (${d.address})`,
          address: d.address,
          date: new Date(d.startsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          time: `${new Date(d.startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(d.endsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
          duration: `${Math.max(1, Math.round((new Date(d.endsAt) - new Date(d.startsAt)) / 3600000))} hrs`,
          volunteersNeeded: d.slots,
          volunteersRegistered: d.registeredCount,
          slotsRemaining,
          percentFilled,
          isFull,
          skillLevel: d.requiredSkills || 'All Welcome',
          requirements: d.requiredSkills,
          description: d.description,
          image: d.image || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
          status: isFull ? 'full' : 'upcoming',
          isDemo: d.isDemo,
          createdAt: d.createdAt
        };
      });

      res.json({ success: true, opportunities: formatted, drives: formatted });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch volunteer drives', error: err.message });
    }
  });

  // 2. Get My Registered Drives (Volunteer session)
  router.get('/registrations/my', authManager.requireAuth(), async (req, res) => {
    try {
      const registrations = await prisma.driveRegistration.findMany({
        where: { volunteerId: req.user.id },
        include: {
          drive: {
            include: { ngo: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = registrations.map(r => ({
        id: r.id,
        opportunityId: r.driveId,
        driveId: r.driveId,
        opportunityTitle: r.drive?.title,
        title: r.drive?.title,
        ngoName: r.drive?.ngo?.orgName,
        date: new Date(r.drive?.startsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        location: r.drive?.address,
        status: r.status,
        passCode: r.passCode,
        hoursConfirmed: r.hoursConfirmed,
        qrCodeUrl: r.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r.passCode)}`,
        canDownloadCertificate: r.status === 'ATTENDED' && r.hoursConfirmed > 0
      }));

      res.json({ success: true, applications: formatted, registrations: formatted });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch registrations', error: err.message });
    }
  });

  // 3. Get Single Drive
  router.get('/:id', async (req, res) => {
    try {
      const drive = await prisma.drive.findUnique({
        where: { id: req.params.id },
        include: { ngo: true }
      });

      if (!drive) return res.status(404).json({ success: false, message: 'Volunteer drive not found' });

      res.json({ success: true, drive });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching drive', error: err.message });
    }
  });

  // 4. Create Volunteer Drive (NGO Only - requires verified email)
  router.post('/', authManager.requireRole(['ngo', 'admin']), authManager.requireVerifiedEmail(), async (req, res) => {
    try {
      const parsed = driveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      let ngoProfile = req.user.ngoProfile;
      if (!ngoProfile) {
        ngoProfile = await prisma.ngoProfile.findUnique({ where: { userId: req.user.id } });
      }

      if (!ngoProfile && !req.user.roles.includes('admin')) {
        return res.status(403).json({ success: false, message: 'No registered NGO profile found.' });
      }

      const ngoId = ngoProfile ? ngoProfile.id : (req.body.ngoId || 'ngo_green_earth');
      const { title, description, category, city, address, startsAt, endsAt, slots, requiredSkills, image } = parsed.data;

      const drive = await prisma.drive.create({
        data: {
          ngoId,
          title,
          description,
          category,
          city,
          address,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          slots: Number(slots),
          requiredSkills: requiredSkills || 'Open for all',
          image: image || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
          status: 'ACTIVE',
          isDemo: false
        },
        include: { ngo: true }
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'CREATE_DRIVE',
        entity: 'Drive',
        entityId: drive.id,
        details: { title, slots },
        req
      });

      res.status(201).json({ success: true, message: 'Volunteer drive scheduled successfully', drive, opportunity: drive });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to create drive', error: err.message });
    }
  });

  // 5. Join Volunteer Drive (Join Flow + Capacity Check + Digital Pass - requires signed-in, email-verified volunteer)
  router.post('/:id/join', authManager.requireAuth(), authManager.requireVerifiedEmail(), async (req, res) => {
    try {
      const drive = await prisma.drive.findUnique({
        where: { id: req.params.id },
        include: { ngo: true }
      });

      if (!drive) return res.status(404).json({ success: false, message: 'Volunteer drive not found.' });

      // Capacity check
      if (drive.registeredCount >= drive.slots) {
        return res.status(409).json({
          success: false,
          error: 'DriveFull',
          message: 'This volunteer drive has reached full volunteer capacity.'
        });
      }

      const parsed = driveJoinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { name, email, phone, skills, availability } = parsed.data;
      const volunteerId = req.user ? req.user.id : (await getOrCreateGuestVolunteer(prisma, { name, email, phone }));

      // Check duplicate registration
      const existing = await prisma.driveRegistration.findUnique({
        where: { driveId_volunteerId: { driveId: drive.id, volunteerId } }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'AlreadyRegistered',
          message: `You are already registered for "${drive.title}".`,
          registration: existing
        });
      }

      const passCode = `IH-PASS-${Date.now().toString().slice(-4)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(passCode)}`;

      const registration = await prisma.$transaction(async (tx) => {
        const reg = await tx.driveRegistration.create({
          data: {
            driveId: drive.id,
            volunteerId,
            status: 'CONFIRMED',
            passCode,
            volunteerName: name,
            volunteerEmail: email,
            volunteerPhone: phone,
            skillsShared: skills,
            qrCodeUrl
          }
        });

        await tx.drive.update({
          where: { id: drive.id },
          data: { registeredCount: { increment: 1 } }
        });

        return reg;
      });

      if (req.user) {
        await authManager.logAudit({
          userId: req.user.id,
          action: 'JOIN_DRIVE',
          entity: 'DriveRegistration',
          entityId: registration.id,
          details: { driveTitle: drive.title, passCode },
          req
        });
      }

      res.status(201).json({
        success: true,
        message: 'Spot confirmed! Your digital volunteer pass has been generated.',
        registration: {
          ...registration,
          opportunityId: drive.id,
          opportunityTitle: drive.title,
          ngoName: drive.ngo?.orgName
        }
      });
    } catch (err) {
      console.error('Join Drive Error:', err);
      res.status(500).json({ success: false, message: 'Failed to process registration', error: err.message });
    }
  });

  // 6. Cancel Registration
  router.delete('/registrations/:id', authManager.requireAuth(), async (req, res) => {
    try {
      const reg = await prisma.driveRegistration.findUnique({
        where: { id: req.params.id },
        include: { drive: true }
      });

      if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

      // Ownership check
      if (reg.volunteerId !== req.user.id && !req.user.roles.includes('admin')) {
        return res.status(403).json({ success: false, message: 'Unauthorized to cancel this registration.' });
      }

      await prisma.$transaction([
        prisma.driveRegistration.delete({ where: { id: req.params.id } }),
        prisma.drive.update({
          where: { id: reg.driveId },
          data: { registeredCount: { decrement: 1 } }
        })
      ]);

      await authManager.logAudit({
        userId: req.user.id,
        action: 'CANCEL_REGISTRATION',
        entity: 'DriveRegistration',
        entityId: req.params.id,
        req
      });

      res.json({ success: true, message: 'Registration has been cancelled successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to cancel registration', error: err.message });
    }
  });

  // 7. Add-to-Calendar (.ics file generation)
  router.get('/:id/calendar.ics', async (req, res) => {
    try {
      const drive = await prisma.drive.findUnique({
        where: { id: req.params.id },
        include: { ngo: true }
      });

      if (!drive) return res.status(404).send('Drive not found');

      const formatICSDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const start = formatICSDate(drive.startsAt);
      const end = formatICSDate(drive.endsAt);

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ImpactHub//Volunteer Mobilization Platform//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:impacthub-drive-${drive.id}@impacthub.org`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${drive.title} — ImpactHub`,
        `DESCRIPTION:${drive.description.replace(/\n/g, ' ')} | Organizer: ${drive.ngo?.orgName}`,
        `LOCATION:${drive.address}, ${drive.city}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="drive-${drive.id}.ics"`);
      res.send(ics);
    } catch (err) {
      res.status(500).send('Error generating calendar file');
    }
  });

  // 8. Download Verified Volunteer Certificate (PDF)
  router.get('/registrations/:id/certificate.pdf', async (req, res) => {
    try {
      const reg = await prisma.driveRegistration.findUnique({
        where: { id: req.params.id },
        include: {
          drive: { include: { ngo: true } },
          volunteer: true
        }
      });

      if (!reg) return res.status(404).json({ success: false, message: 'Volunteer pass not found' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Volunteer-Certificate-${reg.passCode}.pdf"`);
      PDFGenerator.generateVolunteerCertificate(reg, res);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to generate certificate' });
    }
  });

  // 9. Mark Attendance & Award Volunteer Rewards (NGO / Admin)
  const handleAttendance = async (req, res) => {
    try {
      const { status = 'ATTENDED', hours, hoursConfirmed } = req.body;
      const actualHours = Number(hours !== undefined ? hours : (hoursConfirmed !== undefined ? hoursConfirmed : 4));

      const reg = await prisma.driveRegistration.findUnique({
        where: { id: req.params.id },
        include: {
          drive: { include: { ngo: true } },
          volunteer: true
        }
      });

      if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

      // Ownership check: only organizing NGO or Admin
      let ngoProfile = req.user ? req.user.ngoProfile : null;
      if (!ngoProfile && req.user) {
        ngoProfile = await prisma.ngoProfile.findUnique({ where: { userId: req.user.id } });
      }

      const isOrganizer = req.user && (
        req.user.roles.includes('admin') ||
        (ngoProfile && ngoProfile.id === reg.drive.ngoId)
      );

      if (!isOrganizer) {
        return res.status(403).json({ success: false, message: 'Only the organizing NGO can mark attendance.' });
      }

      const updated = await prisma.driveRegistration.update({
        where: { id: req.params.id },
        data: {
          status,
          hoursConfirmed: status === 'ATTENDED' ? actualHours : 0
        }
      });

      let rewardResult = null;
      if (status === 'ATTENDED' && actualHours > 0) {
        rewardResult = await rewardsEngine.awardVolunteerHours({
          volunteerId: reg.volunteerId,
          registrationId: reg.id,
          hours: actualHours,
          ngoUserId: req.user.id
        });
      }

      await authManager.logAudit({
        userId: req.user.id,
        action: 'MARK_ATTENDANCE',
        entity: 'DriveRegistration',
        entityId: req.params.id,
        details: { status, hours: actualHours },
        req
      });

      res.json({
        success: true,
        message: `Attendance marked as ${status}.`,
        registration: updated,
        reward: rewardResult
      });
    } catch (err) {
      console.error('Mark Attendance Error:', err);
      res.status(500).json({ success: false, message: 'Failed to update attendance', error: err.message });
    }
  };

  router.post('/registrations/:id/attendance', authManager.requireRole(['ngo', 'admin']), handleAttendance);
  router.put('/registrations/:id/attendance', authManager.requireRole(['ngo', 'admin']), handleAttendance);

  return router;
}

async function getOrCreateGuestVolunteer(prisma, { name, email, phone }) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const bcrypt = require('bcryptjs');
    const pwd = await bcrypt.hash('guest12345', 10);
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: pwd,
        roles: JSON.stringify(['volunteer']),
        volunteerProfile: { create: { totalHours: 0, points: 0 } }
      }
    });
  }
  return user.id;
}

module.exports = createDrivesRouter;
