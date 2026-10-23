/**
 * ImpactHub - Owner Recovery CLI: Reset User Password
 * Usage: npm run admin:reset-password -- --email admin@domain.com [--password secret --force]
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

  const targetEmail = (argEmail || '').trim().toLowerCase();
  if (!targetEmail) {
    console.error('\n❌ ERROR: An email address is required. Usage: npm run admin:reset-password -- --email user@example.com\n');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: targetEmail } }
    });

    if (!user) {
      console.error(`\n❌ ERROR: No account found matching email: "${targetEmail}"\n`);
      process.exit(1);
    }

    let password = argPassword;
    if (!password) {
      password = await promptHidden(`Enter new password for ${user.email}: `);
    }

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      console.error(`\n❌ ERROR: Password policy violation: ${policyError}\n`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    password = null;

    // 1. Update password and clear lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordResetToken: null,
        passwordResetTokenHash: null,
        passwordResetExpires: null
      }
    });

    // 2. Revoke all active sessions
    const revoked = await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true, revokedAt: new Date() }
    });

    console.log(`\n✅ SUCCESS: Password reset for ${user.email}`);
    console.log(`   Account Lockout: Cleared`);
    console.log(`   Sessions Revoked: ${revoked.count} active refresh token(s) revoked`);
    console.log(`   User can now sign in with the new credentials.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error in admin:reset-password:', err.message);
  process.exit(1);
});
