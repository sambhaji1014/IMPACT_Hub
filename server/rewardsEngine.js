/**
 * ImpactHub - Rewards Rules Engine
 * Evaluates verified actions, awards points, unlocks badges, and handles reversals
 */

const rewardsConfig = require('../rewards.config');

class RewardsEngine {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // 1. Award points for verified volunteer hours (Invoked ONLY after NGO confirms attendance)
  async awardVolunteerHours({ volunteerId, registrationId, hours, ngoUserId }) {
    if (volunteerId === ngoUserId) {
      throw new Error('Self-awarding is prohibited: NGO organizer cannot award hours to themselves.');
    }

    const reg = await this.prisma.driveRegistration.findUnique({
      where: { id: registrationId },
      include: { drive: true }
    });

    if (!reg) throw new Error('Registration record not found.');
    if (reg.status !== 'ATTENDED') {
      throw new Error('Points can only be awarded for confirmed ATTENDED drives.');
    }

    // Check anti-abuse daily point cap
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyPointsAgg = await this.prisma.rewardEvent.aggregate({
      where: {
        userId: volunteerId,
        createdAt: { gte: today },
        isReversed: false
      },
      _sum: { points: true }
    });

    const currentDailyPoints = dailyPointsAgg._sum.points || 0;
    const basePoints = Math.round(hours * rewardsConfig.volunteers.pointsPerHour);
    let pointsToAward = basePoints;

    // First drive bonus check
    const previousDrives = await this.prisma.driveRegistration.count({
      where: {
        volunteerId,
        status: 'ATTENDED',
        id: { not: registrationId }
      }
    });

    let isFirstDrive = false;
    if (previousDrives === 0) {
      isFirstDrive = true;
      pointsToAward += rewardsConfig.volunteers.firstDriveBonusPoints;
    }

    // Apply daily cap
    const maxAllowed = Math.max(0, rewardsConfig.volunteers.dailyPointCap - currentDailyPoints);
    pointsToAward = Math.min(pointsToAward, maxAllowed);

    if (pointsToAward <= 0) {
      return { awarded: 0, reason: 'Daily point cap reached' };
    }

    // Record RewardEvent in transaction
    const event = await this.prisma.$transaction(async (tx) => {
      const rewardEv = await tx.rewardEvent.create({
        data: {
          userId: volunteerId,
          type: isFirstDrive ? 'VOLUNTEER_FIRST_DRIVE' : 'VOLUNTEER_HOURS',
          points: pointsToAward,
          refId: registrationId,
          reason: `Verified ${hours} service hours for "${reg.drive.title}"${isFirstDrive ? ' + First Drive Bonus!' : ''}`
        }
      });

      // Update volunteer profile totalHours & points
      const profile = await tx.volunteerProfile.upsert({
        where: { userId: volunteerId },
        create: {
          userId: volunteerId,
          totalHours: hours,
          points: pointsToAward
        },
        update: {
          totalHours: { increment: hours },
          points: { increment: pointsToAward }
        }
      });

      // Check level upgrades
      let newLevel = 'Bronze';
      for (const lvl of rewardsConfig.volunteers.levels) {
        if (profile.totalHours >= lvl.minHours) {
          newLevel = lvl.name;
        }
      }

      if (profile.level !== newLevel) {
        await tx.volunteerProfile.update({
          where: { userId: volunteerId },
          data: { level: newLevel }
        });

        await tx.notification.create({
          data: {
            userId: volunteerId,
            title: `Rank Promoted to ${newLevel}!`,
            message: `Congratulations! Your verified service hours elevated you to ${newLevel} recognition.`,
            type: 'REWARD'
          }
        });
      }

      await tx.notification.create({
        data: {
          userId: volunteerId,
          title: `+${pointsToAward} Impact Points Earned!`,
          message: `Verified by ${reg.drive.category} team for participating in "${reg.drive.title}".`,
          type: 'REWARD'
        }
      });

      return rewardEv;
    });

    // Check & unlock badges
    await this.evaluateVolunteerBadges(volunteerId);

    return event;
  }

  // 2. Award points for verified donation (Invoked ONLY after payment signature is verified)
  async awardDonationPoints({ donationId }) {
    const donation = await this.prisma.donation.findUnique({
      where: { id: donationId },
      include: { campaign: true }
    });

    if (!donation || donation.status !== 'SUCCEEDED' || !donation.donorId) {
      return null; // Guest or incomplete donation
    }

    // Check if points were already awarded for this donation
    const existing = await this.prisma.rewardEvent.findFirst({
      where: { refId: donationId, type: 'DONATION_POINTS' }
    });
    if (existing) return existing;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyPointsAgg = await this.prisma.rewardEvent.aggregate({
      where: {
        userId: donation.donorId,
        createdAt: { gte: today },
        isReversed: false
      },
      _sum: { points: true }
    });

    const currentDaily = dailyPointsAgg._sum.points || 0;
    let points = Math.round(donation.amount * rewardsConfig.donors.pointsPerRupee);

    // First donation bonus
    const prevDonations = await this.prisma.donation.count({
      where: {
        donorId: donation.donorId,
        status: 'SUCCEEDED',
        id: { not: donationId }
      }
    });

    let isFirst = false;
    if (prevDonations === 0) {
      isFirst = true;
      points += rewardsConfig.donors.firstDonationBonusPoints;
    }

    // Cap
    const maxAllowed = Math.max(0, rewardsConfig.donors.dailyPointCap - currentDaily);
    points = Math.min(points, maxAllowed);

    if (points <= 0) return null;

    const event = await this.prisma.$transaction(async (tx) => {
      const rewardEv = await tx.rewardEvent.create({
        data: {
          userId: donation.donorId,
          type: 'DONATION_POINTS',
          points,
          refId: donationId,
          reason: `Verified contribution of ₹${donation.amount} to "${donation.campaign.title}"${isFirst ? ' + Welcome Gift!' : ''}`
        }
      });

      const profile = await tx.donorProfile.upsert({
        where: { userId: donation.donorId },
        create: {
          userId: donation.donorId,
          totalDonated: donation.amount,
          points
        },
        update: {
          totalDonated: { increment: donation.amount },
          points: { increment: points }
        }
      });

      // Update donor tier
      let newTier = 'Supporter';
      for (const t of rewardsConfig.donors.tiers) {
        if (profile.totalDonated >= t.minAmount) {
          newTier = t.name;
        }
      }

      if (profile.tier !== newTier) {
        await tx.donorProfile.update({
          where: { userId: donation.donorId },
          data: { tier: newTier }
        });

        await tx.notification.create({
          data: {
            userId: donation.donorId,
            title: `Donor Tier Upgraded to ${newTier}!`,
            message: `Your cumulative philanthropic impact has reached the ${newTier} tier.`,
            type: 'REWARD'
          }
        });
      }

      await tx.notification.create({
        data: {
          userId: donation.donorId,
          title: `+${points} Philanthropy Points!`,
          message: `Official receipt ${donation.receiptNo} verified. Thank you for empowering "${donation.campaign.title}".`,
          type: 'REWARD'
        }
      });

      return rewardEv;
    });

    await this.evaluateDonorBadges(donation.donorId);
    return event;
  }

  // 3. Reversal mechanism for attendance corrections or donation refunds
  async reverseRewardEvent({ refId, reason }) {
    const events = await this.prisma.rewardEvent.findMany({
      where: { refId, isReversed: false }
    });

    for (const ev of events) {
      await this.prisma.$transaction(async (tx) => {
        await tx.rewardEvent.update({
          where: { id: ev.id },
          data: { isReversed: true }
        });

        await tx.rewardEvent.create({
          data: {
            userId: ev.userId,
            type: 'POINTS_REVERSED',
            points: -ev.points,
            refId: ev.refId,
            reason: `Reversal: ${reason}`
          }
        });

        // Deduct from profile
        if (ev.type.startsWith('VOLUNTEER')) {
          await tx.volunteerProfile.updateMany({
            where: { userId: ev.userId },
            data: { points: { decrement: ev.points } }
          });
        } else if (ev.type.startsWith('DONATION')) {
          await tx.donorProfile.updateMany({
            where: { userId: ev.userId },
            data: { points: { decrement: ev.points } }
          });
        }

        await tx.notification.create({
          data: {
            userId: ev.userId,
            title: 'Reward Adjustment Notice',
            message: `An adjustment of ${ev.points} points occurred: ${reason}`,
            type: 'WARNING'
          }
        });
      });
    }
  }

  // 4. Badges evaluators
  async evaluateVolunteerBadges(userId) {
    const profile = await this.prisma.volunteerProfile.findUnique({ where: { userId } });
    if (!profile) return;

    const attendedDrives = await this.prisma.driveRegistration.findMany({
      where: { volunteerId: userId, status: 'ATTENDED' },
      include: { drive: true }
    });

    const badgesToGrant = [];

    if (attendedDrives.length >= 1) badgesToGrant.push('vol-first-drive');
    if (profile.totalHours >= 10) badgesToGrant.push('vol-10-hours');
    if (profile.totalHours >= 25) badgesToGrant.push('vol-25-hours');

    // Multi-cause check
    const categories = new Set(attendedDrives.map(d => d.drive.category));
    if (categories.size >= 2) badgesToGrant.push('vol-cause-champion');

    for (const slug of badgesToGrant) {
      await this.grantBadge(userId, slug);
    }
  }

  async evaluateDonorBadges(userId) {
    const profile = await this.prisma.donorProfile.findUnique({ where: { userId } });
    if (!profile) return;

    const successfulDonations = await this.prisma.donation.findMany({
      where: { donorId: userId, status: 'SUCCEEDED' },
      include: { campaign: true }
    });

    const badgesToGrant = [];
    if (successfulDonations.length >= 1) badgesToGrant.push('donor-first-gift');
    if (successfulDonations.length >= 3) badgesToGrant.push('donor-repeat-giver');

    const categories = new Set(successfulDonations.map(d => d.campaign.category));
    if (categories.size >= 2) badgesToGrant.push('donor-multi-cause');

    for (const slug of badgesToGrant) {
      await this.grantBadge(userId, slug);
    }
  }

  async grantBadge(userId, badgeSlug) {
    const badge = await this.prisma.badge.findUnique({ where: { slug: badgeSlug } });
    if (!badge) return;

    const existing = await this.prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } }
    });

    if (!existing) {
      await this.prisma.userBadge.create({
        data: { userId, badgeId: badge.id }
      });

      await this.prisma.notification.create({
        data: {
          userId,
          title: `🏅 Badge Unlocked: ${badge.name}!`,
          message: badge.description,
          type: 'REWARD'
        }
      });
    }
  }
}

module.exports = RewardsEngine;
