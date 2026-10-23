/**
 * ImpactHub - Clean Database Reset Script
 * Purges all demo users, campaigns, drives, registrations, and transactions.
 * Initializes the clean database with core system badges.
 */

const { PrismaClient } = require('@prisma/client');
const rewardsConfig = require('../rewards.config');

const prisma = new PrismaClient();

async function resetCleanDb() {
  console.log('🧹 Purging all existing demo data and test accounts from database...');

  // Delete all relational records in dependency order
  await prisma.userBadge.deleteMany({});
  await prisma.rewardEvent.deleteMany({});
  await prisma.driveRegistration.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.contactMessage.deleteMany({});
  await prisma.drive.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.ngoProfile.deleteMany({});
  await prisma.volunteerProfile.deleteMany({});
  await prisma.donorProfile.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ All user and operational tables emptied.');

  // Initialize System Badges from rewards.config.js
  console.log('🏅 Seeding system badges...');
  const allBadges = [...rewardsConfig.volunteers.badges, ...rewardsConfig.donors.badges];
  for (const b of allBadges) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description, icon: b.icon, criteria: b.criteria },
      create: { slug: b.slug, name: b.name, description: b.description, icon: b.icon, category: b.category, criteria: b.criteria }
    });
  }

  console.log(`✅ ${allBadges.length} system badges active.`);
  console.log('🎉 Database is in a 100% clean, production-ready state with 0 users.');
}

if (require.main === module) {
  resetCleanDb()
    .catch((err) => {
      console.error('Reset DB Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { resetCleanDb };
