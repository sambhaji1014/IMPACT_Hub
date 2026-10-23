/**
 * ImpactHub - Contact & Support API Router
 */

const express = require('express');
const crypto = require('crypto');
const { contactMessageSchema } = require('../validators');
const mailbox = require('../mailbox');

function createContactRouter(prisma) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const parsed = contactMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
      }

      const { name, email, subject, message } = parsed.data;
      const ticketId = `IH-TKT-${Date.now().toString().slice(-4)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const contactMsg = await prisma.contactMessage.create({
        data: {
          ticketId,
          name,
          email,
          subject: subject || 'General Platform Inquiry',
          message,
          status: 'OPEN'
        }
      });

      // Dispatch notification to dev mailbox
      await mailbox.sendMail({
        to: email,
        subject: `[${ticketId}] We received your inquiry`,
        html: `<p>Hello ${name},</p><p>Thank you for contacting ImpactHub Support. Your inquiry (Ticket #${ticketId}) has been logged. Our moderation and community operations team will review it.</p>`
      });

      res.status(201).json({
        success: true,
        message: 'Your inquiry has been received. Our team will respond shortly.',
        ticketId
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to submit inquiry', error: err.message });
    }
  });

  return router;
}

module.exports = createContactRouter;
