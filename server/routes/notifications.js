/**
 * ImpactHub - In-App Notifications API Router
 */

const express = require('express');

function createNotificationsRouter(prisma, authManager) {
  const router = express.Router();

  router.use(authManager.requireAuth());

  router.get('/', async (req, res) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30
      });

      res.json({ success: true, notifications });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
  });

  router.put('/:id/read', async (req, res) => {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { read: true }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
  });

  router.put('/read-all', async (req, res) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, read: false },
        data: { read: true }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to mark all notifications read' });
    }
  });

  return router;
}

module.exports = createNotificationsRouter;
