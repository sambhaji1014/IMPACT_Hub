// Comprehensive E2E Test Suite for ImpactHub
const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING IMPACTHUB INTEGRATION SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Public Stats
    const statsRes = await request('GET', '/api/stats');
    assert(statsRes.status === 200 && statsRes.body.success, 'GET /api/stats returns 200 and live data');
    assert(typeof statsRes.body.stats.verifiedNGOs === 'number', 'Stats contains verified NGO count');

    // 2. Public Campaigns & NGOs & Opportunities
    const campRes = await request('GET', '/api/campaigns');
    assert(campRes.status === 200 && campRes.body.campaigns.length > 0, 'GET /api/campaigns returns populated campaigns');
    const firstCampaign = campRes.body.campaigns[0];

    const ngoRes = await request('GET', '/api/ngos');
    assert(ngoRes.status === 200 && ngoRes.body.ngos.length > 0, 'GET /api/ngos returns populated NGOs');

    const oppRes = await request('GET', '/api/opportunities');
    assert(oppRes.status === 200 && oppRes.body.opportunities.length > 0, 'GET /api/opportunities returns opportunities');
    const firstOpp = oppRes.body.opportunities[0];

    // 3. Auth Rejection
    const badLogin = await request('POST', '/api/auth/login', { email: 'priya@impacthub.org', password: 'wrongpassword' });
    assert(badLogin.status === 401 && !badLogin.body.success, 'Login rejects invalid credentials with 401');

    // 4. Auth - Donor Login
    const donorLogin = await request('POST', '/api/auth/login', { email: 'priya@impacthub.org', password: 'password123' });
    assert(donorLogin.status === 200 && donorLogin.body.user.role === 'donor', 'Donor login succeeds with role "donor"');
    const donorToken = donorLogin.body.token;

    // 5. Auth - Volunteer Login
    const volLogin = await request('POST', '/api/auth/login', { email: 'aarav@impacthub.org', password: 'password123' });
    assert(volLogin.status === 200 && volLogin.body.user.role === 'volunteer', 'Volunteer login succeeds with role "volunteer"');
    const volToken = volLogin.body.token;

    // 6. Auth - NGO Login
    const ngoLogin = await request('POST', '/api/auth/login', { email: 'radhika@impacthub.org', password: 'password123' });
    assert(ngoLogin.status === 200 && ngoLogin.body.user.role === 'ngo', 'NGO login succeeds with role "ngo"');
    const ngoToken = ngoLogin.body.token;

    // 7. Role Authorization: Volunteer attempting to create campaign should be rejected
    const forbiddenCampaign = await request('POST', '/api/campaigns', {
      title: 'Hacked Campaign',
      cause: 'Education',
      target: 50000,
      description: 'Unauthorized attempt'
    }, volToken);
    assert(forbiddenCampaign.status === 403, 'Volunteer cannot create campaigns (403 Forbidden)');

    // 8. NGO Campaign Creation
    const newCampRes = await request('POST', '/api/campaigns', {
      title: 'Emergency Flood Relief Drive 2026',
      cause: 'Disaster Relief',
      target: 75000,
      description: 'Urgent supplies, clean drinking water, and dry rations for affected families.'
    }, ngoToken);
    assert(newCampRes.status === 201 && newCampRes.body.success, 'NGO can create campaign (201 Created)');
    const createdCampId = newCampRes.body.campaign.id;

    // 9. NGO Opportunity Creation
    const newOppRes = await request('POST', '/api/opportunities', {
      title: 'Weekend Ration Distribution Volunteer',
      cause: 'Disaster Relief',
      location: 'Pune Community Center, Maharashtra',
      date: '2026-11-05',
      time: '09:00 AM - 02:00 PM',
      volunteersNeeded: 25,
      description: 'Assist in packing and distributing emergency nutrition kits.'
    }, ngoToken);
    assert(newOppRes.status === 201 && newOppRes.body.success, 'NGO can create volunteer opportunity (201 Created)');
    const createdOppId = newOppRes.body.opportunity.id;

    // 10. Donor Simulated Donation Flow
    const initialRaised = firstCampaign.raised_amount || 0;
    const donRes = await request('POST', '/api/donations', {
      campaignId: firstCampaign.id,
      amount: 2500,
      paymentMethod: 'UPI (GPay / PhonePe)'
    }, donorToken);
    assert(donRes.status === 201 && donRes.body.success, 'Simulated donation succeeds with 201');
    assert(donRes.body.donation.receiptNumber && donRes.body.donation.isSimulated, 'Donation returns receipt number and marked as simulated');

    // Verify campaign total updated
    const updatedCampRes = await request('GET', '/api/campaigns');
    const foundCamp = updatedCampRes.body.campaigns.find(c => c.id === firstCampaign.id);
    assert(foundCamp.raised_amount === initialRaised + 2500, 'Campaign raised amount correctly incremented by donation');

    // Verify donor history
    const donorDonations = await request('GET', '/api/donations', null, donorToken);
    assert(donorDonations.status === 200 && donorDonations.body.donations.some(d => d.id === donRes.body.donation.id), 'Donation recorded in donor history');

    // 11. Volunteer Opportunity Application Flow
    const appRes = await request('POST', '/api/applications', {
      opportunityId: createdOppId,
      name: 'Aarav Patel',
      email: 'aarav@impacthub.org',
      phone: '+91 98765 43210',
      skills: 'First Aid, Logistics',
      availability: 'Confirmed Weekend'
    }, volToken);
    assert(appRes.status === 201 && appRes.body.success, 'Volunteer application submitted successfully (201 Created)');
    const createdAppId = appRes.body.application.id;

    // Duplicate Application Check
    const dupAppRes = await request('POST', '/api/applications', {
      opportunityId: createdOppId,
      name: 'Aarav Patel',
      email: 'aarav@impacthub.org'
    }, volToken);
    assert(dupAppRes.status === 409, 'Duplicate application blocked with 409 Conflict');

    // Volunteer sees their application
    const volAppsRes = await request('GET', '/api/applications', null, volToken);
    assert(volAppsRes.status === 200 && volAppsRes.body.applications.some(a => a.id === createdAppId), 'Volunteer dashboard sees submitted application');

    // NGO sees applications for its opportunity
    const ngoAppsRes = await request('GET', '/api/applications', null, ngoToken);
    assert(ngoAppsRes.status === 200 && ngoAppsRes.body.applications.some(a => a.id === createdAppId), 'NGO dashboard receives volunteer application');

    // NGO updates status to 'accepted'
    const statusRes = await request('PUT', `/api/applications/${createdAppId}/status`, { status: 'accepted' }, ngoToken);
    assert(statusRes.status === 200 && statusRes.body.success, 'NGO updates applicant status to accepted');

    // Volunteer cancels application
    const cancelRes = await request('DELETE', `/api/applications/${createdAppId}`, null, volToken);
    assert(cancelRes.status === 200 && cancelRes.body.success, 'Volunteer can cancel own registration');

    // 12. Contact Form Ticket Submission
    const contactRes = await request('POST', '/api/contact', {
      name: 'Ananya Sharma',
      email: 'ananya@example.org',
      subject: 'CSR Partnership Inquiry',
      message: 'We are interested in supporting education campaigns across rural districts.'
    });
    assert(contactRes.status === 201 && contactRes.body.ticketId.startsWith('IH-TKT-'), 'Contact form generates verifiable ticket ID');

    // 13. New User Registration Flow
    const randEmail = `newuser_${Date.now()}@example.org`;
    const signupRes = await request('POST', '/api/auth/signup', {
      name: 'Karan Mehra',
      email: randEmail,
      password: 'StrongPassword123!',
      role: 'donor',
      phone: '+91 99887 76655'
    });
    assert(signupRes.status === 201 && signupRes.body.token, 'New user signup creates hashed account and returns token');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();
