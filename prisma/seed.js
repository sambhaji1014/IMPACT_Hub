/**
 * ImpactHub - Database Seed Script
 * Populates clearly labelled DEMO data for all 4 roles (Volunteer, Donor, NGO, Admin)
 * and initial system badges from rewards.config.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const rewardsConfig = require('../rewards.config');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ImpactHub database seed...');

  // 1. Seed System Badges
  console.log('Inserting rewards system badges...');
  const allBadges = [...rewardsConfig.volunteers.badges, ...rewardsConfig.donors.badges];
  for (const b of allBadges) {
    await prisma.badge.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description, icon: b.icon, criteria: b.criteria },
      create: { slug: b.slug, name: b.name, description: b.description, icon: b.icon, category: b.category, criteria: b.criteria }
    });
  }

  // 2. Check SEED_DEMO_DATA flag
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('ℹ️ SEED_DEMO_DATA is false or unset. Skipping demo users and initiatives. Badges initialized.');
    console.log('✅ Clean production database ready for real sign-up.');
    return;
  }

  // 2. Hash Passwords (Only for demo sample environment)
  const commonPasswordHash = await bcrypt.hash('password123', 12);
  const adminPasswordHash = await bcrypt.hash('admin12345', 12);

  // 3. Seed Users
  // User 1: Volunteer (Aarav)
  const volUser = await prisma.user.upsert({
    where: { email: 'aarav@impacthub.org' },
    update: {},
    create: {
      id: 'usr_vol_aarav',
      name: 'Aarav Patel',
      email: 'aarav@impacthub.org',
      passwordHash: commonPasswordHash,
      roles: JSON.stringify(['volunteer']),
      city: 'Pune, Maharashtra',
      bio: 'Passionate about urban tree plantations, river rejuvenation, and teaching municipal school students.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      emailVerifiedAt: new Date(),
      volunteerProfile: {
        create: {
          skills: 'Tree Planting, Community Mentorship, First Aid',
          interests: 'Environment, Education',
          availability: 'Weekends & Mornings',
          totalHours: 12,
          points: 170,
          level: 'Silver'
        }
      }
    }
  });

  // User 2: Donor (Priya)
  const donorUser = await prisma.user.upsert({
    where: { email: 'priya@impacthub.org' },
    update: {},
    create: {
      id: 'usr_don_priya',
      name: 'Priya Sharma',
      email: 'priya@impacthub.org',
      passwordHash: commonPasswordHash,
      roles: JSON.stringify(['donor']),
      city: 'Mumbai, Maharashtra',
      bio: 'Committed to empowering grassroots women cooperatives and rural healthcare infrastructure.',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      emailVerifiedAt: new Date(),
      donorProfile: {
        create: {
          totalDonated: 12500,
          points: 175,
          tier: 'Patron'
        }
      }
    }
  });

  // User 3: NGO Verified (Dr. Radhika Sen - Green Earth Foundation)
  const ngoUser = await prisma.user.upsert({
    where: { email: 'radhika@impacthub.org' },
    update: {},
    create: {
      id: 'usr_ngo_radhika',
      name: 'Dr. Radhika Sen',
      email: 'radhika@impacthub.org',
      passwordHash: commonPasswordHash,
      roles: JSON.stringify(['ngo']),
      city: 'Pune, Maharashtra',
      bio: 'Founding Director at Green Earth Foundation. 15 years in urban ecology and community afforestation.',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      emailVerifiedAt: new Date(),
      ngoProfile: {
        create: {
          id: 'ngo_green_earth',
          orgName: 'Green Earth Foundation',
          registrationNumber: 'MH/PUN/2017/04982',
          website: 'https://greenearth.demo.org',
          description: 'Grassroots environmental initiative dedicated to indigenous urban afforestation, Mutha river rejuvenation, and waste segregation.',
          cause: 'Environment',
          city: 'Pune',
          logo: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=150&auto=format&fit=crop&q=80',
          banner: 'assets/images/green-earth-banner.svg',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date('2026-01-15')
        }
      }
    }
  });

  // User 4: NGO Pending Verification (Pristine Rivers Trust)
  const pendingNgoUser = await prisma.user.upsert({
    where: { email: 'unverified@impacthub.org' },
    update: {},
    create: {
      id: 'usr_ngo_pending',
      name: 'Anil Deshmukh',
      email: 'unverified@impacthub.org',
      passwordHash: commonPasswordHash,
      roles: JSON.stringify(['ngo']),
      city: 'Nashik, Maharashtra',
      bio: 'Coordinator of Pristine Rivers Trust.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      emailVerifiedAt: new Date(),
      ngoProfile: {
        create: {
          id: 'ngo_pristine_rivers',
          orgName: 'Pristine Rivers Trust',
          registrationNumber: 'MH/NSK/2026/08129',
          website: 'https://pristinerivers.demo.org',
          description: 'Focusing on biological filtration and wastewater interception before discharge into river basins.',
          cause: 'Environment',
          city: 'Nashik',
          verificationStatus: 'PENDING'
        }
      }
    }
  });

  // User 5: Administrator
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@impacthub.org' },
    update: {},
    create: {
      id: 'usr_admin',
      name: 'System Administrator',
      email: 'admin@impacthub.org',
      passwordHash: adminPasswordHash,
      roles: JSON.stringify(['admin', 'volunteer', 'donor']),
      city: 'Bangalore, Karnataka',
      bio: 'ImpactHub Governance & Platform Operations Lead.',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      emailVerifiedAt: new Date()
    }
  });

  // Additional Demo NGOs
  const ngoProfiles = [
    {
      id: 'ngo_smile_edu',
      userId: volUser.id, // linked reference
      orgName: 'Smile Education Trust',
      registrationNumber: 'MH/MUM/2019/01294',
      website: 'https://smileeducation.demo.org',
      description: 'Empowering underprivileged youth through digital literacy, after-school STEM mentoring, and scholarships.',
      cause: 'Education',
      city: 'Mumbai',
      logo: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=150&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-02-10')
    },
    {
      id: 'ngo_health_bridge',
      userId: donorUser.id,
      orgName: 'HealthBridge Foundation',
      registrationNumber: 'DL/ND/2018/09214',
      website: 'https://healthbridge.demo.org',
      description: 'Preventive healthcare screenings, mobile diagnostic vans, and maternal wellness for rural communities.',
      cause: 'Healthcare',
      city: 'Delhi NCR',
      logo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=150&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-02-20')
    },
    {
      id: 'ngo_paws_care',
      userId: adminUser.id,
      orgName: 'Paws & Care Sanctuary',
      registrationNumber: 'KA/BLR/2021/04381',
      website: 'https://pawscare.demo.org',
      description: 'Emergency rescue, animal trauma clinic, and compassionate rehabilitation for street animals.',
      cause: 'Animal Welfare',
      city: 'Bengaluru',
      logo: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=150&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&auto=format&fit=crop&q=80',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-03-01')
    }
  ];

  for (const n of ngoProfiles) {
    const existing = await prisma.ngoProfile.findUnique({ where: { id: n.id } });
    if (!existing) {
      await prisma.ngoProfile.create({ data: n });
    }
  }

  // 4. Seed Demo Campaigns
  console.log('Inserting Demo Campaigns...');
  const demoCampaigns = [
    {
      id: 'camp_demo_1',
      ngoId: 'ngo_green_earth',
      title: 'Mutha River Native Biodiversity Corridor',
      description: 'Planting and maintaining 1,500 native saplings along the Mutha riverbank to halt soil erosion and restore native avian nesting corridors.',
      category: 'Environment',
      goalAmount: 150000,
      raisedAmount: 95000,
      deadline: new Date('2026-11-30'),
      images: JSON.stringify(['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80']),
      status: 'ACTIVE',
      location: 'Pune, Maharashtra',
      isDemo: true
    },
    {
      id: 'camp_demo_2',
      ngoId: 'ngo_smile_edu',
      title: 'Digital STEM Learning Kits for Ashram Schools',
      description: 'Supplying 350 interactive STEM experimentation kits, solar study lamps, and mathematics workbooks to tribal ashram schools in rural blocks.',
      category: 'Education',
      goalAmount: 200000,
      raisedAmount: 140000,
      deadline: new Date('2026-12-15'),
      images: JSON.stringify(['https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80']),
      status: 'ACTIVE',
      location: 'Nashik, Maharashtra',
      isDemo: true
    },
    {
      id: 'camp_demo_3',
      ngoId: 'ngo_health_bridge',
      title: 'Mobile Diagnostic Van for Rural Hamlets',
      description: 'Equipping a mobile diagnostic clinic with non-invasive vitals screening, vision tests, and emergency oxygen supply servicing 12 villages.',
      category: 'Healthcare',
      goalAmount: 300000,
      raisedAmount: 185000,
      deadline: new Date('2026-12-31'),
      images: JSON.stringify(['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80']),
      status: 'ACTIVE',
      location: 'Kolhapur, Maharashtra',
      isDemo: true
    },
    {
      id: 'camp_demo_4',
      ngoId: 'ngo_paws_care',
      title: 'Street Animal Trauma Care & Food Mission',
      description: 'Stocking veterinary emergency medical supplies and distributing 500 daily nutritious meals for injured stray animals in peri-urban Bangalore.',
      category: 'Animal Welfare',
      goalAmount: 80000,
      raisedAmount: 48000,
      deadline: new Date('2026-11-20'),
      images: JSON.stringify(['https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80']),
      status: 'ACTIVE',
      location: 'Bengaluru, Karnataka',
      isDemo: true
    }
  ];

  for (const c of demoCampaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      update: {},
      create: c
    });
  }

  // 5. Seed Demo Volunteer Drives
  console.log('Inserting Demo Volunteer Drives...');
  const demoDrives = [
    {
      id: 'drv_demo_1',
      ngoId: 'ngo_green_earth',
      title: 'Mega Urban Tree Plantation & Biodiversity Drive',
      description: 'Join hands to plant 500 indigenous saplings along Pune hillsides to combat microclimate heat islands and nurture native fauna.',
      category: 'Environment',
      city: 'Pune',
      address: 'Taljai Hills Eco Reserve, Sahakar Nagar, Pune',
      startsAt: new Date('2026-10-25T07:00:00Z'),
      endsAt: new Date('2026-10-25T11:00:00Z'),
      slots: 35,
      registeredCount: 24,
      requiredSkills: 'Beginner / Open for all. Sturdy shoes and outdoor attire recommended.',
      image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    },
    {
      id: 'drv_demo_2',
      ngoId: 'ngo_green_earth',
      title: 'Mula-Mutha Riverbank Cleanup & Plastic Interception',
      description: 'Intercept single-use plastics and non-biodegradable debris along the riverbank before degradation into downstream ecosystems.',
      category: 'Environment',
      city: 'Pune',
      address: 'Mutha Riverbed Promenade, Near Deccan Gymkhana, Pune',
      startsAt: new Date('2026-10-28T06:30:00Z'),
      endsAt: new Date('2026-10-28T10:00:00Z'),
      slots: 40,
      registeredCount: 31,
      requiredSkills: 'Open for all. Safety gloves and collection sacks provided.',
      image: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    },
    {
      id: 'drv_demo_3',
      ngoId: 'ngo_smile_edu',
      title: 'Weekend Foundational Coding & STEM Mentorship',
      description: 'Teach basic computer literacy, visual programming logic (Scratch), and fundamental algebra puzzles to municipal school students.',
      category: 'Education',
      city: 'Mumbai',
      address: 'Dharavi Community Learning Center, 90ft Road, Mumbai',
      startsAt: new Date('2026-11-01T10:00:00Z'),
      endsAt: new Date('2026-11-01T13:00:00Z'),
      slots: 18,
      registeredCount: 14,
      requiredSkills: 'Basic math and computer fundamentals. Empathy and mentoring patience.',
      image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    },
    {
      id: 'drv_demo_4',
      ngoId: 'ngo_health_bridge',
      title: 'Community Eye Screening & Vitals Triage Camp',
      description: 'Assist volunteer physicians with token queues, registration records, blood pressure checks, and vision screening triage for senior citizens.',
      category: 'Healthcare',
      city: 'Delhi NCR',
      address: 'East Delhi Community Center, Shakarpur, Delhi',
      startsAt: new Date('2026-11-04T08:30:00Z'),
      endsAt: new Date('2026-11-04T13:30:00Z'),
      slots: 25,
      registeredCount: 19,
      requiredSkills: 'Medical and non-medical volunteers welcome. Helpful attitude with elderly attendees.',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    },
    {
      id: 'drv_demo_5',
      ngoId: 'ngo_paws_care',
      title: 'Shelter Dog Socialization & Foster Adoption Day',
      description: 'Spend an uplifting Sunday grooming, exercising, walking, and socializing recovered rescued street dogs, and assisting prospective foster parents.',
      category: 'Animal Welfare',
      city: 'Bengaluru',
      address: 'Sarjapur Shelter Grounds, East Bengaluru',
      startsAt: new Date('2026-11-07T09:00:00Z'),
      endsAt: new Date('2026-11-07T12:30:00Z'),
      slots: 16,
      registeredCount: 13,
      requiredSkills: 'Affection for animals; comfortable handling leashed friendly dogs.',
      image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    },
    {
      id: 'drv_demo_6',
      ngoId: 'ngo_green_earth',
      title: 'Urban Seed Bomb Crafting Workshop & Hill Dispersal',
      description: 'Craft 2,000 native soil-and-compost seed balls embedded with peepal, banyan, and neem seeds for monsoon revegetation on degraded slopes.',
      category: 'Environment',
      city: 'Pune',
      address: 'Vetal Tekdi Base Camp, Senapati Bapat Road, Pune',
      startsAt: new Date('2026-11-12T08:00:00Z'),
      endsAt: new Date('2026-11-12T11:30:00Z'),
      slots: 30,
      registeredCount: 22,
      requiredSkills: 'Hands-on readiness to work with clay, compost, and seeds.',
      image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&auto=format&fit=crop&q=80',
      status: 'ACTIVE',
      isDemo: true
    }
  ];

  for (const d of demoDrives) {
    await prisma.drive.upsert({
      where: { id: d.id },
      update: {},
      create: d
    });
  }

  // 6. Sample Registration with Pass & Verified Hours for Aarav
  await prisma.driveRegistration.upsert({
    where: { driveId_volunteerId: { driveId: 'drv_demo_1', volunteerId: volUser.id } },
    update: {},
    create: {
      id: 'reg_demo_aarav_1',
      driveId: 'drv_demo_1',
      volunteerId: volUser.id,
      status: 'ATTENDED',
      hoursConfirmed: 4,
      passCode: 'IH-PASS-2026-9481',
      volunteerName: 'Aarav Patel',
      volunteerEmail: 'aarav@impacthub.org',
      volunteerPhone: '+91 98765 43210',
      skillsShared: 'Tree Planting'
    }
  });

  // Sample Upcoming Registration
  await prisma.driveRegistration.upsert({
    where: { driveId_volunteerId: { driveId: 'drv_demo_2', volunteerId: volUser.id } },
    update: {},
    create: {
      id: 'reg_demo_aarav_2',
      driveId: 'drv_demo_2',
      volunteerId: volUser.id,
      status: 'CONFIRMED',
      hoursConfirmed: 0,
      passCode: 'IH-PASS-2026-3829',
      volunteerName: 'Aarav Patel',
      volunteerEmail: 'aarav@impacthub.org',
      volunteerPhone: '+91 98765 43210',
      skillsShared: 'River Cleanup'
    }
  });

  // 7. Sample Completed Donation for Priya
  await prisma.donation.upsert({
    where: { receiptNo: 'IH-REC-2026-88192' },
    update: {},
    create: {
      id: 'don_demo_priya_1',
      campaignId: 'camp_demo_1',
      donorId: donorUser.id,
      donorName: 'Priya Sharma',
      donorEmail: 'priya@impacthub.org',
      donorPhone: '+91 91234 56789',
      amount: 2500,
      currency: 'INR',
      status: 'SUCCEEDED',
      gatewayOrderId: 'order_sim_8921a8c9e01',
      gatewayPaymentId: 'pay_sim_9210bf72a0',
      receiptNo: 'IH-REC-2026-88192',
      anonymous: false,
      message: 'In honor of sustainable green corridors for our children.',
      isSimulated: true
    }
  });

  // 8. Sample Badges granted to Aarav & Priya
  const firstDriveBadge = await prisma.badge.findUnique({ where: { slug: 'vol-first-drive' } });
  if (firstDriveBadge) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: volUser.id, badgeId: firstDriveBadge.id } },
      update: {},
      create: { userId: volUser.id, badgeId: firstDriveBadge.id }
    });
  }

  const firstGiftBadge = await prisma.badge.findUnique({ where: { slug: 'donor-first-gift' } });
  if (firstGiftBadge) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: donorUser.id, badgeId: firstGiftBadge.id } },
      update: {},
      create: { userId: donorUser.id, badgeId: firstGiftBadge.id }
    });
  }

  console.log('✅ ImpactHub database seed completed successfully!');
  console.log('   Demo Accounts created:');
  console.log('   - Volunteer: aarav@impacthub.org / password123');
  console.log('   - Donor:     priya@impacthub.org / password123');
  console.log('   - NGO:       radhika@impacthub.org / password123 (Verified: Green Earth Foundation)');
  console.log('   - NGO:       unverified@impacthub.org / password123 (Pending Verification)');
  console.log('   - Admin:     admin@impacthub.org / admin12345');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
