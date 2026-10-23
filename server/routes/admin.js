/**
 * ImpactHub - Admin API Router
 * Restricted strictly to verified accounts listed in ADMIN_EMAILS.
 * Provides NGO verification queue, password confirmation for sensitive actions,
 * user suspension/management, content moderation, and audit logs.
 */

const express = require('express');
const { ngoVerificationSchema, suspendUserSchema } = require('../validators');
const mailbox = require('../mailbox');

function createAdminRouter(prisma, authManager) {
  const router = express.Router();

  // Strict Admin authorization check on every request:
  // Must hold admin role AND email must be present in ADMIN_EMAILS allowlist AND email verified
  router.use(authManager.requireRole(['admin']));

  // 1. Admin Platform Overview & Telemetry
  router.get('/overview', async (req, res) => {
    try {
      const [
        totalUsers,
        volunteersCount,
        donorsCount,
        ngosCount,
        adminsCount,
        verifiedNgos,
        pendingNgos,
        rejectedNgos,
        campaignsCount,
        drivesCount,
        donationsSum,
        donationsCount,
        volunteerHoursSum,
        pendingReports,
        totalAuditLogs
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'volunteer' } }),
        prisma.user.count({ where: { role: 'donor' } }),
        prisma.user.count({ where: { role: 'ngo' } }),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.ngoProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
        prisma.ngoProfile.count({ where: { verificationStatus: 'PENDING' } }),
        prisma.ngoProfile.count({ where: { verificationStatus: 'REJECTED' } }),
        prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        prisma.drive.count({ where: { status: 'ACTIVE' } }),
        prisma.donation.aggregate({
          where: { status: 'SUCCEEDED' },
          _sum: { amount: true }
        }),
        prisma.donation.count({ where: { status: 'SUCCEEDED' } }),
        prisma.volunteerProfile.aggregate({
          _sum: { totalHours: true }
        }),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.auditLog.count()
      ]);

      res.json({
        success: true,
        metrics: {
          totalUsers,
          volunteersCount,
          donorsCount,
          ngosCount,
          adminsCount,
          totalNgos: verifiedNgos + pendingNgos + rejectedNgos,
          verifiedNgos,
          pendingNgos,
          rejectedNgos,
          activeCampaigns: campaignsCount,
          activeDrives: drivesCount,
          totalDonated: donationsSum._sum.amount || 0,
          totalDonationsCount: donationsCount,
          totalVolunteerHours: volunteerHoursSum._sum.totalHours || 0,
          pendingReports,
          totalAuditLogs
        }
      });
    } catch (err) {
      console.error('Admin Overview Error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate overview metrics.' });
    }
  });

  // 2. List NGOs for Verification Queue
  router.get('/ngos', async (req, res) => {
    try {
      const { status } = req.query;
      const where = status ? { verificationStatus: status } : {};

      const ngos = await prisma.ngoProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true, isSuspended: true } },
          _count: { select: { campaigns: true, drives: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, ngos });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to retrieve NGOs', error: err.message });
    }
  });

  // 3. Approve or Reject NGO Verification (Sensitive: supports admin password confirmation)
  const handleNgoVerification = async (req, res) => {
    try {
      const parsed = ngoVerificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { status, rejectionReason, adminPassword } = parsed.data;

      // Sensitive action password verification if supplied
      if (adminPassword) {
        const isMatch = await authManager.verifyPassword(adminPassword, req.user.passwordHash);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            error: 'InvalidAdminPassword',
            message: 'Administrative password confirmation failed.'
          });
        }
      }

      const ngo = await prisma.ngoProfile.findUnique({
        where: { id: req.params.id },
        include: { user: true }
      });

      if (!ngo) return res.status(404).json({ success: false, message: 'NGO record not found.' });

      const updated = await prisma.ngoProfile.update({
        where: { id: req.params.id },
        data: {
          verificationStatus: status,
          verifiedAt: status === 'VERIFIED' ? new Date() : null,
          rejectionReason: status === 'REJECTED' ? rejectionReason : null
        }
      });

      // If approved, any draft campaigns/drives can now be published
      if (status === 'VERIFIED') {
        await prisma.campaign.updateMany({
          where: { ngoId: ngo.id, status: 'DRAFT' },
          data: { status: 'ACTIVE' }
        });
      }

      // Create notification
      await prisma.notification.create({
        data: {
          userId: ngo.userId,
          title: status === 'VERIFIED' ? 'NGO Verification Approved! 🎉' : 'NGO Verification Status Update',
          message: status === 'VERIFIED'
            ? `Your organization "${ngo.orgName}" has been officially verified! You may now publish live crowdfunding campaigns and volunteer drives.`
            : `Your verification request was reviewed. Reason: ${rejectionReason || 'Additional documentation required.'}`,
          type: status === 'VERIFIED' ? 'SUCCESS' : 'WARNING'
        }
      });

      // Dispatch email notification to the NGO
      if (ngo.user && ngo.user.email) {
        await mailbox.sendMail({
          to: ngo.user.email,
          subject: status === 'VERIFIED' ? 'ImpactHub NGO Verification Approved' : 'ImpactHub NGO Verification Update',
          html: `
            <div style="font-family:sans-serif; padding:20px;">
              <h2>Verification Decision: ${status}</h2>
              <p>Hello ${ngo.user.name},</p>
              <p>Your organization <strong>${ngo.orgName}</strong> was reviewed by platform administration.</p>
              <p><strong>Status:</strong> ${status}</p>
              ${status === 'REJECTED' && rejectionReason ? `<p><strong>Feedback:</strong> ${rejectionReason}</p>` : ''}
              ${status === 'VERIFIED' ? '<p>You may now publish campaigns and volunteer drives directly from your dashboard.</p>' : ''}
            </div>
          `
        });
      }

      await authManager.logAudit({
        userId: req.user.id,
        action: status === 'VERIFIED' ? 'VERIFY_NGO' : 'REJECT_NGO',
        entity: 'NgoProfile',
        entityId: ngo.id,
        details: { orgName: ngo.orgName, status, rejectionReason },
        req
      });

      res.json({
        success: true,
        message: `NGO "${ngo.orgName}" has been marked as ${status}.`,
        ngo: updated
      });
    } catch (err) {
      console.error('NGO Verification Error:', err);
      res.status(500).json({ success: false, message: 'Verification update failed', error: err.message });
    }
  };

  router.put('/ngos/:id/verify', handleNgoVerification);
  router.post('/ngos/:id/verify', handleNgoVerification);

  // 4. User Management: Search & List
  router.get('/users', async (req, res) => {
    try {
      const { search, role } = req.query;
      const where = {};

      if (role && role !== 'all') where.role = role;
      if (search) {
        const q = String(search).trim();
        where.OR = [
          { name: { contains: q } },
          { email: { contains: q } },
          { city: { contains: q } }
        ];
      }

      const users = await prisma.user.findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          city: true,
          isSuspended: true,
          suspensionReason: true,
          emailVerifiedAt: true,
          createdAt: true,
          volunteerProfile: { select: { totalHours: true, points: true, level: true } },
          donorProfile: { select: { totalDonated: true, points: true, tier: true } },
          ngoProfile: { select: { orgName: true, verificationStatus: true } }
        }
      });

      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to retrieve users' });
    }
  });

  // 5. Suspend or Restore User (Sensitive action: supports admin password confirmation)
  router.post('/users/:id/suspend', async (req, res) => {
    try {
      const { isSuspended, reason, adminPassword } = req.body;

      if (adminPassword) {
        const isMatch = await authManager.verifyPassword(adminPassword, req.user.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Administrative password confirmation failed.' });
        }
      }

      // Cannot suspend self
      if (req.params.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Administrators cannot suspend their own account.' });
      }

      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          isSuspended: !!isSuspended,
          suspensionReason: isSuspended ? (reason || 'Administrative action') : null
        }
      });

      // If suspending, revoke all active sessions immediately
      if (isSuspended) {
        await authManager.revokeAllUserRefreshTokens(target.id);
      }

      await authManager.logAudit({
        userId: req.user.id,
        action: isSuspended ? 'SUSPEND_USER' : 'RESTORE_USER',
        entity: 'User',
        entityId: target.id,
        details: { targetEmail: target.email, isSuspended, reason },
        req
      });

      res.json({
        success: true,
        message: `User ${target.email} has been ${isSuspended ? 'suspended' : 'restored'}.`,
        user: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update user suspension status.' });
    }
  });

  // 6. View Audit Logs (Server-Side Pagination, Filtering, Search & CSV Export)
  router.get('/audit-logs', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
      const skip = (page - 1) * limit;

      const { search, action, userId, startDate, endDate, format } = req.query;
      const where = {};

      if (action && action !== 'ALL') {
        where.action = action;
      }

      if (userId) {
        where.userId = userId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { action: { contains: q } },
          { entity: { contains: q } },
          { details: { contains: q } },
          { ipAddress: { contains: q } },
          { user: { name: { contains: q } } },
          { user: { email: { contains: q } } }
        ];
      }

      // If format === 'csv', export full matching result set (up to 2000 records)
      if (format === 'csv') {
        const exportLogs = await prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 2000,
          include: {
            user: { select: { name: true, email: true, role: true } }
          }
        });

        const headers = ['Timestamp', 'Action', 'Actor Name', 'Actor Email', 'Actor Role', 'Entity', 'Entity ID', 'IP Address', 'Details'];
        const csvRows = exportLogs.map(l => [
          new Date(l.createdAt).toISOString(),
          l.action || '',
          l.user?.name || 'System / Guest',
          l.user?.email || 'N/A',
          l.user?.role || 'SYSTEM',
          l.entity || '',
          l.entityId || '',
          l.ipAddress || '127.0.0.1',
          (typeof l.details === 'string' ? l.details : JSON.stringify(l.details || '')).replace(/"/g, '""')
        ]);

        const csvContent = [
          headers.join(','),
          ...csvRows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="impacthub_audit_logs_${Date.now()}.csv"`);
        return res.send(csvContent);
      }

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } }
          }
        })
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      res.json({
        success: true,
        logs,
        auditLogs: logs,
        total,
        page,
        totalPages,
        limit
      });
    } catch (err) {
      console.error('Audit Logs Error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve audit logs: ' + err.message });
    }
  });

  // 7. Admin Unified Leaderboard (Volunteers, Donors, NGOs)
  router.get('/leaderboard', async (req, res) => {
    try {
      const [volunteers, donors, ngos] = await Promise.all([
        prisma.volunteerProfile.findMany({
          where: { optOutLeaderboard: false },
          orderBy: [{ points: 'desc' }, { totalHours: 'desc' }],
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true, city: true, avatar: true } }
          }
        }),
        prisma.donorProfile.findMany({
          where: { optOutLeaderboard: false },
          orderBy: [{ points: 'desc' }, { totalDonated: 'desc' }],
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true, city: true, avatar: true } }
          }
        }),
        prisma.ngoProfile.findMany({
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true, city: true } },
            _count: { select: { campaigns: true, drives: true } }
          }
        })
      ]);

      const rankedNgos = ngos.map(n => ({
        id: n.id,
        name: n.orgName,
        email: n.user?.email || 'N/A',
        city: n.city || n.user?.city || 'India',
        cause: n.cause || 'Social Impact',
        verificationStatus: n.verificationStatus,
        campaignsCount: n._count.campaigns,
        drivesCount: n._count.drives,
        impactScore: (n._count.campaigns * 150) + (n._count.drives * 200) + (n.verificationStatus === 'VERIFIED' ? 500 : 0)
      })).sort((a, b) => b.impactScore - a.impactScore);

      res.json({
        success: true,
        volunteers: volunteers.map((v, i) => ({
          rank: i + 1,
          id: v.user?.id,
          name: v.user?.name || 'Volunteer',
          email: v.user?.email,
          city: v.user?.city || 'India',
          hours: v.totalHours || 0,
          points: v.points || 0,
          level: v.level || 'Bronze'
        })),
        donors: donors.map((d, i) => ({
          rank: i + 1,
          id: d.user?.id,
          name: d.user?.name || 'Philanthropist',
          email: d.user?.email,
          city: d.user?.city || 'India',
          totalDonated: d.totalDonated || 0,
          points: d.points || 0,
          tier: d.tier || 'Supporter'
        })),
        ngos: rankedNgos.map((n, i) => ({
          rank: i + 1,
          ...n
        }))
      });
    } catch (err) {
      console.error('Admin Leaderboard Error:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve admin leaderboard', error: err.message });
    }
  });

  // 8. User Role Modification
  router.post('/users/:id/role', async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ['volunteer', 'donor', 'ngo', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role specified.' });
      }

      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

      // If promoting to admin, verify email is in allowlist
      if (role === 'admin' && !authManager.isAdminEmail(target.email)) {
        return res.status(403).json({
          success: false,
          message: 'Cannot assign ADMIN role: user email is not present in ADMIN_EMAILS allowlist.'
        });
      }

      const previousRole = target.role;
      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { role, roles: JSON.stringify([role]) }
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'ROLE_CHANGED',
        entity: 'User',
        entityId: target.id,
        details: { previousRole, newRole: role, targetEmail: target.email },
        req
      });

      res.json({
        success: true,
        message: `User ${target.email} role updated from ${previousRole} to ${role}.`,
        user: updated
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update user role: ' + err.message });
    }
  });

  // 7. Moderation Reports Queue
  router.get('/reports', async (req, res) => {
    try {
      const reports = await prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, name: true, email: true } }
        }
      });

      res.json({ success: true, reports });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
  });

  // 8. Action or Dismiss Report
  router.post('/reports/:id/action', async (req, res) => {
    try {
      const { status = 'ACTIONED', actionTaken } = req.body;

      const report = await prisma.report.update({
        where: { id: req.params.id },
        data: {
          status,
          actionTaken: actionTaken || 'Reviewed and resolved by administrator.'
        }
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'RESOLVE_REPORT',
        entity: 'Report',
        entityId: req.params.id,
        details: { status, actionTaken },
        req
      });

      res.json({ success: true, message: `Report marked as ${status}.`, report });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to action report.' });
    }
  });

  return router;
}

module.exports = createAdminRouter;
