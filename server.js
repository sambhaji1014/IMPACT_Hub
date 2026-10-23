/**
 * ImpactHub - Production-Grade Express Server & REST API v1
 * Powered by Node.js 20, Express, Prisma ORM, Zod, and cookie-based JWT sessions
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

// Ensure stable, absolute SQLite DATABASE_URL
let sqliteDbPath = null;
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  sqliteDbPath = path.resolve(__dirname, 'prisma/dev.db');
  process.env.DATABASE_URL = `file:${sqliteDbPath.replace(/\\/g, '/')}`;
}

// Initialize Prisma Client
const prisma = new PrismaClient();

// Internal Engines & Adapters
const AuthManager = require('./server/auth');
const authManager = new AuthManager(prisma);

const RewardsEngine = require('./server/rewardsEngine');
const rewardsEngine = new RewardsEngine(prisma);

const PaymentGatewayAdapter = require('./server/paymentGateway');
const paymentGateway = new PaymentGatewayAdapter({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET
});

const mailbox = require('./server/mailbox');
mailbox.setPrisma(prisma);

// Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow CDN resources (Google Fonts, Font Awesome, Unsplash images)
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

const COOKIE_SECRET = process.env.COOKIE_SECRET || 'impacthub-cookie-signing-secret-key-32chars-min-2026!';
app.use(cookieParser(COOKIE_SECRET));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Auth Token Cookie Middleware
app.use(authManager.getAuthMiddleware());

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 mins
  max: Number(process.env.RATE_LIMIT_MAX_AUTH || (process.env.NODE_ENV === 'production' ? 30 : 500)),
  message: {
    success: false,
    error: 'TooManyRequests',

    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') || req.path === '/health') {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health Endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'HEALTHY',
      platform: 'ImpactHub',
      environment: process.env.NODE_ENV || 'development',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (err) {
    res.status(503).json({
      status: 'UNHEALTHY',
      database: 'DISCONNECTED',
      error: err.message
    });
  }
});

// Dev Mailbox Page (In-development email inspector - disabled in production)
app.get('/dev-mailbox', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  const messages = await mailbox.getMessages();
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ImpactHub Dev Mailbox</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background: #F8FAFC; color: #1E293B; margin: 0; padding: 2rem; }
        .container { max-width: 850px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 2px solid #E2E8F0; padding-bottom: 1rem; }
        .mail-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .mail-to { font-weight: 700; color: #059669; }
        .mail-time { font-size: 0.8rem; color: #64748B; }
        .mail-subject { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0; color: #0F172A; }
        .mail-body { background: #F1F5F9; padding: 1rem; border-radius: 6px; font-size: 0.9rem; word-break: break-all; }
        .btn-clear { background: #EF4444; color: #FFF; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
        a.btn-home { color: #059669; text-decoration: none; font-weight: 600; margin-right: 1rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 1.5rem; color: #059669;">ImpactHub Dev Mailbox</h1>
            <p style="margin: 0.25rem 0 0 0; color: #64748B; font-size: 0.88rem;">Local email sink for password resets, verification tokens, and alerts (stored in DB).</p>
          </div>
          <div>
            <a href="/" class="btn-home">&larr; Return to Site</a>
            <button class="btn-clear" onclick="fetch('/api/v1/dev-mailbox/clear', { method: 'POST' }).then(() => location.reload())">Clear Mailbox</button>
          </div>
        </div>
        ${messages.length === 0 ? '<div style="text-align: center; color: #94A3B8; padding: 3rem;">No emails dispatched yet in this runtime. Trigger a password reset or sign-up to see notifications here.</div>' : ''}
        ${messages.map(m => `
          <div class="mail-card">
            <div style="display: flex; justify-content: space-between;">
              <span class="mail-to">To: ${m.to}</span>
              <span class="mail-time">${new Date(m.sentAt).toLocaleTimeString()} (${new Date(m.sentAt).toLocaleDateString()})</span>
            </div>
            <div class="mail-subject">${m.subject}</div>
            <div class="mail-body">${m.html}</div>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `);
});

app.post('/api/v1/dev-mailbox/clear', async (req, res) => {
  await mailbox.clear();
  res.json({ success: true });
});

// REST API v1 Routes
const statsRouter = require('./server/routes/stats');
const authRouter = require('./server/routes/auth');
const campaignsRouter = require('./server/routes/campaigns');
const drivesRouter = require('./server/routes/drives');
const donationsRouter = require('./server/routes/donations');
const rewardsRouter = require('./server/routes/rewards');
const ngosRouter = require('./server/routes/ngos');
const adminRouter = require('./server/routes/admin');
const contactRouter = require('./server/routes/contact');
const notificationsRouter = require('./server/routes/notifications');
const meRouter = require('./server/routes/me');
const reportsRouter = require('./server/routes/reports');

app.use('/api/v1/stats', statsRouter(prisma));
app.use('/api/v1/auth', authLimiter, authRouter(prisma, authManager));
app.use('/api/v1/me', meRouter(prisma, authManager, rewardsEngine));
app.use('/api/v1/campaigns', campaignsRouter(prisma, authManager));
app.use('/api/v1/drives', drivesRouter(prisma, authManager, rewardsEngine));
app.use('/api/v1/donations', donationsRouter(prisma, authManager, paymentGateway, rewardsEngine));
app.use('/api/v1/rewards', rewardsRouter(prisma, authManager));
app.use('/api/v1/ngos', ngosRouter(prisma, authManager, rewardsEngine));
app.use('/api/v1/admin', adminRouter(prisma, authManager));
app.use('/api/v1/contact', contactRouter(prisma));
app.use('/api/v1/notifications', notificationsRouter(prisma, authManager));
app.use('/api/v1/reports', reportsRouter(prisma, authManager));

// Backward compatibility alias: /api/* routes map to /api/v1/*
app.use('/api/stats', statsRouter(prisma));
app.use('/api/auth', authRouter(prisma, authManager));
app.use('/api/me', meRouter(prisma, authManager, rewardsEngine));
app.use('/api/campaigns', campaignsRouter(prisma, authManager));
app.use('/api/opportunities', drivesRouter(prisma, authManager, rewardsEngine));
app.use('/api/drives', drivesRouter(prisma, authManager, rewardsEngine));
app.use('/api/applications', (req, res, next) => {
  req.url = req.url === '/' ? '/registrations/my' : req.url;
  drivesRouter(prisma, authManager, rewardsEngine)(req, res, next);
});
app.use('/api/donations', donationsRouter(prisma, authManager, paymentGateway, rewardsEngine));
app.use('/api/ngos', ngosRouter(prisma, authManager, rewardsEngine));
app.use('/api/contact', contactRouter(prisma));

// Canonical Route Mapping & URL Redirects (Phase 1: Information Architecture)
app.get('/login.html', (req, res) => res.redirect(301, '/auth?tab=signin'));
app.get('/signup.html', (req, res) => res.redirect(301, '/auth?tab=signup'));
app.get('/impact.html', (req, res) => res.redirect(301, '/leaderboard'));

// Serve canonical clean URLs
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/campaigns', (req, res) => res.sendFile(path.join(__dirname, 'public', 'campaigns.html')));
app.get('/drives', (req, res) => res.sendFile(path.join(__dirname, 'public', 'volunteer.html')));
app.get('/volunteer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'volunteer.html')));
app.get('/ngos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ngos.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'leaderboard.html')));
app.get('/rewards', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rewards.html')));

// Policies and Legal
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));

// Styled Error Pages
app.get('/401', (req, res) => res.status(401).sendFile(path.join(__dirname, 'public', '401.html')));
app.get('/403', (req, res) => res.status(403).sendFile(path.join(__dirname, 'public', '403.html')));
app.get('/500', (req, res) => res.status(500).sendFile(path.join(__dirname, 'public', '500.html')));

// SEO Files
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nDisallow: /dashboard\nDisallow: /api/\nDisallow: /dev-mailbox\nSitemap: " + (process.env.BASE_URL || 'http://localhost:5000') + "/sitemap.xml\n");
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/campaigns</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/drives</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/ngos</loc><priority>0.7</priority></url>
  <url><loc>${baseUrl}/leaderboard</loc><priority>0.6</priority></url>
  <url><loc>${baseUrl}/rewards</loc><priority>0.6</priority></url>
  <url><loc>${baseUrl}/about</loc><priority>0.5</priority></url>
  <url><loc>${baseUrl}/contact</loc><priority>0.5</priority></url>
  <url><loc>${baseUrl}/terms</loc><priority>0.3</priority></url>
  <url><loc>${baseUrl}/privacy</loc><priority>0.3</priority></url>
</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

// Serve Static Assets (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  maxAge: '1h'
}));

// 404 Handler for undefined routes
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  } else {
    res.status(404).json({ success: false, error: 'NotFound', message: `Cannot ${req.method} ${req.url}` });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message
  });
});

// Automatic daily token & session cleanup job
async function runCleanupJob() {
  try {
    const now = new Date();
    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });
    if (deletedTokens.count > 0) {
      console.log(`🧹 [CLEANUP] Expired/revoked sessions cleaned: ${deletedTokens.count}`);
    }
  } catch (err) {
    console.warn('[CLEANUP WARNING]:', err.message);
  }
}
setInterval(runCleanupJob, 24 * 60 * 60 * 1000);
runCleanupJob();

// Server Initialization
const { getAdminEmails } = require('./server/auth');

const server = app.listen(PORT, () => {
  const adminEmails = getAdminEmails();

  console.log(`\n======================================================`);
  console.log(`🚀 ImpactHub Production Engine running at http://localhost:${PORT}`);
  if (sqliteDbPath) {
    console.log(`📂 [DATABASE] Stable SQLite path: ${sqliteDbPath}`);
  } else {
    console.log(`📂 [DATABASE] Connected: ${process.env.DATABASE_URL?.split('@')[1] || 'External URL'}`);
  }

  console.log(`🔐 [AUTH] Admin allow-list loaded: ${adminEmails.length} email(s) -> [${adminEmails.join(', ')}]`);
  if (adminEmails.length === 0) {
    console.warn(`⚠️  WARNING: ADMIN_EMAILS is empty! No users can access admin privileges.`);
  } else {
    const placeholders = adminEmails.filter(e => e.includes('example.com') || e === 'admin@impacthub.org');
    if (placeholders.length > 0) {
      console.warn(`⚠️  WARNING: ADMIN_EMAILS contains placeholder/test value(s): [${placeholders.join(', ')}]. Please configure real owner email in .env for production.`);
    }
  }

  console.log(`   Canonical URLs:`);
  console.log(`   - Home:        http://localhost:${PORT}/`);
  console.log(`   - Campaigns:   http://localhost:${PORT}/campaigns`);
  console.log(`   - Drives:      http://localhost:${PORT}/drives`);
  console.log(`   - NGOs:        http://localhost:${PORT}/ngos`);
  console.log(`   - Auth:        http://localhost:${PORT}/auth`);
  console.log(`   - Dashboard:   http://localhost:${PORT}/dashboard`);
  console.log(`   - Leaderboard: http://localhost:${PORT}/leaderboard`);
  console.log(`   - Dev Mailbox: http://localhost:${PORT}/dev-mailbox`);
  console.log(`======================================================\n`);
});

module.exports = { app, server, prisma };
