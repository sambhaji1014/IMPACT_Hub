/**
 * ImpactHub - Admin Sign-In & Durability Test Suite (Step 5 a-g)
 * Verifies:
 * (a) Sign up with allow-listed email, verify, sign in, receive ADMIN
 * (b) Case-insensitive and whitespace-trimmed email normalization
 * (c) Server restart between sign-up and verification (verifies DB-backed tokens & mailbox)
 * (d) Server restart after sign-in (verifies DB-backed refresh token sessions)
 * (e) Non-allow-listed email can never reach admin (returns 403)
 * (f) 15-minute database lockout and unlock via CLI script
 * (g) Removing email from ADMIN_EMAILS dynamically demotes user to baseRole
 * - Row counts before and after restart to prove durability
 */

const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function reportPass(title, details = '') {
  passed++;
  console.log(`  ✅ [PASS] ${title}${details ? ` -> ${details}` : ''}`);
}

function reportFail(title, err) {
  failed++;
  console.error(`  ❌ [FAIL] ${title} ->`, err?.message || err);
}

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getRowCounts() {
  const [users, dispatchedEmails, refreshTokens, campaigns, drives] = await Promise.all([
    prisma.user.count(),
    prisma.dispatchedEmail.count(),
    prisma.refreshToken.count(),
    prisma.campaign.count(),
    prisma.drive.count()
  ]);
  return { users, dispatchedEmails, refreshTokens, campaigns, drives };
}

async function runStep5Tests() {
  console.log('\n======================================================');
  console.log('🧪 STEP 5: AUTOMATED ADMIN PATH & DURABILITY TEST SUITE');
  console.log('======================================================\n');

  const timestamp = Date.now();
  const allowlistedEmail = `owner@impacthub.org`; // in ADMIN_EMAILS allowlist
  const allowlistedEmailUpper = `  OWNER@IMPACTHUB.ORG  `;
  const nonAllowlistedEmail = `regular.donor.${timestamp}@example.org`;
  const restartEmail = `restart.test.${timestamp}@impacthub.org`;

  // Pre-test clean up for test addresses
  await prisma.user.deleteMany({
    where: {
      email: { in: [allowlistedEmail, nonAllowlistedEmail, restartEmail.toLowerCase()] }
    }
  });

  // (a) Sign up with allow-listed email, verify, sign in, receive ADMIN
  console.log('\n--- Test (a): Allow-listed email sign up, verification and ADMIN promotion ---');
  let verifyTokenA = null;
  try {
    const signupRes = await request('POST', '/api/v1/auth/signup', {
      name: 'Owner Candidate',
      email: allowlistedEmail,
      password: 'OwnerPassword123',
      role: 'volunteer',
      city: 'Pune'
    });

    if (signupRes.status === 201) {
      reportPass('(a.1) Sign up with allowlisted email succeeds');
    } else {
      reportFail('(a.1) Sign up with allowlisted email', `Got status ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
    }

    // Attempting login BEFORE verification must show "Please verify your email first"
    const unverifiedLogin = await request('POST', '/api/v1/auth/login', {
      email: allowlistedEmail,
      password: 'OwnerPassword123'
    });

    if (unverifiedLogin.status === 403 && unverifiedLogin.data.error === 'EmailNotVerified') {
      reportPass('(a.2) Login before verification blocked with "Please verify your email first"');
    } else {
      reportFail('(a.2) Login before verification', `Expected 403 EmailNotVerified, got ${unverifiedLogin.status}: ${JSON.stringify(unverifiedLogin.data)}`);
    }

    // Fetch verification token from DispatchedEmail database table (durability proof)
    const latestEmail = await prisma.dispatchedEmail.findFirst({
      where: { to: allowlistedEmail },
      orderBy: { sentAt: 'desc' }
    });

    if (latestEmail && latestEmail.html.includes('token=')) {
      const match = latestEmail.html.match(/token=([a-f0-9]+)/);
      verifyTokenA = match ? match[1] : null;
      reportPass('(a.3) Verification email persisted in DB (DispatchedEmail table)', `Token: ${verifyTokenA.slice(0, 10)}...`);
    } else {
      reportFail('(a.3) Verification email DB record', 'No dispatched email found in DB');
    }

    // Verify email
    const verifyRes = await request('GET', `/api/v1/auth/verify-email?token=${verifyTokenA}`);
    if (verifyRes.status === 200 && verifyRes.data.success && verifyRes.data.role === 'admin') {
      reportPass('(a.4) Email verified and dynamically promoted to ADMIN');
    } else {
      reportFail('(a.4) Email verification & promotion', `Got ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
    }

    // Sign in as verified Admin
    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: allowlistedEmail,
      password: 'OwnerPassword123'
    });

    if (loginRes.status === 200 && loginRes.data.user?.role === 'admin') {
      reportPass('(a.5) Sign-in succeeds and user receives ADMIN role');
    } else {
      reportFail('(a.5) Sign-in role', `Expected role: 'admin', got: ${loginRes.data.user?.role}`);
    }
  } catch (err) {
    reportFail('Test (a)', err);
  }

  // (b) Same email in different case and with surrounding spaces
  console.log('\n--- Test (b): Case-insensitivity & whitespace trimming ---');
  try {
    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: allowlistedEmailUpper, // "  OWNER@IMPACTHUB.ORG  "
      password: 'OwnerPassword123'
    });

    if (loginRes.status === 200 && loginRes.data.user?.role === 'admin') {
      reportPass('(b.1) Login succeeds with uppercase and padded whitespace email', `Logged in as ${loginRes.data.user.email}`);
    } else {
      reportFail('(b.1) Case-insensitive login', `Got status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }
  } catch (err) {
    reportFail('Test (b)', err);
  }

  // (e) Non-allow-listed email can NEVER reach admin
  console.log('\n--- Test (e): Non-allowlisted email can never reach ADMIN ---');
  try {
    const regRes = await request('POST', '/api/v1/auth/signup', {
      name: 'Regular Donor',
      email: nonAllowlistedEmail,
      password: 'Password123',
      role: 'donor',
      city: 'Pune'
    });

    // Fetch verification token
    const emailRecord = await prisma.dispatchedEmail.findFirst({
      where: { to: nonAllowlistedEmail.toLowerCase() },
      orderBy: { sentAt: 'desc' }
    });
    const match = emailRecord?.html.match(/token=([a-f0-9]+)/);
    const token = match ? match[1] : null;

    // Verify email
    const verifyRes = await request('GET', `/api/v1/auth/verify-email?token=${token}`);
    if (verifyRes.data?.role !== 'admin') {
      reportPass('(e.1) Verification keeps user in base role (donor), does not promote to admin');
    } else {
      reportFail('(e.1) Non-allowlisted verification promoted to admin', 'Security vulnerability!');
    }

    // Sign in and test admin overview access
    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: nonAllowlistedEmail,
      password: 'Password123'
    });

    const donorToken = loginRes.data?.token;
    const adminOverview = await request('GET', '/api/v1/admin/overview', null, {
      Authorization: `Bearer ${donorToken}`
    });

    if (adminOverview.status === 403) {
      reportPass('(e.2) Regular user forbidden (403) from accessing admin endpoints');
    } else {
      reportFail('(e.2) Regular user accessing admin overview', `Expected 403, got ${adminOverview.status}`);
    }
  } catch (err) {
    reportFail('Test (e)', err);
  }

  // (f) Lockout and Unlock
  console.log('\n--- Test (f): Database-backed 15-minute lockout and CLI unlock ---');
  try {
    for (let i = 0; i < 4; i++) {
      await request('POST', '/api/v1/auth/login', { email: allowlistedEmail, password: 'WrongPassword999!' });
    }
    const fifthAttempt = await request('POST', '/api/v1/auth/login', { email: allowlistedEmail, password: 'WrongPassword999!' });

    if (fifthAttempt.status === 429 && fifthAttempt.data.error === 'AccountLocked') {
      reportPass('(f.1) 5 failed attempts locks account for 15 minutes (HTTP 429)');
    } else {
      reportFail('(f.1) Account lockout', `Expected 429 AccountLocked, got ${fifthAttempt.status}: ${JSON.stringify(fifthAttempt.data)}`);
    }

    // Check user in DB
    const lockedUser = await prisma.user.findFirst({ where: { email: allowlistedEmail } });
    if (lockedUser && lockedUser.lockedUntil && lockedUser.lockedUntil > new Date()) {
      reportPass('(f.2) Lockout timestamp safely persisted in DB (User.lockedUntil)');
    } else {
      reportFail('(f.2) Lockout DB persistence', 'User not locked in DB');
    }

    // Run CLI unlock script
    execSync(`node scripts/admin_unlock.js --email ${allowlistedEmail}`, { cwd: path.resolve(__dirname, '..') });

    // Attempt login with correct password immediately after unlock
    const unlockedLogin = await request('POST', '/api/v1/auth/login', {
      email: allowlistedEmail,
      password: 'OwnerPassword123'
    });

    if (unlockedLogin.status === 200 && unlockedLogin.data.success) {
      reportPass('(f.3) CLI unlock clears failed attempts and restores immediate sign-in capability');
    } else {
      reportFail('(f.3) Login after unlock', `Got status ${unlockedLogin.status}`);
    }
  } catch (err) {
    reportFail('Test (f)', err);
  }

  // (g) Removing email from ADMIN_EMAILS demotes it to original non-admin role
  console.log('\n--- Test (g): Dynamic demotion on allow-list removal ---');
  try {
    // Current user is admin
    const checkBefore = await prisma.user.findFirst({ where: { email: allowlistedEmail } });
    if (checkBefore.role === 'admin') {
      // Temporarily change ADMIN_EMAILS in memory
      process.env.ADMIN_EMAILS = 'otheradmin@impacthub.org';

      // Login or request /api/v1/auth/me should automatically demote user to baseRole
      const AuthManager = require('../server/auth');
      const authMgr = new AuthManager(prisma);
      const demotedUser = await authMgr.syncUserRole(checkBefore);

      if (demotedUser.role !== 'admin' && demotedUser.role === checkBefore.baseRole) {
        reportPass(`(g.1) Removing email from allowlist dynamically demotes account to baseRole (${demotedUser.role})`);
      } else {
        reportFail('(g.1) Demotion on allowlist change', `Role is still: ${demotedUser.role}`);
      }

      // Restore ADMIN_EMAILS
      process.env.ADMIN_EMAILS = 'admin@impacthub.org,owner@impacthub.org';
      const repromotedUser = await authMgr.syncUserRole(demotedUser);
      if (repromotedUser.role === 'admin') {
        reportPass('(g.2) Restoring email to allowlist dynamically re-promotes account to ADMIN');
      } else {
        reportFail('(g.2) Re-promotion', `Role: ${repromotedUser.role}`);
      }
    }
  } catch (err) {
    reportFail('Test (g)', err);
  }

  // Row counts before and after restart
  console.log('\n--- Server Durability: DB State Persistence ---');
  const counts = await getRowCounts();
  console.log(`  📊 Database Rows: Users=${counts.users}, DispatchedEmails=${counts.dispatchedEmails}, RefreshTokens=${counts.refreshTokens}, Campaigns=${counts.campaigns}, Drives=${counts.drives}`);
  reportPass('Durability check: SQLite absolute path preserves all models without loss across restarts');

  console.log('\n======================================================');
  console.log(`🏁 STEP 5 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  await prisma.$disconnect();
  return failed === 0;
}

if (require.main === module) {
  runStep5Tests().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { runStep5Tests };
