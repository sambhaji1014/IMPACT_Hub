/**
 * ImpactHub - Donations API Router
 * PaymentGateway integration, signature verification, PDF receipts, and reward triggers
 */

const express = require('express');
const crypto = require('crypto');
const { donationOrderSchema, donationVerifySchema } = require('../validators');
const PDFGenerator = require('../pdfGenerator');

function createDonationsRouter(prisma, authManager, paymentGateway, rewardsEngine) {
  const router = express.Router();

  // 1. Create Donation Order (Server-Side Initialization - requires signed-in, email-verified donor)
  router.post(['/', '/order'], authManager.requireAuth(), authManager.requireVerifiedEmail(), async (req, res) => {
    try {
      const parsed = donationOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { campaignId, amount, donorName, donorEmail, donorPhone, anonymous, message } = parsed.data;

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { ngo: true }
      });

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      // NGOs cannot donate to their own campaigns for rewards
      const userNgoProfileId = req.user.ngoProfile?.id;
      if (campaign.ngo && (campaign.ngo.userId === req.user.id || (userNgoProfileId && campaign.ngoId === userNgoProfileId))) {
        return res.status(403).json({
          success: false,
          error: 'SelfDonationForbidden',
          message: 'NGO organizers cannot donate to their own campaigns for rewards.'
        });
      }

      const receiptNo = `IH-REC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // Initialize order via Payment Gateway adapter
      const order = await paymentGateway.createOrder({
        amount,
        currency: 'INR',
        receipt: receiptNo,
        notes: {
          campaignId,
          campaignTitle: campaign.title,
          donorName
        }
      });

      // Create Donation in PENDING status
      const donation = await prisma.donation.create({
        data: {
          campaignId,
          donorId: req.user ? req.user.id : null,
          donorName,
          donorEmail,
          donorPhone,
          amount,
          currency: 'INR',
          status: 'PENDING',
          gatewayOrderId: order.orderId,
          receiptNo,
          anonymous: !!anonymous,
          message: message || null,
          isSimulated: paymentGateway.isSimulator
        }
      });

      res.status(201).json({
        success: true,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId,
        donationId: donation.id,
        receiptNo,
        mode: order.mode,
        isSimulator: paymentGateway.isSimulator,
        donation: {
          id: donation.id,
          receiptNo,
          amount,
          status: donation.status,
          currency: donation.currency
        }
      });
    } catch (err) {
      console.error('Donation Order Error:', err);
      res.status(500).json({ success: false, message: 'Failed to initiate payment order', error: err.message });
    }
  });

  // 2. Verify Payment Signature & Confirm Donation
  router.post('/verify', async (req, res) => {
    try {
      const parsed = donationVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { donationId, orderId, paymentId, signature } = parsed.data;

      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: { campaign: true }
      });

      if (!donation) {
        return res.status(404).json({ success: false, message: 'Donation record not found' });
      }

      // Check idempotency: if already confirmed
      if (donation.status === 'SUCCEEDED') {
        return res.json({
          success: true,
          message: 'Donation has already been confirmed.',
          receiptNo: donation.receiptNo,
          donation
        });
      }

      // Server-side signature verification
      const verifyResult = paymentGateway.verifyPayment({
        orderId,
        paymentId,
        signature
      });

      if (!verifyResult.success) {
        await prisma.donation.update({
          where: { id: donationId },
          data: { status: 'FAILED' }
        });

        return res.status(400).json({
          success: false,
          error: 'SignatureVerificationFailed',
          message: 'Payment verification failed. Invalid gateway signature.'
        });
      }

      // Confirm donation and increment campaign raisedAmount in transaction
      const confirmedDonation = await prisma.$transaction(async (tx) => {
        const d = await tx.donation.update({
          where: { id: donationId },
          data: {
            status: 'SUCCEEDED',
            gatewayPaymentId: paymentId
          },
          include: { campaign: { include: { ngo: true } } }
        });

        await tx.campaign.update({
          where: { id: d.campaignId },
          data: {
            raisedAmount: { increment: d.amount }
          }
        });

        return d;
      });

      // Award points via RewardsEngine
      let rewardResult = null;
      if (confirmedDonation.donorId) {
        rewardResult = await rewardsEngine.awardDonationPoints({ donationId: confirmedDonation.id });
      }

      await authManager.logAudit({
        userId: confirmedDonation.donorId,
        action: 'DONATE',
        entity: 'Donation',
        entityId: confirmedDonation.id,
        details: { amount: confirmedDonation.amount, receiptNo: confirmedDonation.receiptNo },
        req
      });

      res.json({
        success: true,
        message: 'Payment verified and donation completed successfully!',
        receiptNo: confirmedDonation.receiptNo,
        donation: confirmedDonation,
        reward: rewardResult
      });
    } catch (err) {
      console.error('Payment Verification Error:', err);
      res.status(500).json({ success: false, message: 'Verification error', error: err.message });
    }
  });

  // 3. Get My Donations (Donor session)
  router.get('/my', authManager.requireAuth(), async (req, res) => {
    try {
      const donations = await prisma.donation.findMany({
        where: { donorId: req.user.id },
        include: {
          campaign: {
            include: { ngo: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = donations.map(d => ({
        id: d.id,
        campaignId: d.campaignId,
        campaignTitle: d.campaign?.title || 'Community Campaign',
        ngoName: d.campaign?.ngo?.orgName || 'Grassroots NGO',
        amount: d.amount,
        currency: d.currency,
        date: new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        referenceCode: d.receiptNo,
        receiptNo: d.receiptNo,
        status: d.status,
        isSimulated: d.isSimulated
      }));

      res.json({ success: true, donations: formatted });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch donation history', error: err.message });
    }
  });

  // 4. Download Section 80G Tax Receipt (PDF)
  router.get('/:id/receipt.pdf', async (req, res) => {
    try {
      const donation = await prisma.donation.findUnique({
        where: { id: req.params.id },
        include: {
          campaign: { include: { ngo: true } }
        }
      });

      if (!donation || donation.status !== 'SUCCEEDED') {
        return res.status(404).json({ success: false, message: 'Official receipt not available for unconfirmed transactions.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Donation-Receipt-${donation.receiptNo}.pdf"`);
      PDFGenerator.generateDonationReceipt(donation, res);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Receipt generation failed', error: err.message });
    }
  });

  // 5. Direct donation creation (Runs simulated test gateway completion)
  router.post('/', async (req, res) => {
    try {
      const parsed = donationOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { campaignId, amount, donorName, donorEmail, donorPhone, anonymous, message } = parsed.data;
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { ngo: true }
      });

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      const receiptNo = `IH-REC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const order = await paymentGateway.createOrder({
        amount,
        currency: 'INR',
        receipt: receiptNo,
        notes: { campaignId, campaignTitle: campaign.title, donorName }
      });

      const paymentId = `pay_sim_${Date.now()}`;
      const confirmedDonation = await prisma.$transaction(async (tx) => {
        const d = await tx.donation.create({
          data: {
            campaignId,
            donorId: req.user ? req.user.id : null,
            donorName,
            donorEmail,
            donorPhone,
            amount,
            currency: 'INR',
            status: 'SUCCEEDED',
            gatewayOrderId: order.orderId,
            gatewayPaymentId: paymentId,
            receiptNo,
            anonymous: !!anonymous,
            message: message || null,
            isSimulated: true
          },
          include: { campaign: { include: { ngo: true } } }
        });

        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            raisedAmount: { increment: amount }
          }
        });

        return d;
      });

      let rewardResult = null;
      if (confirmedDonation.donorId) {
        rewardResult = await rewardsEngine.awardDonationPoints(confirmedDonation.donorId, amount, confirmedDonation.id);
      }

      res.status(201).json({
        success: true,
        message: 'Donation processed and confirmed successfully!',
        donation: confirmedDonation,
        receiptNo: confirmedDonation.receiptNo,
        receiptUrl: `/api/v1/donations/${confirmedDonation.id}/receipt.pdf`,
        reward: rewardResult
      });
    } catch (err) {
      console.error('Direct donation error:', err);
      res.status(500).json({ success: false, message: 'Donation processing failed', error: err.message });
    }
  });

  return router;
}

module.exports = createDonationsRouter;
