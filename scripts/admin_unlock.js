/**
 * ImpactHub - Owner Recovery CLI: Unlock Account
 * Usage: npm run admin:unlock -- --email user@domain.com [--force]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const absDb = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${absDb}`;
}

const { PrismaClient } = require('@prisma/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { email: null, force: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[++i].trim();
    } else if (args[i] === '--force') {
      result.force = true;
    }
  }
  return result;
}

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const { email: argEmail, force } = parseArgs();

  if (isProd && !force) {
    console.error('\n❌ ERROR: Recovery tools refuse to run in production mode without the --force flag.\n');
    process.exit(1);
  }

  const targetEmail = (argEmail || '').trim().toLowerCase();
  if (!targetEmail) {
    console.error('\n❌ ERROR: An email address is required. Usage: npm run admin:unlock -- --email user@example.com\n');
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

    const previousAttempts = user.failedLoginAttempts || 0;
    const wasLocked = user.lockedUntil && user.lockedUntil > new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    console.log(`\n✅ SUCCESS: Account unlocked for ${user.email}`);
    console.log(`   Previous Failed Attempts: ${previousAttempts}`);
    console.log(`   Previously Locked Until:  ${wasLocked ? user.lockedUntil.toISOString() : 'None (Not locked)'}`);
    console.log(`   Current Status:           UNLOCKED (failedLoginAttempts reset to 0)\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error in admin:unlock:', err.message);
  process.exit(1);
});
