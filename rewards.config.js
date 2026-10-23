/**
 * ImpactHub - Editable Rewards Configuration Engine
 * Configures rules, thresholds, badges, medals, and anti-abuse limits
 * for both Volunteers and Donors.
 */

module.exports = {
  volunteers: {
    pointsPerHour: 10,
    firstDriveBonusPoints: 50,
    streakBonusPoints: 25, // Bonus for attending 3+ consecutive drives
    dailyPointCap: 150, // Anti-abuse cap

    // Level & Medal Thresholds (by cumulative confirmed hours)
    levels: [
      { name: 'Bronze', minHours: 0, icon: '🥉', color: '#CD7F32' },
      { name: 'Silver', minHours: 10, icon: '🥈', color: '#94A3B8' },
      { name: 'Gold', minHours: 25, icon: '🥇', color: '#F59E0B' },
      { name: 'Platinum', minHours: 50, icon: '💎', color: '#06B6D4' }
    ],

    // Badges definitions
    badges: [
      {
        slug: 'vol-first-drive',
        name: 'First Step Changemaker',
        description: 'Successfully attended and verified your first community volunteer drive.',
        icon: '🌱',
        category: 'VOLUNTEER',
        criteria: 'Attend 1 verified volunteer drive'
      },
      {
        slug: 'vol-10-hours',
        name: 'Dedicated Contributor',
        description: 'Completed 10 hours of verified on-ground community service.',
        icon: '⭐',
        category: 'VOLUNTEER',
        criteria: 'Complete 10 verified hours'
      },
      {
        slug: 'vol-25-hours',
        name: 'Community Pillar',
        description: 'Completed 25 hours of on-ground service across grassroots initiatives.',
        icon: '🌟',
        category: 'VOLUNTEER',
        criteria: 'Complete 25 verified hours'
      },
      {
        slug: 'vol-weekend-warrior',
        name: 'Weekend Warrior',
        description: 'Attended 3 weekend volunteer mobilization drives.',
        icon: '🛡️',
        category: 'VOLUNTEER',
        criteria: 'Participate in 3 weekend drives'
      },
      {
        slug: 'vol-cause-champion',
        name: 'Eco & Social Champion',
        description: 'Volunteered across at least 2 distinct social cause sectors.',
        icon: '🏆',
        category: 'VOLUNTEER',
        criteria: 'Serve in 2+ cause categories'
      }
    ]
  },

  donors: {
    pointsPerRupee: 0.1, // 1 point for every ₹10 donated
    firstDonationBonusPoints: 50,
    dailyPointCap: 500,

    // Donor Tiers (by cumulative ₹ donated)
    tiers: [
      { name: 'Supporter', minAmount: 0, icon: '🎗️', badgeColor: '#10B981' },
      { name: 'Patron', minAmount: 5000, icon: '🎖️', badgeColor: '#3B82F6' },
      { name: 'Champion', minAmount: 15000, icon: '👑', badgeColor: '#8B5CF6' },
      { name: 'Guardian', minAmount: 50000, icon: '🏛️', badgeColor: '#D97706' }
    ],

    // Badges definitions
    badges: [
      {
        slug: 'donor-first-gift',
        name: 'First Light Catalyst',
        description: 'Made your first transparent contribution to a grassroots campaign.',
        icon: '💖',
        category: 'DONOR',
        criteria: 'Contribute to 1 campaign'
      },
      {
        slug: 'donor-repeat-giver',
        name: 'Steadfast Philanthropist',
        description: 'Supported 3 or more independent community fundraising campaigns.',
        icon: '🤝',
        category: 'DONOR',
        criteria: 'Back 3 distinct campaigns'
      },
      {
        slug: 'donor-multi-cause',
        name: 'Multi-Cause Supporter',
        description: 'Contributed to causes spanning healthcare, education, and ecology.',
        icon: '🌍',
        category: 'DONOR',
        criteria: 'Donate to 2+ distinct causes'
      },
      {
        slug: 'donor-campaign-completer',
        name: 'Finish Line Booster',
        description: 'Contributed to a campaign within its final 15% to goal achievement.',
        icon: '🏁',
        category: 'DONOR',
        criteria: 'Contribute to near-target campaign'
      }
    ]
  }
};
