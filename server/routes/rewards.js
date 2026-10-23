/**
 * ImpactHub - Rewards API Router
 * Returns personal gamification metrics, badge gallery, and public leaderboard
 */

const express = require('express');
const rewardsConfig = require('../../rewards.config');

function createRewardsRouter(prisma, authManager) {
  const router = express.Router();

  // 1. Get My Rewards Summary & Badges
  router.get('/me', authManager.requireAuth(), async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          volunteerProfile: true,
          donorProfile: true,
          userBadges: {
            include: { badge: true }
          },
          rewardEvents: {
            where: { isReversed: false },
            orderBy: { createdAt: 'desc' },
            take: 15
          }
        }
      });

      const allBadges = await prisma.badge.findMany();
      const unlockedBadgeIds = new Set(user.userBadges.map(ub => ub.badgeId));

      const badgesGallery = allBadges.map(b => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        criteria: b.criteria,
        unlocked: unlockedBadgeIds.has(b.id),
        unlockedAt: user.userBadges.find(ub => ub.badgeId === b.id)?.unlockedAt || null
      }));

      // Volunteer Level Progress
      const volHours = user.volunteerProfile?.totalHours || 0;
      const volLevels = rewardsConfig.volunteers.levels;
      let currentVolLevel = volLevels[0];
      let nextVolLevel = volLevels[1];

      for (let i = 0; i < volLevels.length; i++) {
        if (volHours >= volLevels[i].minHours) {
          currentVolLevel = volLevels[i];
          nextVolLevel = volLevels[i + 1] || null;
        }
      }

      const volLevelProgress = nextVolLevel ? Math.min(100, Math.round(((volHours - currentVolLevel.minHours) / (nextVolLevel.minHours - currentVolLevel.minHours)) * 100)) : 100;

      // Donor Tier Progress
      const donorAmount = user.donorProfile?.totalDonated || 0;
      const donorTiers = rewardsConfig.donors.tiers;
      let currentDonorTier = donorTiers[0];
      let nextDonorTier = donorTiers[1];

      for (let i = 0; i < donorTiers.length; i++) {
        if (donorAmount >= donorTiers[i].minAmount) {
          currentDonorTier = donorTiers[i];
          nextDonorTier = donorTiers[i + 1] || null;
        }
      }

      const donorTierProgress = nextDonorTier ? Math.min(100, Math.round(((donorAmount - currentDonorTier.minAmount) / (nextDonorTier.minAmount - currentDonorTier.minAmount)) * 100)) : 100;

      res.json({
        success: true,
        volunteer: {
          points: user.volunteerProfile?.points || 0,
          totalHours: volHours,
          level: currentVolLevel.name,
          levelIcon: currentVolLevel.icon,
          nextLevel: nextVolLevel?.name || 'Max Rank',
          hoursToNextLevel: nextVolLevel ? Math.max(0, nextVolLevel.minHours - volHours) : 0,
          progressPercent: volLevelProgress,
          optOutLeaderboard: user.volunteerProfile?.optOutLeaderboard || false
        },
        donor: {
          points: user.donorProfile?.points || 0,
          totalDonated: donorAmount,
          tier: currentDonorTier.name,
          tierIcon: currentDonorTier.icon,
          nextTier: nextDonorTier?.name || 'Max Tier',
          amountToNextTier: nextDonorTier ? Math.max(0, nextDonorTier.minAmount - donorAmount) : 0,
          progressPercent: donorTierProgress,
          optOutLeaderboard: user.donorProfile?.optOutLeaderboard || false
        },
        badges: badgesGallery,
        recentActivity: user.rewardEvents
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to retrieve rewards', error: err.message });
    }
  });

  // 2. Public Leaderboard
  router.get('/leaderboard', async (req, res) => {
    try {
      const topVolunteers = await prisma.volunteerProfile.findMany({
        where: {
          optOutLeaderboard: false,
          points: { gt: 0 }
        },
        orderBy: [{ points: 'desc' }, { totalHours: 'desc' }],
        take: 10,
        include: {
          user: { select: { id: true, name: true, city: true, avatar: true } }
        }
      });

      const topDonors = await prisma.donorProfile.findMany({
        where: {
          optOutLeaderboard: false,
          points: { gt: 0 }
        },
        orderBy: [{ points: 'desc' }, { totalDonated: 'desc' }],
        take: 10,
        include: {
          user: { select: { id: true, name: true, city: true, avatar: true } }
        }
      });

      const volunteers = topVolunteers.map((v, idx) => ({
        rank: idx + 1,
        name: v.user.name,
        city: v.user.city || 'India',
        avatar: v.user.avatar,
        points: v.points,
        hours: v.totalHours,
        level: v.level
      }));

      const donors = topDonors.map((d, idx) => ({
        rank: idx + 1,
        name: d.user.name,
        city: d.user.city || 'India',
        avatar: d.user.avatar,
        points: d.points,
        totalDonated: d.totalDonated,
        tier: d.tier
      }));

      res.json({
        success: true,
        leaderboard: {
          volunteers,
          donors
        },
        volunteers,
        donors
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to load leaderboard', error: err.message });
    }
  });

  return router;
}

module.exports = createRewardsRouter;
