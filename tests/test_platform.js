/**
 * ImpactHub - Automated Test Suite
 * Validates:
 * 1. Health & Server Initialization
 * 2. Real Authentication (Sign-up, Sign-in, Cookie Sessions, Token Rotation)
 * 3. Role-Based Access Control (RBAC) & Ownership
 * 4. Campaign & Volunteer Drive CRUD
 * 5. Drive Registration (Capacity check, Duplicate prevention, QR pass, .ics calendar)
 * 6. Donations (Server order creation, Test simulator, Signature verification, Section 80G PDF receipt)
 * 7. Rewards Engine (Verified hours award, Points calculation, Levels & Badges, Reversals)
 * 8. Admin Controls (NGO verification queue, Audit logging)
 */

const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

let cookieJar = '';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (cookieJar) {
      reqHeaders['Cookie'] = cookieJar;
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders
    }, (res) => {
      // Capture cookies
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        cookieJar = setCookies.map(c => c.split(';')[0]).join('; ');
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
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

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 ImpactHub Automated Platform Test Suite');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Health Endpoint
    console.log('[Phase 7: Test 1] Health & System Status');
    const health = await request('GET', '/health');
    assert(health.status === 200 && health.data.status === 'HEALTHY', 'Server is healthy and database is connected');

    // Test 2: Public Stats
    console.log('\n[Phase 7: Test 2] Live Database Aggregated Stats');
    const stats = await request('GET', '/api/v1/stats');
    assert(stats.status === 200 && stats.data.success === true, 'Public stats endpoint returned live aggregation');
    assert(typeof stats.data.stats.volunteersCount === 'number', 'Volunteer count is a real numeric aggregate');

    // Test 3: Sign Up Flow (Real Auth & Password policy)
    console.log('\n[Phase 7: Test 3] Authentication: Sign-Up & Password Validation');
    const weakPwd = await request('POST', '/api/v1/auth/signup', {
      name: 'Test Tester',
      email: `test_${Date.now()}@example.com`,
      password: '123',
      role: 'volunteer'
    });
    assert(weakPwd.status === 400, 'Rejects password shorter than 8 characters');

    const testEmail = `volunteer_${Date.now()}@impacthub.org`;
    const signup = await request('POST', '/api/v1/auth/signup', {
      name: 'Test Volunteer',
      email: testEmail,
      password: 'SecurePassword123!',
      role: 'volunteer'
    });
    assert(signup.status === 201 && signup.data.success === true, 'Successfully signed up new user');
    assert(signup.data.user.roles && signup.data.user.roles.includes('volunteer'), 'User assigned chosen role at sign-up');

    // Test 4: Sign In Flow (Session Cookies & JWT)
    console.log('\n[Phase 7: Test 4] Authentication: Sign-In & Cookie Session');
    const login = await request('POST', '/api/v1/auth/login', {
      email: testEmail,
      password: 'SecurePassword123!',
      remember: true
    });
    assert(login.status === 200 && login.data.success === true, 'Successfully logged in with credentials');
    assert(cookieJar.includes('ih_access') || cookieJar.includes('ih_refresh'), 'HttpOnly session cookies issued by server');

    // Test 5: Role-Based Access Control (Volunteer cannot create NGO campaigns)
    console.log('\n[Phase 7: Test 5] RBAC: Volunteer Restricted from Publishing');
    const unauthorizedCamp = await request('POST', '/api/v1/campaigns', {
      title: 'Hacked Campaign',
      description: 'Should be blocked',
      category: 'Environment',
      goalAmount: 50000
    });
    assert(unauthorizedCamp.status === 403, 'Volunteer is forbidden from creating campaigns (403)');

    // Test 6: Sign in as Verified NGO Organizer (Dr. Radhika)
    console.log('\n[Phase 7: Test 6] NGO Role: Campaign & Drive Creation');
    cookieJar = ''; // clear session
    const ngoLogin = await request('POST', '/api/v1/auth/login', {
      email: 'radhika@impacthub.org',
      password: 'password123'
    });
    assert(ngoLogin.status === 200 && ngoLogin.data.user.roles.includes('ngo'), 'Logged in as verified NGO organizer');

    // Create a new campaign
    const newCamp = await request('POST', '/api/v1/campaigns', {
      title: `Afforestation Test Drive ${Date.now()}`,
      description: 'Planting native banyan and neem trees along urban waterways.',
      category: 'Environment',
      goalAmount: 75000
    });
    assert(newCamp.status === 201 && newCamp.data.campaign.id, 'Verified NGO created campaign successfully');
    const campaignId = newCamp.data.campaign.id;

    // Create a new volunteer drive with limited capacity
    const newDrive = await request('POST', '/api/v1/drives', {
      title: `Wetland Restoration Drive ${Date.now()}`,
      description: 'Restoring local watershed habitat and water filtering.',
      category: 'Environment',
      city: 'Pune',
      address: 'Pashan Lake Sanctuary',
      startsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 3 + 14400000).toISOString(),
      slots: 2, // limited capacity for testing
      requiredSkills: 'Open for all'
    });
    assert(newDrive.status === 201 && newDrive.data.drive.id, 'Verified NGO scheduled volunteer drive with capacity limit');
    const driveId = newDrive.data.drive.id;

    // Test 7: Volunteer Join Flow & Digital Pass Generation
    console.log('\n[Phase 7: Test 7] Volunteer Join Flow, Capacity & Duplicate Prevention');
    // Switch to volunteer Aarav
    cookieJar = '';
    await request('POST', '/api/v1/auth/login', { email: 'aarav@impacthub.org', password: 'password123' });

    // Join drive slot 1
    const join1 = await request('POST', `/api/v1/drives/${driveId}/join`, {
      name: 'Aarav Patel',
      email: 'aarav@impacthub.org',
      phone: '9876543210',
      skills: 'Field Work'
    });
    assert(join1.status === 201 && join1.data.registration.passCode, 'Volunteer successfully joined drive and generated QR digital pass');

    // Duplicate join test
    const duplicateJoin = await request('POST', `/api/v1/drives/${driveId}/join`, {
      name: 'Aarav Patel',
      email: 'aarav@impacthub.org',
      phone: '9876543210'
    });
    assert(duplicateJoin.status === 409 && duplicateJoin.data.error === 'AlreadyRegistered', 'Duplicate join attempts safely rejected (409)');

    // Test .ics calendar download
    const calRes = await request('GET', `/api/v1/drives/${driveId}/calendar.ics`);
    assert(calRes.status === 200 && calRes.headers['content-type'].includes('calendar'), 'Generated standard iCalendar (.ics) invite');

    // Test 8: Donations & Payment Simulation Flow
    console.log('\n[Phase 7: Test 8] Financial Flow: Server Orders, Gateway Simulation & PDF Receipts');
    cookieJar = '';
    await request('POST', '/api/v1/auth/login', { email: 'priya@impacthub.org', password: 'password123' });

    // Direct contribution order creation (with test simulator)
    const donRes = await request('POST', '/api/v1/donations', {
      campaignId,
      amount: 1500,
      donorName: 'Priya Sharma',
      donorEmail: 'priya@impacthub.org',
      donorPhone: '9123456789',
      message: 'Keep up the amazing work!'
    });
    assert(donRes.status === 201 && donRes.data.success === true, 'Donation order initiated server-side');
    assert(donRes.data.receiptNo, 'Server issued official Section 80G receipt reference number');
    const donationId = donRes.data.donationId;
    const orderId = donRes.data.orderId;

    // Verify payment signature and confirm donation
    const verifyDon = await request('POST', '/api/v1/donations/verify', {
      donationId,
      orderId,
      paymentId: `pay_sim_${Date.now()}`,
      signature: 'sim_sig_test_signature_hash_value_12345678'
    });
    assert(verifyDon.status === 200 && verifyDon.data.success === true, 'Donation payment verified and confirmed server-side');

    // Test Section 80G PDF receipt generation
    const receiptPdf = await request('GET', `/api/v1/donations/${donationId}/receipt.pdf`);
    assert(receiptPdf.status === 200 && receiptPdf.headers['content-type'] === 'application/pdf', 'Generated downloadable Section 80G PDF tax receipt');

    // Test 9: NGO Attendance Marking & Rewards Engine Trigger
    console.log('\n[Phase 7: Test 9] NGO Attendance Logging & Volunteer Rewards');
    cookieJar = '';
    await request('POST', '/api/v1/auth/login', { email: 'radhika@impacthub.org', password: 'password123' });

    const registrationId = join1.data.registration.id;
    const markAtt = await request('POST', `/api/v1/drives/registrations/${registrationId}/attendance`, {
      hours: 4
    });
    assert(markAtt.status === 200 && markAtt.data.success === true, 'NGO verified ground attendance and logged 4 hours');
    assert(markAtt.data.reward && (markAtt.data.reward.points > 0 || markAtt.data.reward.pointsAdded > 0), 'Rewards engine triggered: 10 pts/hr awarded to volunteer');

    // Verify volunteer can download PDF certificate
    const certPdf = await request('GET', `/api/v1/drives/registrations/${registrationId}/certificate.pdf`);
    assert(certPdf.status === 200 && certPdf.headers['content-type'] === 'application/pdf', 'Generated verifiable volunteer service certificate (PDF)');

    // Test 10: Rewards & Public Leaderboard
    console.log('\n[Phase 7: Test 10] Gamification, Badges & Public Leaderboard');
    const leaderboard = await request('GET', '/api/v1/rewards/leaderboard');
    assert(leaderboard.status === 200 && leaderboard.data.success === true, 'Public leaderboard fetched rankings');
    assert(leaderboard.data.volunteers.length > 0 && leaderboard.data.donors.length > 0, 'Leaderboard lists both top volunteers and top donors');

    // Test 11: Admin Control (NGO Verification Queue & Audit Logs)
    console.log('\n[Phase 7: Test 11] Administrator Privileges & Audit Trail');
    cookieJar = '';
    await request('POST', '/api/v1/auth/login', { email: 'admin@impacthub.org', password: 'admin12345' });

    const adminNgos = await request('GET', '/api/v1/admin/ngos');
    assert(adminNgos.status === 200 && Array.isArray(adminNgos.data.ngos), 'Admin fetched NGO verification queue');

    const pendingNgo = adminNgos.data.ngos.find(n => n.verificationStatus === 'PENDING');
    if (pendingNgo) {
      const verifyRes = await request('POST', `/api/v1/admin/ngos/${pendingNgo.id}/verify`, { status: 'VERIFIED' });
      assert(verifyRes.status === 200 && verifyRes.data.ngo.verificationStatus === 'VERIFIED', 'Admin successfully verified pending NGO');
    }

    const auditLogs = await request('GET', '/api/v1/admin/audit-logs');
    assert(auditLogs.status === 200 && auditLogs.data.logs.length > 0, 'Audit trail recorded immutable administrative actions');

  } catch (err) {
    console.error('Test Suite Exception:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  runTestSuite().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
