/**
 * ImpactHub - User Reporting Router (/api/v1/reports)
 * Allows registered users to flag campaigns, drives, or NGOs for admin moderation.
 */

const express = require('express');
const { reportSchema } = require('../validators');

function createReportsRouter(prisma, authManager) {
  const router = express.Router();

  // List Reports (Admin only)
  router.get('/', authManager.requireRole(['admin']), async (req, res) => {
    try {
      const reports = await prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { id: true, name: true, email: true } } }
      });
      res.json({ success: true, reports });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
  });

  // Create Report (Requires logged-in user)
  router.post('/', authManager.requireAuth(), async (req, res) => {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.issues,
          message: parsed.error.issues[0]?.message || 'Invalid report payload.'
        });
      }

      const { entityType, entityId, reason } = parsed.data;

      const report = await prisma.report.create({
        data: {
          reporterId: req.user.id,
          entityType,
          entityId,
          reason,
          status: 'PENDING'
        }
      });

      await authManager.logAudit({
        userId: req.user.id,
        action: 'SUBMIT_REPORT',
        entity: 'Report',
        entityId: report.id,
        details: { entityType, entityId },
        req
      });

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully. Our safety team will review it promptly.',
        report
      });
    } catch (err) {
      console.error('Report Creation Error:', err);
      res.status(500).json({ success: false, message: 'Failed to submit report.' });
    }
  });

  return router;
}

module.exports = createReportsRouter;
