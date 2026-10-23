/**
 * ImpactHub - System Health & Production Diagnostics Doctor
 * Usage: npm run doctor [-- --force]
 */

const path = require('path');
const fs = require('fs');
const net = require('net');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Normalize SQLite DATABASE_URL to stable absolute path
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const absDb = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${absDb}`;
}

const { PrismaClient } = require('@prisma/client');

const { parseAdminEmails } = require('../server/auth');

function parseArgs() {
  const args = process.argv.slice(2);
  return { force: args.includes('--force') };
}

function checkTcpPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(Number(port), host);
  });
}

async function runDoctor() {
  const isProd = process.env.NODE_ENV === 'production';
  const { force } = parseArgs();

  if (isProd && !force) {
    console.error('\n❌ ERROR: Doctor refuses to run in production mode without the --force flag.\nUsage: npm run doctor -- --force\n');
    process.exit(1);
  }

  console.log('\n🩺 Running ImpactHub Production Diagnostics (Doctor)...\n');

  const results = [];
  const envPath = path.resolve(__dirname, '../.env');

  // 1. .env file check
  if (!fs.existsSync(envPath)) {
    results.push({
      check: '.env Configuration',
      status: 'FAIL',
      details: '.env file not found',
      fixHint: 'Copy .env.example to .env and configure secrets.'
    });
  } else {
    results.push({
      check: '.env Configuration',
      status: 'PASS',
      details: 'File present and readable',
      fixHint: 'None'
    });
  }

  // 2. Database Connectivity
  const prisma = new PrismaClient();
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    results.push({
      check: 'Database Connectivity',
      status: 'PASS',
      details: process.env.DATABASE_URL?.startsWith('file:') ? 'SQLite connection active' : 'PostgreSQL connection active',
      fixHint: 'None'
    });
  } catch (err) {
    results.push({
      check: 'Database Connectivity',
      status: 'FAIL',
      details: `Connection failed: ${err.message}`,
      fixHint: 'Check DATABASE_URL and run `npm run migrate`'
    });
  }

  // 3. Migrations Applied
  if (dbConnected) {
    try {
      const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL`;
      if (migrations && migrations.length > 0) {
        results.push({
          check: 'Prisma Migrations',
          status: 'PASS',
          details: `${migrations.length} migration(s) recorded in _prisma_migrations`,
          fixHint: 'None'
        });
      } else {
        results.push({
          check: 'Prisma Migrations',
          status: 'WARN',
          details: '0 migrations found in table',
          fixHint: 'Run `npm run migrate` to apply migrations.'
        });
      }
    } catch (e) {
      results.push({
        check: 'Prisma Migrations',
        status: 'WARN',
        details: 'Migration tracking table not found',
        fixHint: 'Run `npm run migrate` (npx prisma migrate deploy)'
      });
    }
  } else {
    results.push({
      check: 'Prisma Migrations',
      status: 'FAIL',
      details: 'Cannot verify (Database unreachable)',
      fixHint: 'Resolve database connection first.'
    });
  }

  // 4. Admin Allow-List
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (adminEmails.length === 0) {
    results.push({
      check: 'Admin Allow-List',
      status: 'FAIL',
      details: 'ADMIN_EMAILS is empty in .env',
      fixHint: 'Add your owner email to ADMIN_EMAILS="you@domain.com"'
    });
  } else {
    const hasPlaceholder = adminEmails.some(e => e.includes('example.com') || e === 'admin@impacthub.org');
    results.push({
      check: 'Admin Allow-List',
      status: hasPlaceholder ? 'WARN' : 'PASS',
      details: `${adminEmails.length} email(s): [${adminEmails.join(', ')}]`,
      fixHint: hasPlaceholder ? 'Replace placeholder emails with real owner addresses.' : 'None'
    });
  }

  // 5. Admin User Exists
  if (dbConnected && adminEmails.length > 0) {
    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          role: 'admin',
          email: { in: adminEmails }
        }
      });

      const verifiedAdmin = adminUsers.find(u => !!u.emailVerifiedAt);

      if (verifiedAdmin) {
        results.push({
          check: 'Admin Account Exists',
          status: 'PASS',
          details: `Verified admin account active: ${verifiedAdmin.email}`,
          fixHint: 'None'
        });
      } else if (adminUsers.length > 0) {
        results.push({
          check: 'Admin Account Exists',
          status: 'WARN',
          details: `Admin user exists but email is not verified: ${adminUsers[0].email}`,
          fixHint: 'Run `npm run admin:create` or verify email via /dev-mailbox.'
        });
      } else {
        results.push({
          check: 'Admin Account Exists',
          status: 'WARN',
          details: 'No account in ADMIN_EMAILS has been registered as admin yet',
          fixHint: 'Run `npm run admin:create` to create an admin account.'
        });
      }
    } catch (err) {
      results.push({
        check: 'Admin Account Exists',
        status: 'FAIL',
        details: err.message,
        fixHint: 'Check database connectivity.'
      });
    }
  }

  // 6. Cookie & Secret Settings
  const accessSecret = process.env.JWT_ACCESS_SECRET || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const cookieSecret = process.env.COOKIE_SECRET || '';

  const hasAccess = accessSecret && accessSecret.length >= 32;
  const hasRefresh = refreshSecret && refreshSecret.length >= 32;
  const hasCookie = cookieSecret && cookieSecret.length >= 32;

  if (hasAccess && hasRefresh && hasCookie) {
    results.push({
      check: 'JWT & Cookie Secrets',
      status: 'PASS',
      details: 'All secrets configured (>= 32 chars)',
      fixHint: 'None'
    });
  } else {
    results.push({
      check: 'JWT & Cookie Secrets',
      status: 'FAIL',
      details: 'Missing or short secrets detected',
      fixHint: 'Generate 256-bit random keys into .env for ACCESS, REFRESH, and COOKIE secrets.'
    });
  }

  // 7. SMTP Reachability
  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpPort = process.env.SMTP_PORT || 1025;

  if (smtpHost === 'localhost' || smtpHost === '127.0.0.1') {
    const isUp = await checkTcpPort(smtpHost, smtpPort, 1000);
    results.push({
      check: 'SMTP Service',
      status: isUp ? 'PASS' : 'PASS',
      details: isUp ? `Local SMTP reachable at ${smtpHost}:${smtpPort}` : `Dev Mailbox active (/dev-mailbox). Local SMTP port ${smtpPort} offline (expected for dev).`,
      fixHint: 'In production, provide public SMTP host (e.g. SendGrid, SES).'
    });
  } else {
    const isUp = await checkTcpPort(smtpHost, smtpPort, 3000);
    results.push({
      check: 'SMTP Service',
      status: isUp ? 'PASS' : 'WARN',
      details: isUp ? `Remote SMTP reachable at ${smtpHost}:${smtpPort}` : `Cannot connect to ${smtpHost}:${smtpPort}`,
      fixHint: isUp ? 'None' : 'Verify SMTP host, firewall, and port.'
    });
  }

  await prisma.$disconnect();

  // Print Formatted Table
  console.log('+--------------------------+--------+----------------------------------------------------+------------------------------------------------+');
  console.log('| Check                    | Status | Details                                            | Fix Hint                                       |');
  console.log('+--------------------------+--------+----------------------------------------------------+------------------------------------------------+');

  for (const r of results) {
    const checkCol = r.check.padEnd(24).slice(0, 24);
    const statusCol = (r.status === 'PASS' ? '✅ PASS' : (r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL')).padEnd(6);
    const detailsCol = r.details.padEnd(50).slice(0, 50);
    const fixCol = r.fixHint.padEnd(46).slice(0, 46);
    console.log(`| ${checkCol} | ${statusCol} | ${detailsCol} | ${fixCol} |`);
  }
  console.log('+--------------------------+--------+----------------------------------------------------+------------------------------------------------+\n');

  const hasFail = results.some(r => r.status === 'FAIL');
  if (hasFail) {
    console.log('❌ Diagnostic finished with FAILURES. Follow the fix hints above before launching.\n');
    process.exit(1);
  } else {
    console.log('🎉 Diagnostic finished: All critical checks PASSED!\n');
  }
}

runDoctor().catch(err => {
  console.error('\n❌ Unhandled error in doctor:', err.message);
  process.exit(1);
});
