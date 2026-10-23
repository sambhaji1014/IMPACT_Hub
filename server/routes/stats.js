/**
 * ImpactHub - Public Stats & Health Endpoints
 */

const express = require('express');

function createStatsRouter(prisma) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const verifiedNGOs = await prisma.ngoProfile.count({
        where: { verificationStatus: 'VERIFIED' }
      });

      const activeCampaigns = await prisma.campaign.count({
        where: { status: 'ACTIVE' }
      });

      const activeDrives = await prisma.drive.count({
        where: { status: 'ACTIVE' }
      });

      const volunteersCount = await prisma.user.count({
        where: { role: 'volunteer' }
      });

      const donorsCount = await prisma.user.count({
        where: { role: 'donor' }
      });

      const totalHoursAgg = await prisma.volunteerProfile.aggregate({
        _sum: { totalHours: true }
      });

      const totalDonationsAgg = await prisma.donation.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true }
      });

      res.json({
        success: true,
        stats: {
          verifiedNGOs,
          activeCampaigns,
          activeDrives,
          volunteersCount,
          donorsCount,
          totalHours: totalHoursAgg._sum.totalHours || 0,
          totalFundsRaised: totalDonationsAgg._sum.amount || 0
        },
        meta: {
          source: 'LIVE_DATABASE_AGGREGATION',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to retrieve stats', error: err.message });
    }
  });

  return router;
}

module.exports = createStatsRouter;
