/**
 * ImpactHub - Dev Mailbox & Notification Dispatcher
 * Persists sent emails in database (DispatchedEmail) and maintains in-memory buffer
 * Survives server restarts for durable verification links and password resets.
 */

class MailboxService {
  constructor() {
    this.messages = [];
    this.prisma = null;
  }

  setPrisma(prisma) {
    this.prisma = prisma;
  }

  async sendMail({ to, subject, html, text }) {
    const msg = {
      id: 'mail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
      sentAt: new Date().toISOString()
    };

    // In-memory buffer
    this.messages.unshift(msg);
    if (this.messages.length > 50) this.messages.pop();

    // Database persistence
    if (this.prisma) {
      try {
        await this.prisma.dispatchedEmail.create({
          data: {
            id: msg.id,
            to: msg.to,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            sentAt: new Date(msg.sentAt)
          }
        });
      } catch (err) {
        console.warn('[DEV MAILBOX DB SAVE WARNING]:', err.message);
      }
    }

    console.log(`\n📧 [DEV MAILBOX] To: ${to} | Subject: "${subject}"`);
    console.log(`   Link/Snippet: ${text ? text.slice(0, 160) : html.slice(0, 160)}...\n`);

    return msg;
  }

  async getMessages() {
    if (this.prisma) {
      try {
        const rows = await this.prisma.dispatchedEmail.findMany({
          orderBy: { sentAt: 'desc' },
          take: 50
        });
        if (rows && rows.length > 0) {
          return rows.map(r => ({
            id: r.id,
            to: r.to,
            subject: r.subject,
            html: r.html,
            text: r.text,
            sentAt: r.sentAt.toISOString ? r.sentAt.toISOString() : new Date(r.sentAt).toISOString()
          }));
        }
      } catch (err) {
        console.warn('[DEV MAILBOX DB FETCH WARNING]:', err.message);
      }
    }
    return this.messages;
  }

  async clear() {
    this.messages = [];
    if (this.prisma) {
      try {
        await this.prisma.dispatchedEmail.deleteMany({});
      } catch (err) {
        console.warn('[DEV MAILBOX DB CLEAR WARNING]:', err.message);
      }
    }
  }
}

const mailbox = new MailboxService();
module.exports = mailbox;

