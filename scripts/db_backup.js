/**
 * ImpactHub - Database Backup Utility
 * Usage: npm run db:backup
 * Creates a timestamped backup in /backups
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function backup() {
  const backupsDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.replace(/^file:/, '').replace(/\?.*/, '');
    let sourcePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(__dirname, '..', rawPath);
    if (!fs.existsSync(sourcePath)) {
      sourcePath = path.resolve(__dirname, '../prisma/dev.db');
    }

    if (!fs.existsSync(sourcePath)) {
      console.error(`❌ Source database file not found at: ${sourcePath}`);
      process.exit(1);
    }

    const backupFile = path.join(backupsDir, `backup_${timestamp}.db`);
    fs.copyFileSync(sourcePath, backupFile);
    const stats = fs.statSync(backupFile);

    console.log(`\n✅ Database Backup Created Successfully!`);
    console.log(`   Source:      ${sourcePath}`);
    console.log(`   Destination: ${backupFile}`);
    console.log(`   Size:        ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Timestamp:   ${timestamp}\n`);
  } else {
    // PostgreSQL backup note
    console.log(`\nℹ️  Configured for PostgreSQL: ${dbUrl.split('@')[1] || 'remote'}`);
    console.log(`   To dump PostgreSQL database in production, use standard pg_dump:`);
    console.log(`   pg_dump "${dbUrl}" > backups/postgres_dump_${timestamp}.sql\n`);
  }
}

backup().catch(err => {
  console.error('Backup error:', err.message);
  process.exit(1);
});
