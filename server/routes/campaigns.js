/**
 * ImpactHub - Campaigns API Router
 * Crowdfunding campaigns management, donor wall, updates, and NGO verification enforcement
 */

const express = require('express');
const { campaignSchema } = require('../validators');

function createCampaignsRouter(prisma, authManager) {
  const router = express.Router();

  // 1. List Campaigns
  router.get('/', async (req, res) => {
    try {
      const { category, search, ngoId, status = 'ACTIVE', sort = 'urgent' } = req.query;

      const where = {};
      if (status && status !== 'all') where.status = status.toUpperCase();
      if (category && category !== 'all') where.category = { equals: category };
      if (ngoId) where.ngoId = ngoId;

      if (search) {
        const q = String(search).trim();
        where.OR = [
          { title: { contains: q } },
          { description: { contains: q } },
          { category: { contains: q } },
          { location: { contains: q } },
          { ngo: { orgName: { contains: q } } }
        ];
      }

      let orderBy = { deadline: 'asc' };
      if (sort === 'funded') orderBy = { raisedAmount: 'desc' };
      if (sort === 'newest') orderBy = { createdAt: 'desc' };
      if (sort === 'goal') orderBy = { goalAmount: 'desc' };

      const campaigns = await prisma.campaign.findMany({
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
          },
          _count: {
            select: { donations: true }
          }
        }
      });

      const formatted = campaigns.map(c => {
        const daysLeft = Math.max(0, Math.ceil((new Date(c.deadline) - new Date()) / (1000 * 60 * 60 * 24)));
        const percent = Math.min(100, Math.round((c.raisedAmount / (c.goalAmount || 1)) * 100));

        let images = [];
        try { images = JSON.parse(c.images); } catch (e) { images = []; }

        return {
          id: c.id,
          ngoId: c.ngoId,
          ngoName: c.ngo?.orgName || 'Grassroots NGO',
          ngoVerified: c.ngo?.verificationStatus === 'VERIFIED',
          ngoLogo: c.ngo?.logo,
          title: c.title,
          description: c.description,
          category: c.category,
          cause: c.category,
          goalAmount: c.goalAmount,
          goal: c.goalAmount,
          raisedAmount: c.raisedAmount,
          raised: c.raisedAmount,
          supportersCount: c._count.donations,
          supporters: c._count.donations,
          percentFunded: percent,
          deadline: c.deadline,
          daysLeft,
          location: c.location,
          image: images[0] || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
          images,
          status: c.status,
          isDemo: c.isDemo,
          createdAt: c.createdAt
        };
      });

      res.json({ success: true, campaigns: formatted });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch campaigns', error: err.message });
    }
  });

  // 2. Get Single Campaign Detail (with Donor Wall & NGO details)
  router.get('/:id', async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: {
          ngo: {
            include: { user: { select: { name: true, email: true } } }
          },
          donations: {
            where: { status: 'SUCCEEDED' },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              amount: true,
              donorName: true,
              anonymous: true,
              message: true,
              createdAt: true
            }
          }
        }
      });

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      const daysLeft = Math.max(0, Math.ceil((new Date(campaign.deadline) - new Date()) / (1000 * 60 * 60 * 24)));
      const percent = Math.min(100, Math.round((campaign.raisedAmount / (campaign.goalAmount || 1)) * 100));

      // Sanitize Donor Wall: Respect anonymity
      const donorWall = campaign.donations.map(d => ({
        id: d.id,
        donorName: d.anonymous ? 'Generous Anonymous Donor' : d.donorName,
        amount: d.amount,
        message: d.message,
        date: d.createdAt
      }));

      let images = [];
      try { images = JSON.parse(campaign.images); } catch (e) { images = []; }

      res.json({
        success: true,
        campaign: {
          ...campaign,
          images,
          image: images[0] || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
          ngoName: campaign.ngo?.orgName,
          ngoVerified: campaign.ngo?.verificationStatus === 'VERIFIED',
          ngoWebsite: campaign.ngo?.website,
          ngoDescription: campaign.ngo?.description,
          ngoRegistrationNumber: campaign.ngo?.registrationNumber,
          daysLeft,
          percentFunded: percent,
          donorWall
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching campaign', error: err.message });
    }
  });

  // 3. Create Campaign (NGO Only - requires verified email & checks NGO verification status)
  router.post('/', authManager.requireRole(['ngo', 'admin']), authManager.requireVerifiedEmail(), async (req, res) => {
    try {
      const parsed = campaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      let ngoProfile = req.user.ngoProfile;
      if (!ngoProfile) {
        ngoProfile = await prisma.ngoProfile.findUnique({ where: { userId: req.user.id } });
      }

      if (!ngoProfile && !req.user.roles.includes('admin')) {
        return res.status(403).json({ success: false, message: 'No registered NGO profile found for this account.' });
      }

      const ngoId = ngoProfile ? ngoProfile.id : (req.body.ngoId || 'ngo_green_earth');
      const isVerified = ngoProfile?.verificationStatus === 'VERIFIED' || req.user.roles.includes('admin');

      // Unverified NGOs cannot publish immediately: set status to DRAFT
      const status = isVerified ? (req.body.status || 'ACTIVE') : 'DRAFT';

      const { title, description, category, goalAmount, deadline, location, images } = parsed.data;

      const newCampaign = await prisma.campaign.create({
        data: {
          ngoId,
          title,
          description,
          category,
          goalAmount,
          deadline: new Date(deadline),
          location: location || 'Pune, Maharashtra',
          images: JSON.stringify(images || ['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80']),
          status,
          isDemo: false
        },
        include: { ngo: true }
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'CREATE_CAMPAIGN',
        entity: 'Campaign',
        entityId: newCampaign.id,
        details: { title, goalAmount, status },
        req
      });

      res.status(201).json({
        success: true,
        message: isVerified ? 'Campaign published successfully!' : 'Campaign saved as DRAFT. Your NGO verification is currently PENDING approval by administrators.',
        campaign: newCampaign
      });
    } catch (err) {
      console.error('Create Campaign Error:', err);
      res.status(500).json({ success: false, message: 'Failed to create campaign', error: err.message });
    }
  });

  // 4. Update Campaign (NGO ownership check)
  router.put('/:id', authManager.requireRole(['ngo', 'admin']), async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: { ngo: true }
      });

      if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

      const isOwner = campaign.ngo?.userId === req.user.id;
      const isAdmin = req.user.roles.includes('admin');
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'You do not have permission to modify this campaign.' });
      }

      const { title, description, goalAmount, status, deadline, location } = req.body;

      const updated = await prisma.campaign.update({
        where: { id: req.params.id },
        data: {
          title: title || undefined,
          description: description || undefined,
          goalAmount: goalAmount ? Number(goalAmount) : undefined,
          status: status || undefined,
          deadline: deadline ? new Date(deadline) : undefined,
          location: location || undefined
        }
      });

      res.json({ success: true, message: 'Campaign updated successfully', campaign: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update campaign', error: err.message });
    }
  });

  // 5. Delete Campaign
  router.delete('/:id', authManager.requireRole(['ngo', 'admin']), async (req, res) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
        include: { ngo: true }
      });

      if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

      const isOwner = campaign.ngo?.userId === req.user.id;
      const isAdmin = req.user.roles.includes('admin');
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete this campaign.' });
      }

      await prisma.campaign.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Campaign deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete campaign', error: err.message });
    }
  });

  return router;
}

module.exports = createCampaignsRouter;
