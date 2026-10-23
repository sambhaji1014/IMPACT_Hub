const puppeteer = require('puppeteer-core');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const AuthManager = require('../server/auth');
const authManager = new AuthManager(prisma);

async function diagnose() {
  // Find Sambhaji
  const sambhaji = await prisma.user.findUnique({
    where: { email: 'jadhavsambhaji2007@gmail.com' }
  });
  console.log('Found user in DB:', sambhaji?.name, sambhaji?.email, sambhaji?.role);

  // Generate real access token & refresh token
  const accessToken = authManager.generateAccessToken(sambhaji);
  const refreshData = await authManager.generateRefreshToken(sambhaji.id, true);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const networkLogs = [];

  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(`PAGE_ERROR: ${err.toString()}`));

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      networkLogs.push(`>> [REQ] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      let body = '';
      try {
        body = await res.text();
      } catch (e) {
        body = '<cannot read body>';
      }
      networkLogs.push(`<< [RES ${res.status()}] ${res.url()} -> ${body.slice(0, 300)}`);
    }
  });

  // Set cookies for localhost:5000
  await page.setCookie(
    {
      name: 'ih_access_token',
      value: accessToken,
      domain: 'localhost',
      path: '/'
    },
    {
      name: 'ih_refresh_token',
      value: refreshData.token,
      domain: 'localhost',
      path: '/'
    }
  );

  // Go to domain first to set localStorage
  await page.goto('http://localhost:5000/auth', { waitUntil: 'domcontentloaded' });
  await page.evaluate((user, token) => {
    localStorage.setItem('ih_token', token);
    localStorage.setItem('ih_user', JSON.stringify(user));
  }, {
    id: sambhaji.id,
    name: sambhaji.name,
    email: sambhaji.email,
    role: sambhaji.role
  }, accessToken);

  console.log('\nNavigating to http://localhost:5000/dashboard?tab=audit ...');
  await page.goto('http://localhost:5000/dashboard?tab=audit', { waitUntil: 'networkidle0' });

  // Wait 2 seconds for any async promises
  await new Promise(r => setTimeout(r, 2000));

  // Inspect DOM state
  const state = await page.evaluate(() => {
    const userName = document.getElementById('dashUserName')?.textContent?.trim();
    const userRoleBadge = document.getElementById('dashUserRoleBadge')?.textContent?.trim();
    const userMeta = document.getElementById('dashUserMeta')?.textContent?.trim();
    const navLinks = Array.from(document.querySelectorAll('.nav-links a')).map(a => ({
      text: a.textContent.trim(),
      href: a.getAttribute('href'),
      className: a.className
    }));
    const adminView = document.getElementById('adminDashboardView');
    const adminViewDisplay = adminView ? window.getComputedStyle(adminView).display : 'NOT_FOUND';
    const auditPane = document.getElementById('adminTabPaneAudit');
    const auditPaneDisplay = auditPane ? window.getComputedStyle(auditPane).display : 'NOT_FOUND';
    const ngosPane = document.getElementById('adminTabPaneNgos');
    const ngosPaneDisplay = ngosPane ? window.getComputedStyle(ngosPane).display : 'NOT_FOUND';

    return {
      userName,
      userRoleBadge,
      userMeta,
      adminViewDisplay,
      auditPaneDisplay,
      ngosPaneDisplay,
      navLinks
    };
  });

  console.log('\n========================================');
  console.log('📊 DOM STATE ON /dashboard?tab=audit:');
  console.log(JSON.stringify(state, null, 2));

  console.log('\n========================================');
  console.log('🌐 NETWORK ACTIVITY (/api/*):');
  networkLogs.forEach(l => console.log(l));

  console.log('\n========================================');
  console.log('📜 CONSOLE MESSAGES & ERRORS:');
  consoleMessages.forEach(m => console.log(m));
  pageErrors.forEach(e => console.error(e));

  await browser.close();
  await prisma.$disconnect();
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  prisma.$disconnect();
});
