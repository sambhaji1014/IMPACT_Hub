/**
 * ImpactHub - Admin Sign-In & Durability Diagnostics Script
 * Fulfills STEP 1 diagnosis requirements
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function diagnose() {
  console.log('======================================================');
  console.log('🔍 IMPACTHUB DIAGNOSTIC REPORT (STEP 1)');
  console.log('======================================================\n');

  // 1. ADMIN_EMAILS Parsing & Current Value
  console.log('--- 1. ADMIN_EMAILS Diagnosis ---');
  const rawAdminEmails = process.env.ADMIN_EMAILS;
  console.log('Raw process.env.ADMIN_EMAILS:', JSON.stringify(rawAdminEmails));
  
  // Current parsing in server/auth.js:
  // raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const currentParsed = (rawAdminEmails || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  
  // Robust parsing (with quote stripping):
  const robustParsed = (rawAdminEmails || '')
    .split(',')
    .map(e => e.replace(/['"]/g, '').trim().toLowerCase())
    .filter(Boolean);

  console.log('Current parser output:', currentParsed);
  console.log('Robust parser output (stripping quotes):', robustParsed);
  console.log(`Allow-list count: ${robustParsed.length} email(s)`);
  
  const placeholders = ['admin@impacthub.org', 'example.com', 'owner@impacthub.org'];
  const hasPlaceholders = robustParsed.some(e => placeholders.some(p => e.includes(p)));
  if (hasPlaceholders) {
    console.warn('⚠️  WARNING: ADMIN_EMAILS contains default placeholder email(s):', robustParsed.filter(e => placeholders.some(p => e.includes(p))));
  }
  if (robustParsed.length === 0) {
    console.warn('⚠️  CRITICAL: ADMIN_EMAILS is empty! No user can be granted ADMIN.');
  }

  // 2. Secret & Session Token Config
  console.log('\n--- 2. Secrets & Tokens Diagnosis ---');
  console.log('JWT_ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? 'SET (Length: ' + process.env.JWT_ACCESS_SECRET.length + ')' : 'MISSING (Using fallback default!)');
  console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? 'SET (Length: ' + process.env.JWT_REFRESH_SECRET.length + ')' : 'MISSING (Using fallback default!)');
  console.log('COOKIE_SECRET:', process.env.COOKIE_SECRET ? 'SET' : 'NOT SET in .env (cookieParser() called without secret)');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

  // 3. Storage Analysis (In-Memory vs Database)
  console.log('\n--- 3. Storage Location Audit (Memory vs Database) ---');
  console.log('• Dev Mailbox: ❌ IN-MEMORY (server/mailbox.js holds this.messages = []. Data LOST on server restart!)');
  console.log('• Email Verification Tokens: ⚠️ DATABASE (User.emailVerificationToken - PLAINTEXT, not hashed at rest)');
  console.log('• Password Reset Tokens: ⚠️ DATABASE (User.passwordResetToken - PLAINTEXT, not hashed at rest)');
  console.log('• Refresh Tokens: ⚠️ DATABASE (RefreshToken.token - PLAINTEXT, not hashed at rest, lacks userAgent/ip/revokedAt)');
  console.log('• Lockout Counters: ✅ DATABASE (User.failedLoginAttempts, User.lockedUntil)');
  console.log('• Rate Limiting: ⚠️ IN-MEMORY (express-rate-limit default MemoryStore)');

  // 4. Database Path & SQLite Stability
  console.log('\n--- 4. Database Storage & URL Analysis ---');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  const resolvedDbPath = path.resolve(process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('file:', '') : 'prisma/dev.db');
  console.log('Absolute SQLite DB Path:', resolvedDbPath);
  console.log('DB File Exists?:', fs.existsSync(resolvedDbPath));

  // 5. Inspect Current Database User Rows
  console.log('\n--- 5. Current User Rows in Database ---');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      isSuspended: true,
      createdAt: true
    }
  });

  if (users.length === 0) {
    console.log('Current DB User count: 0 (Database is currently clean/empty).');
  } else {
    console.table(users);
  }

  console.log('\n======================================================');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('======================================================\n');
}

diagnose()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
