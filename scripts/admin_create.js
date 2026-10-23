/**
 * ImpactHub - Owner Recovery CLI: Create or Update Admin User
 * Usage: npm run admin:create [-- --email admin@domain.com --password secret --force]
 */

const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const absDb = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${absDb}`;
}

const { PrismaClient } = require('@prisma/client');

const { parseAdminEmails } = require('../server/auth');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { email: null, password: null, force: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[++i].trim();
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[++i].trim();
    } else if (args[i] === '--force') {
      result.force = true;
    }
  }
  return result;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (!process.stdin.isTTY) {
      rl.question(question, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    // Interactive terminal masked input
    process.stdout.write(question);
    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let pwd = '';
    const onData = (ch) => {
      ch = String(ch);
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.setRawMode(oldRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(pwd);
      } else if (ch === '\u0003') {
        process.exit(1);
      } else if (ch === '\b' || ch === '\x7f') {
        if (pwd.length > 0) {
          pwd = pwd.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        pwd += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const { email: argEmail, password: argPassword, force } = parseArgs();

  if (isProd && !force) {
    console.error('\n❌ ERROR: Recovery tools refuse to run in production mode without the --force flag.\n');
    process.exit(1);
  }

  const allowList = parseAdminEmails(process.env.ADMIN_EMAILS);
  const targetEmail = (argEmail || allowList[0] || '').trim().toLowerCase();

  if (!targetEmail) {
    console.error('\n❌ ERROR: No email provided and ADMIN_EMAILS in .env is empty.\nProvide an email via --email <address>\n');
    process.exit(1);
  }

  let password = argPassword;
  if (!password) {
    password = await promptHidden(`Set admin password for ${targetEmail}: `);
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    console.error(`\n❌ ERROR: Password policy violation: ${policyError}\n`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    password = null; // Clear from memory

    const existing = await prisma.user.findFirst({
      where: { email: { equals: targetEmail } }
    });

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: 'admin',
          baseRole: existing.baseRole || 'volunteer',
          roles: JSON.stringify(['admin']),
          emailVerifiedAt: existing.emailVerifiedAt || new Date(),
          emailVerificationToken: null,
          emailVerificationTokenHash: null,
          lockedUntil: null,
          failedLoginAttempts: 0
        }
      });
      console.log(`\n✅ SUCCESS: Existing user updated to verified ADMIN: ${user.email}`);
    } else {
      user = await prisma.user.create({
        data: {
          name: 'Platform Administrator',
          email: targetEmail,
          passwordHash,
          role: 'admin',
          baseRole: 'admin',
          roles: JSON.stringify(['admin']),
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationTokenHash: null,
          city: 'Pune, Maharashtra',
          volunteerProfile: {
            create: { skills: 'Governance & Administration', level: 'Platinum' }
          }
        }
      });
      console.log(`\n✅ SUCCESS: Created verified ADMIN account: ${user.email}`);
    }

    console.log(`   User ID:     ${user.id}`);
    console.log(`   Role:        ${user.role}`);
    console.log(`   Verified At: ${user.emailVerifiedAt.toISOString()}`);
    console.log(`   Lockout:     Cleared (0 failed attempts)`);
    console.log(`   Note: Password securely hashed with bcrypt (cost 12) and never stored in plain logs.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error in admin:create:', err.message);
  process.exit(1);
});
