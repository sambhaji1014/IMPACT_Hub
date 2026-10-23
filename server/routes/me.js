/**
 * ImpactHub - User Self-Service & Account Data Router (/api/v1/me)
 * Provides strictly authenticated, per-account data for Volunteer, Donor, and NGO dashboards,
 * along with profile management, data export, and GDPR/privacy compliant account deletion.
 */

const express = require('express');
const crypto = require('crypto');
const {
  profileUpdateSchema,
  changePasswordSchema,
  changeEmailSchema
} = require('../validators');
const mailbox = require('../mailbox');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

function createMeRouter(prisma, authManager, rewardsEngine) {
  const router = express.Router();

  // All routes require active authentication
  router.use(authManager.requireAuth());

  // 1. Get Base Current User
  router.get('/', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          ngoProfile: true,
          volunteerProfile: true,
          donorProfile: true,
          _count: {
            select: {
              notifications: { where: { read: false } }
            }
          }
        }
      });

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          city: user.city,
          bio: user.bio,
          emailVerified: !!user.emailVerifiedAt,
          emailVerifiedAt: user.emailVerifiedAt,
          unreadNotifications: user._count.notifications,
          savedCampaigns: JSON.parse(user.savedCampaigns || '[]'),
          ngoProfile: user.ngoProfile,
          volunteerProfile: user.volunteerProfile,
          donorProfile: user.donorProfile
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch user', error: err.message });
    }
  });

  // 2. Volunteer Dashboard Data (Restricted to Volunteer / Admin)
  router.get('/volunteer', authManager.requireRole(['volunteer', 'admin']), async (req, res) => {
    try {
      const volunteerProfile = await prisma.volunteerProfile.findUnique({
        where: { userId: req.user.id }
      });

      // Fetch own applications/registrations with drive details
      const registrations = await prisma.driveRegistration.findMany({
        where: { volunteerId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          drive: {
            include: {
              ngo: {
                select: { id: true, orgName: true, verificationStatus: true, city: true }
              }
            }
          }
        }
      });

      // Fetch earned badges
      const userBadges = await prisma.userBadge.findMany({
        where: { userId: req.user.id },
        include: { badge: true }
      });

      // Fetch points history
      const rewardEvents = await prisma.rewardEvent.findMany({
        where: { userId: req.user.id, isReversed: false },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      res.json({
        success: true,
        profile: volunteerProfile || { totalHours: 0, points: 0, level: 'Bronze' },
        registrations,
        badges: userBadges.map(ub => ub.badge),
        rewardEvents
      });
    } catch (err) {
      console.error('Fetch Volunteer Data Error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch volunteer data', error: err.message });
    }
  });

  // 3. Donor Dashboard Data (Restricted to Donor / Admin)
  router.get('/donor', authManager.requireRole(['donor', 'admin']), async (req, res) => {
    try {
      const donorProfile = await prisma.donorProfile.findUnique({
        where: { userId: req.user.id }
      });

      // Fetch own donations with campaign details
      const donations = await prisma.donation.findMany({
        where: { donorId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: {
            include: {
              ngo: {
                select: { id: true, orgName: true, verificationStatus: true, website: true }
              }
            }
          }
        }
      });

      // Fetch saved campaigns
      let savedIds = [];
      try {
        savedIds = JSON.parse(req.user.savedCampaigns || '[]');
      } catch (e) {
        savedIds = [];
      }

      const savedCampaigns = savedIds.length > 0
        ? await prisma.campaign.findMany({
            where: { id: { in: savedIds } },
            include: { ngo: true }
          })
        : [];

      // Fetch earned badges
      const userBadges = await prisma.userBadge.findMany({
        where: { userId: req.user.id },
        include: { badge: true }
      });

      res.json({
        success: true,
        profile: donorProfile || { totalDonated: 0, points: 0, tier: 'Supporter' },
        donations,
        savedCampaigns,
        badges: userBadges.map(ub => ub.badge)
      });
    } catch (err) {
      console.error('Fetch Donor Data Error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch donor data', error: err.message });
    }
  });

  // 4. NGO Dashboard Data (Restricted to NGO / Admin)
  router.get('/ngo', authManager.requireRole(['ngo', 'admin']), async (req, res) => {
    try {
      let ngoProfile = await prisma.ngoProfile.findUnique({
        where: { userId: req.user.id }
      });

      if (!ngoProfile) {
        return res.status(404).json({ success: false, message: 'No registered NGO profile for this account.' });
      }

      // Fetch campaigns created by this NGO
      const campaigns = await prisma.campaign.findMany({
        where: { ngoId: ngoProfile.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { donations: true } }
        }
      });

      // Fetch volunteer drives created by this NGO
      const drives = await prisma.drive.findMany({
        where: { ngoId: ngoProfile.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { registrations: true } }
        }
      });

      // Fetch all participants across NGO's drives for attendance roster
      const driveIds = drives.map(d => d.id);
      const participants = await prisma.driveRegistration.findMany({
        where: { driveId: { in: driveIds } },
        orderBy: { createdAt: 'desc' },
        include: {
          drive: { select: { id: true, title: true, startsAt: true, city: true } },
          volunteer: { select: { id: true, name: true, email: true, city: true } }
        }
      });

      // Compute statistics
      const totalRaised = campaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
      const totalHoursConfirmed = participants
        .filter(p => p.status === 'ATTENDED')
        .reduce((sum, p) => sum + (p.hoursConfirmed || 0), 0);

      res.json({
        success: true,
        ngo: ngoProfile,
        campaigns,
        drives,
        participants,
        metrics: {
          totalRaised,
          totalCampaigns: campaigns.length,
          totalDrives: drives.length,
          totalVolunteersRegistered: participants.length,
          totalHoursConfirmed
        }
      });
    } catch (err) {
      console.error('Fetch NGO Data Error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch NGO data', error: err.message });
    }
  });

  // 5. Update Profile
  router.put('/profile', async (req, res) => {
    try {
      const parsed = profileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { name, city, bio, phone, skills, interests, availability, optOutLeaderboard } = parsed.data;

      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: req.user.id },
          data: {
            name: name || undefined,
            city: city || undefined,
            bio: bio || undefined
          }
        });

        // Update Volunteer Profile if applicable
        if (req.user.role === 'volunteer') {
          await tx.volunteerProfile.upsert({
            where: { userId: req.user.id },
            update: {
              skills: skills || undefined,
              interests: interests || undefined,
              availability: availability || undefined,
              optOutLeaderboard: optOutLeaderboard !== undefined ? optOutLeaderboard : undefined
            },
            create: {
              userId: req.user.id,
              skills: skills || 'Community Mobilization',
              interests: interests || 'Environment',
              availability: availability || 'Weekends',
              optOutLeaderboard: !!optOutLeaderboard
            }
          });
        }

        // Update Donor Profile if applicable
        if (req.user.role === 'donor') {
          await tx.donorProfile.upsert({
            where: { userId: req.user.id },
            update: {
              optOutLeaderboard: optOutLeaderboard !== undefined ? optOutLeaderboard : undefined
            },
            create: {
              userId: req.user.id,
              optOutLeaderboard: !!optOutLeaderboard
            }
          });
        }

        return u;
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'UPDATE_PROFILE',
        entity: 'User',
        entityId: req.user.id,
        req
      });

      res.json({
        success: true,
        message: 'Profile updated successfully.',
        user: updatedUser
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update profile', error: err.message });
    }
  });

  // 6. Change Password
  router.post('/change-password', async (req, res) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid password input.'
        });
      }

      const { currentPassword, newPassword } = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const isMatch = await authManager.verifyPassword(currentPassword, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      const newHash = await authManager.hashPassword(newPassword);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: newHash }
      });

      // Revoke all other refresh tokens for security
      await authManager.revokeAllUserRefreshTokens(req.user.id);

      await authManager.logAudit({
        userId: req.user.id,
        action: 'PASSWORD_CHANGED',
        entity: 'User',
        entityId: req.user.id,
        req
      });

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
  });

  // 7. Change Email (Requires verification of new email)
  router.post('/change-email', async (req, res) => {
    try {
      const parsed = changeEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Valid new email and password required.' });
      }

      const { password, newEmail } = parsed.data;
      const normalizedNewEmail = newEmail.trim().toLowerCase();

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const isMatch = await authManager.verifyPassword(password, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Password confirmation failed.' });
      }

      // Check if new email is already taken
      const existing = await prisma.user.findFirst({
        where: { email: { equals: normalizedNewEmail }, id: { not: req.user.id } }
      });

      if (existing) {
        return res.status(409).json({ success: false, message: 'That email address is already in use.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          email: normalizedNewEmail,
          emailVerifiedAt: null, // Reset verification
          emailVerificationToken: token,
          emailVerificationExpires: expires
        }
      });

      const verifyLink = `${BASE_URL}/api/v1/auth/verify-email?token=${token}`;
      await mailbox.sendMail({
        to: normalizedNewEmail,
        subject: 'Verify Your New Email Address',
        html: `
          <div style="font-family:sans-serif; padding:20px;">
            <h2>Email Address Change Confirmation</h2>
            <p>Your email address was updated on ImpactHub. Please confirm ownership by clicking below:</p>
            <p><a href="${verifyLink}" style="background:#059669;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Verify Email</a></p>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'Email updated. A verification link has been sent to your new email address.'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update email address.' });
    }
  });

  // 8. Log Out All Devices
  router.post('/sessions/logout-all', async (req, res) => {
    try {
      await authManager.revokeAllUserRefreshTokens(req.user.id);
      authManager.clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out of all sessions successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to invalidate sessions.' });
    }
  });

  // 9. Export User Data (GDPR / Privacy Data Portability)
  router.get('/export-data', async (req, res) => {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          ngoProfile: true,
          volunteerProfile: true,
          donorProfile: true,
          registrations: { include: { drive: true } },
          donations: { include: { campaign: true } },
          rewardEvents: true,
          userBadges: { include: { badge: true } },
          auditLogs: { take: 50, orderBy: { createdAt: 'desc' } }
        }
      });

      delete userData.passwordHash;
      delete userData.emailVerificationToken;
      delete userData.passwordResetToken;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="impacthub-user-data-${req.user.id}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        platform: 'ImpactHub',
        data: userData
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to export data.' });
    }
  });

  // 10. Delete Account (Permanently remove account with password confirmation; anonymize financial records)
  router.post('/delete-account', async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, message: 'Password confirmation required to delete account.' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const isMatch = await authManager.verifyPassword(password, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid password.' });
      }

      // Anonymize financial donation records (required for legal Section 80G tax audit trails)
      await prisma.donation.updateMany({
        where: { donorId: req.user.id },
        data: {
          donorId: null,
          donorName: 'Former ImpactHub Member (Anonymized)',
          donorEmail: 'anonymized@impacthub.internal',
          donorPhone: null
        }
      });

      // Anonymize audit logs
      await prisma.auditLog.updateMany({
        where: { userId: req.user.id },
        data: { userId: null }
      });

      // Delete user cascades to profiles, registrations, tokens, badges
      await prisma.user.delete({ where: { id: req.user.id } });

      authManager.clearAuthCookies(res);

      res.json({ success: true, message: 'Your ImpactHub account has been permanently deleted.' });
    } catch (err) {
      console.error('Delete Account Error:', err);
      res.status(500).json({ success: false, message: 'Failed to delete account.', error: err.message });
    }
  });

  // 11. Save/Bookmark Campaign
  router.post('/campaigns/save/:id', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      let saved = [];
      try { saved = JSON.parse(user.savedCampaigns || '[]'); } catch (e) { saved = []; }

      if (!saved.includes(req.params.id)) {
        saved.push(req.params.id);
        await prisma.user.update({
          where: { id: req.user.id },
          data: { savedCampaigns: JSON.stringify(saved) }
        });
      }

      res.json({ success: true, savedCampaigns: saved });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to save campaign.' });
    }
  });

  return router;
}

module.exports = createMeRouter;
