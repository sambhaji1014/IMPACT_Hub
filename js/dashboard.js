/**
 * HopeConnect AI - Dashboards & Analytics Manager (User Impact & NGO Organizer)
 * Fully Sanitized, XSS-Safe, and Resilient
 */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('userImpactDashboard')) {
    initUserImpactDashboard();
  }

  if (document.getElementById('organizerDashboard')) {
    initOrganizerDashboard();
  }
});

/* ==========================================================================
   User Impact Dashboard Logic (impact.html)
   ========================================================================== */
function initUserImpactDashboard() {
  renderUserStats();
  renderUserBadges();
  renderImpactCharts();
  renderUserActivityTables();

  window.addEventListener('hc:auth-changed', () => {
    renderUserStats();
    renderUserBadges();
    renderUserActivityTables();
  });
}

function renderUserStats() {
  const stats = window.HCStore.getUserStats();
  const badges = window.HCStore.getUserBadges();
  const unlockedCount = badges.filter(b => b.unlocked).length;

  const statCampaigns = document.getElementById('statCampaignsSupported');
  const statHours = document.getElementById('statVolunteerHours');
  const statDonated = document.getElementById('statTotalContributed');
  const statBadges = document.getElementById('statBadgesEarned');

  if (statCampaigns) statCampaigns.textContent = stats.campaignsSupported;
  if (statHours) statHours.textContent = `${stats.volunteerHours} hrs`;
  if (statDonated) statDonated.textContent = `₹${(Number(stats.totalContributed) || 0).toLocaleString('en-IN')}`;
  if (statBadges) statBadges.textContent = unlockedCount;
}

function renderUserBadges() {
  const badgesContainer = document.getElementById('badgesGridContainer');
  if (!badgesContainer) return;

  const badges = window.HCStore.getUserBadges();
  badgesContainer.innerHTML = badges.map(badge => `
    <div class="badge-card ${badge.unlocked ? 'unlocked' : 'locked'}" id="badgeCard-${window.escapeHTML(badge.id)}">
      <div class="badge-card-icon" aria-hidden="true">${window.escapeHTML(badge.icon)}</div>
      <h4>${window.escapeHTML(badge.title)}</h4>
      <p>${window.escapeHTML(badge.description)}</p>
      ${badge.unlocked 
        ? `<span class="badge-status-pill unlocked"><i class="fas fa-check-circle" aria-hidden="true"></i> Unlocked on ${window.escapeHTML(badge.unlockedAt || 'Aug 2026')}</span>`
        : `<button class="btn btn-sm btn-outline" onclick="unlockBadgePrompt('${window.escapeHTML(badge.id)}')"><i class="fas fa-lock" aria-hidden="true"></i> Click to Unlock</button>`
      }
    </div>
  `).join('');
}

window.unlockBadgePrompt = function(badgeId) {
  const badge = window.HCStore.unlockBadge(badgeId);
  if (badge) {
    window.showToast(`🎉 Achievement Unlocked: ${badge.title}!`, 'gold', 'fas fa-award');
    renderUserStats();
    renderUserBadges();

    if (typeof window.drawCertificate === 'function') {
      const u = window.HCStore.getCurrentUser();
      const stats = window.HCStore.getUserStats();
      window.drawCertificate(u ? u.name : 'Aarav Sharma', stats.volunteerHours);
    }
  }
};

function renderImpactCharts() {
  const trendCtx = document.getElementById('impactMonthlyChart');
  const causeCtx = document.getElementById('impactCategoryChart');

  if (typeof Chart === 'undefined') return;

  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'bar',
      data: {
        labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep (Est)'],
        datasets: [
          {
            label: 'Volunteer Hours',
            data: [8, 12, 6, 10, 12, 16],
            backgroundColor: '#E9B949',
            borderRadius: 6
          },
          {
            label: 'Donation (₹ in 100s)',
            data: [15, 20, 10, 15, 25, 30],
            backgroundColor: '#5B9A6A',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F0E4B8' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  if (causeCtx) {
    new Chart(causeCtx, {
      type: 'doughnut',
      data: {
        labels: ['Environment', 'Education', 'Healthcare', 'Animal Welfare'],
        datasets: [{
          data: [40, 30, 20, 10],
          backgroundColor: ['#5B9A6A', '#E9B949', '#4A8FE7', '#F28C5B']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
}

function renderUserActivityTables() {
  const regList = document.getElementById('userRegistrationsList');
  const donList = document.getElementById('userDonationsList');

  if (regList) {
    const registrations = window.HCStore.getUserRegistrations();
    if (registrations.length === 0) {
      regList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No volunteering activities yet. <a href="volunteer.html" style="color: var(--accent-orange); font-weight:600;">Explore opportunities</a></td></tr>`;
    } else {
      regList.innerHTML = registrations.map(reg => `
        <tr>
          <td><strong>${window.escapeHTML(reg.opportunityTitle)}</strong></td>
          <td>${window.escapeHTML(reg.ngoName)}</td>
          <td>${window.escapeHTML(reg.dateApplied)}</td>
          <td>
            <span class="badge-status-pill ${reg.status === 'Confirmed' || reg.status === 'Approved' ? 'unlocked' : 'locked'}">
              <i class="fas fa-check" aria-hidden="true"></i> ${window.escapeHTML(reg.status || 'Confirmed')}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }

  if (donList) {
    const donations = window.HCStore.getUserDonations();
    if (donations.length === 0) {
      donList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No donations recorded yet. <a href="campaigns.html" style="color: var(--accent-green); font-weight:600;">Support a cause</a></td></tr>`;
    } else {
      donList.innerHTML = donations.map(don => `
        <tr>
          <td>
            <strong>${window.escapeHTML(don.campaignTitle)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${window.escapeHTML(don.transactionId || 'TXN_HC_892144')}</div>
          </td>
          <td>${window.escapeHTML(don.ngoName)}</td>
          <td>${window.escapeHTML(don.date)}</td>
          <td>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
              <strong style="color: var(--accent-green);">₹${Number(don.amount || 0).toLocaleString('en-IN')}</strong>
              <button class="btn btn-sm btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="window.viewDonationReceiptById('${window.escapeHTML(don.id || don.transactionId)}')" aria-label="View receipt">
                <i class="fas fa-receipt" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.viewDonationReceiptById = function(donationId) {
  const donations = window.HCStore.getUserDonations();
  const sample = [
    { id: 'sample-1', transactionId: 'TXN_HC_941021', donorName: 'Sanjay Mehta', campaignTitle: 'Clean Water & Afforestation Project', date: '22 Aug 2026', amount: 5000, ngoName: 'Green Earth Foundation' },
    { id: 'sample-2', transactionId: 'TXN_HC_812390', donorName: 'Anita Roy', campaignTitle: 'Help Build a Digital Classroom', date: '19 Aug 2026', amount: 2500, ngoName: 'Green Earth Foundation' },
    { id: 'sample-3', transactionId: 'TXN_HC_610488', donorName: 'Kabir Sengupta', campaignTitle: 'Mobile Health Van', date: '14 Aug 2026', amount: 1000, ngoName: 'Green Earth Foundation' }
  ];
  const all = [...donations, ...sample];
  const found = all.find(d => d.id === donationId || d.transactionId === donationId);
  if (found) {
    window.openDonationReceiptModal(found);
  }
};

/* ==========================================================================
   Organizer Portal Dashboard Logic (dashboard.html)
   ========================================================================== */
function initOrganizerDashboard() {
  syncOrganizerSidebar();
  renderOrganizerMetrics();
  renderOverviewCards();
  renderOrganizerCampaignsTable();
  renderOrganizerVolunteersTable();
  renderOrganizerDonationsTable();
  renderOrganizerEventsTable();
  renderOrganizerAnalyticsCharts();
  initCampaignCreationForm();
  initDriveCreationForm();
  initSettingsForm();

  const currentHash = window.location.hash.replace('#', '') || 'overview';
  if (document.getElementById(`section-${currentHash}`)) {
    switchPortalTab(currentHash);
  }
}

function syncOrganizerSidebar() {
  const user = window.HCStore.getCurrentUser();
  const nameEl = document.getElementById('orgSidebarName');
  const locEl = document.getElementById('orgSidebarLocation');

  if (user && user.role === 'ngo' && user.orgName) {
    if (nameEl) nameEl.textContent = user.orgName;
    if (locEl) locEl.innerHTML = `<i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${window.escapeHTML(user.city || 'Pune, India')}`;
  }
}

window.switchPortalTab = function(tabName, event) {
  if (event) event.preventDefault();

  document.querySelectorAll('.portal-menu-item a').forEach(a => {
    if (a.getAttribute('href') === `#${tabName}`) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    } else {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.portal-section').forEach(sec => {
    if (sec.id === `section-${tabName}`) {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  });

  const titles = {
    overview: { title: 'Organizer Overview', sub: 'Manage your verified social campaigns, review volunteer applicants, and track donation milestones in real time.' },
    campaigns: { title: 'Managed Campaigns', sub: 'Monitor crowdfunding progress, edit campaign goals, and launch verified grassroots drives.' },
    volunteers: { title: 'Volunteer Applicants & Rosters', sub: 'Review skills, confirm availability, and approve participants for field drives.' },
    donations: { title: 'Donations Audit Log', sub: 'Complete financial ledger of contributions received with automated 80G receipts.' },
    events: { title: 'Volunteer Drives & Events', sub: 'Schedule community drives, set volunteer capacity, and manage on-site logistics.' },
    analytics: { title: 'Impact Analytics & Trends', sub: 'Longitudinal graphs, cause allocation breakdown, and volunteer retention metrics.' },
    settings: { title: 'Organization Profile & Settings', sub: 'Update official credentials, legal registrations, and public-facing NGO profile.' }
  };

  const titleEl = document.getElementById('portalSectionTitle');
  const subEl = document.getElementById('portalSectionSubtitle');
  if (titleEl && titles[tabName]) titleEl.textContent = titles[tabName].title;
  if (subEl && titles[tabName]) subEl.textContent = titles[tabName].sub;

  history.replaceState(null, null, `#${tabName}`);
};

function renderOrganizerMetrics() {
  const campaigns = window.HCStore.getCampaigns();
  const volunteers = window.HCStore.getUserRegistrations();
  const opps = window.HCStore.getOpportunities();
  
  const totalRaised = campaigns.reduce((sum, c) => sum + (Number(c.raised) || 0), 0);
  const totalVolunteersCount = 245 + volunteers.length;

  const statActiveCamp = document.getElementById('orgActiveCampaigns');
  const statVolunteers = document.getElementById('orgRegisteredVolunteers');
  const statFunds = document.getElementById('orgFundsRaised');
  const statDrives = document.getElementById('orgDrivesCount');

  if (statActiveCamp) statActiveCamp.textContent = campaigns.length;
  if (statVolunteers) statVolunteers.textContent = totalVolunteersCount;
  if (statFunds) statFunds.textContent = `₹${totalRaised.toLocaleString('en-IN')}`;
  if (statDrives) statDrives.textContent = opps.length;
}

function renderOverviewCards() {
  const campBody = document.getElementById('orgOverviewCampaignsBody');
  const volList = document.getElementById('orgOverviewVolunteersList');

  if (campBody) {
    const campaigns = window.HCStore.getCampaigns().slice(0, 3);
    campBody.innerHTML = campaigns.map(c => {
      const pct = Math.min(100, Math.round(((Number(c.raised) || 0) / (Number(c.goal) || 1)) * 100));
      return `
        <tr>
          <td>
            <strong>${window.escapeHTML(c.title)}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${window.escapeHTML(c.category)} • ₹${(Number(c.raised) || 0).toLocaleString('en-IN')}</div>
          </td>
          <td>
            <div class="progress-track" style="margin: 0 0 2px 0;">
              <div class="progress-bar" style="width: ${pct}%;"></div>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700;">${pct}%</span>
          </td>
          <td><span class="badge-status-pill unlocked"><i class="fas fa-check" aria-hidden="true"></i> Active</span></td>
        </tr>
      `;
    }).join('');
  }

  if (volList) {
    const applicants = window.HCStore.getUserRegistrations();
    const defaultSample = [
      { name: 'Rohan Deshmukh', opportunityTitle: 'Tree Plantation', status: 'Pending Review' },
      { name: 'Priya Nair', opportunityTitle: 'Math Mentorship', status: 'Pending Review' }
    ];
    const displayList = applicants.length ? applicants.slice(0, 3) : defaultSample;

    volList.innerHTML = displayList.map(v => `
      <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--bg-primary); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
        <div>
          <strong style="font-size: 0.88rem; display: block;">${window.escapeHTML(v.name)}</strong>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${window.escapeHTML(v.opportunityTitle)}</span>
        </div>
        <span class="badge-status-pill ${v.status === 'Approved' || v.status === 'Confirmed' ? 'unlocked' : 'locked'}" style="font-size: 0.72rem;">
          ${window.escapeHTML(v.status || 'Pending')}
        </span>
      </li>
    `).join('');
  }
}

function renderOrganizerCampaignsTable() {
  const tbody = document.getElementById('orgCampaignsTableBody');
  if (!tbody) return;

  const campaigns = window.HCStore.getCampaigns();
  tbody.innerHTML = campaigns.map(c => {
    const pct = Math.min(100, Math.round(((Number(c.raised) || 0) / (Number(c.goal) || 1)) * 100));
    return `
      <tr>
        <td>
          <strong>${window.escapeHTML(c.title)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${window.escapeHTML(c.category)} • ${window.escapeHTML(c.location)}</div>
        </td>
        <td>₹${(Number(c.raised) || 0).toLocaleString('en-IN')} / ₹${(Number(c.goal) || 0).toLocaleString('en-IN')}</td>
        <td style="width: 140px;">
          <div class="progress-track" style="margin: 0 0 4px 0;">
            <div class="progress-bar" style="width: ${pct}%;"></div>
          </div>
          <span style="font-size: 0.78rem; font-weight: 600;">${pct}% (${c.supporters || 0} Donors)</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <a href="campaigns.html" class="btn btn-sm btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" title="View Live Page">
              <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            </a>
            <button class="btn btn-sm btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; color: #DC3545;" onclick="window.deleteCampaignPrompt('${window.escapeHTML(c.id)}')" title="Delete Campaign">
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteCampaignPrompt = function(campId) {
  if (confirm('Are you sure you want to close and remove this campaign?')) {
    window.HCStore.deleteCampaign(campId);
    window.showToast('Campaign successfully removed.', 'info', 'fas fa-trash-alt');
    renderOrganizerMetrics();
    renderOverviewCards();
    renderOrganizerCampaignsTable();
  }
};

function renderOrganizerVolunteersTable() {
  const tbody = document.getElementById('orgVolunteersTableBody');
  if (!tbody) return;

  const applicants = window.HCStore.getUserRegistrations();
  const defaultSample = [
    { id: 'sample-1', name: 'Rohan Deshmukh', email: 'rohan.d@example.com', opportunityTitle: 'Mega Urban Tree Plantation Drive', skills: 'Physical Labor, Driving', status: 'Approved' },
    { id: 'sample-2', name: 'Priya Nair', email: 'priya.nair@example.com', opportunityTitle: 'Weekend Math & Coding Mentorship', skills: 'Teaching, Python', status: 'Approved' },
    { id: 'sample-3', name: 'Kunal Patil', email: 'kunal.p@example.com', opportunityTitle: 'Community Health Screening Assistant', skills: 'First Aid, Patient Care', status: 'Pending Review' }
  ];

  const allApplicants = [...applicants, ...defaultSample];

  tbody.innerHTML = allApplicants.map(v => `
    <tr>
      <td>
        <strong>${window.escapeHTML(v.name)}</strong>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${window.escapeHTML(v.email)}</div>
      </td>
      <td>${window.escapeHTML(v.opportunityTitle)}</td>
      <td>
        <span>${window.escapeHTML(v.skills || 'General Team Volunteer')}</span>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${window.escapeHTML(v.availability || 'Weekends')}</div>
      </td>
      <td>
        <span class="badge-status-pill ${v.status === 'Approved' || v.status === 'Confirmed' ? 'unlocked' : 'locked'}" id="statusPill-${window.escapeHTML(v.id)}">
          ${window.escapeHTML(v.status || 'Pending Review')}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 0.4rem;">
          ${v.status !== 'Approved' && v.status !== 'Confirmed' ? `
            <button class="btn btn-sm btn-green" style="padding: 0.3rem 0.65rem; font-size: 0.75rem;" onclick="window.approveVolunteer('${window.escapeHTML(v.id)}')">
              <i class="fas fa-check" aria-hidden="true"></i> Approve
            </button>
          ` : `
            <span style="font-size: 0.8rem; color: var(--accent-green); font-weight: 600;"><i class="fas fa-check-double" aria-hidden="true"></i> Verified</span>
          `}
          <a href="mailto:${encodeURIComponent(v.email)}?subject=HopeConnect%20Volunteering" class="btn btn-sm btn-outline" style="padding: 0.3rem 0.55rem; font-size: 0.75rem;" title="Email Volunteer">
            <i class="fas fa-envelope" aria-hidden="true"></i>
          </a>
        </div>
      </td>
    </tr>
  `).join('');
}

window.approveVolunteer = function(regId) {
  window.HCStore.updateRegistrationStatus(regId, 'Approved');
  window.showToast('✅ Volunteer applicant approved and notification sent!', 'success', 'fas fa-check-circle');
  renderOrganizerMetrics();
  renderOrganizerVolunteersTable();
  renderOverviewCards();
};

function renderOrganizerDonationsTable() {
  const tbody = document.getElementById('orgDonationsTableBody');
  if (!tbody) return;

  const donations = window.HCStore.getUserDonations();
  const sampleDonations = [
    { id: 'sample-don-1', transactionId: 'TXN_HC_941021', donorName: 'Sanjay Mehta', campaignTitle: 'Clean Water & Afforestation Project', date: '22 Aug 2026', amount: 5000, ngoName: 'Green Earth Foundation' },
    { id: 'sample-don-2', transactionId: 'TXN_HC_812390', donorName: 'Anita Roy', campaignTitle: 'Help Build a Digital Classroom', date: '19 Aug 2026', amount: 2500, ngoName: 'Green Earth Foundation' },
    { id: 'sample-don-3', transactionId: 'TXN_HC_610488', donorName: 'Kabir Sengupta', campaignTitle: 'Mobile Health Van', date: '14 Aug 2026', amount: 1000, ngoName: 'Green Earth Foundation' }
  ];

  const allDonations = [...donations, ...sampleDonations];

  tbody.innerHTML = allDonations.map(don => `
    <tr>
      <td><span style="font-family: monospace; font-size: 0.85rem; font-weight: 700;">${window.escapeHTML(don.transactionId || 'TXN_HC_892144')}</span></td>
      <td><strong>${window.escapeHTML(don.donorName || 'Anonymous Changemaker')}</strong></td>
      <td>${window.escapeHTML(don.campaignTitle)}</td>
      <td>${window.escapeHTML(don.date)}</td>
      <td><strong style="color: var(--accent-green);">₹${Number(don.amount || 0).toLocaleString('en-IN')}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" onclick="window.viewDonationReceiptById('${window.escapeHTML(don.id || don.transactionId)}')">
          <i class="fas fa-receipt" aria-hidden="true"></i> Receipt
        </button>
      </td>
    </tr>
  `).join('');
}

window.exportDonationsCSV = function() {
  const donations = window.HCStore.getUserDonations();
  const sample = [
    { transactionId: 'TXN_HC_941021', donorName: 'Sanjay Mehta', campaignTitle: 'Clean Water Project', date: '22 Aug 2026', amount: 5000 },
    { transactionId: 'TXN_HC_812390', donorName: 'Anita Roy', campaignTitle: 'Digital Classroom', date: '19 Aug 2026', amount: 2500 }
  ];
  const list = [...donations, ...sample];

  let csv = 'Transaction ID,Donor Name,Campaign Title,Date,Amount (INR)\n';
  list.forEach(d => {
    const cleanId = String(d.transactionId || '').replace(/"/g, '""');
    const cleanName = String(d.donorName || '').replace(/"/g, '""');
    const cleanCamp = String(d.campaignTitle || '').replace(/"/g, '""');
    const cleanDate = String(d.date || '').replace(/"/g, '""');
    csv += `"${cleanId}","${cleanName}","${cleanCamp}","${cleanDate}",${Number(d.amount) || 0}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HopeConnect_Donations_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('📥 CSV Donations Report downloaded successfully!', 'success', 'fas fa-file-download');
};

function renderOrganizerEventsTable() {
  const tbody = document.getElementById('orgEventsTableBody');
  if (!tbody) return;

  const opps = window.HCStore.getOpportunities();
  tbody.innerHTML = opps.map(opp => `
    <tr>
      <td>
        <strong>${window.escapeHTML(opp.title)}</strong>
        <div style="font-size: 0.78rem; color: var(--accent-orange); font-weight: 600;">${window.escapeHTML(opp.category)}</div>
      </td>
      <td><i class="fas fa-map-marker-alt" style="color: var(--text-muted);" aria-hidden="true"></i> ${window.escapeHTML(opp.location)}</td>
      <td>${window.escapeHTML(opp.date)}</td>
      <td>
        <span style="font-weight: 700; color: var(--accent-green);">${Number(opp.volunteersRegistered) || 0} / ${Number(opp.volunteersNeeded) || 20}</span>
      </td>
      <td>${window.escapeHTML(opp.skillLevel)}</td>
    </tr>
  `).join('');
}

function renderOrganizerAnalyticsCharts() {
  const trendCtx = document.getElementById('orgTrendChart');
  const catCtx = document.getElementById('orgCategoryChart');

  if (typeof Chart === 'undefined') return;

  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'Funds Raised (₹ in Thousands)',
            data: [25, 40, 55, 70, 95, 140, 220, 350],
            borderColor: '#5B9A6A',
            backgroundColor: 'rgba(91, 154, 106, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 4
          },
          {
            label: 'Volunteers Enrolled',
            data: [20, 35, 60, 90, 130, 175, 210, 245],
            borderColor: '#E9B949',
            backgroundColor: 'rgba(233, 185, 73, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F0E4B8' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  if (catCtx) {
    new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: ['Environment Restoration', 'Underprivileged Education', 'Rural Medical Vans', 'Artisan Micro-grants'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: ['#5B9A6A', '#E9B949', '#4A8FE7', '#F28C5B']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

function initCampaignCreationForm() {
  const form = document.getElementById('createCampaignForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('newCampTitle').value.trim();
    const category = document.getElementById('newCampCategory').value;
    const goal = document.getElementById('newCampGoal').value;
    const location = document.getElementById('newCampLocation').value.trim();
    const description = document.getElementById('newCampDescription').value.trim();
    const image = document.getElementById('newCampImage').value.trim() || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80';

    if (!title || !goal) {
      window.showToast('Please fill all required campaign fields.', 'error', 'fas fa-exclamation-triangle');
      return;
    }

    const orgName = document.getElementById('orgSidebarName').textContent || 'Green Earth Foundation';

    const newCampaign = window.HCStore.addCampaign({
      title,
      category,
      goal: Number(goal),
      raised: 0,
      supporters: 0,
      location,
      description,
      image,
      ngoName: orgName,
      featured: true
    });

    window.showToast(`🎉 Campaign "${newCampaign.title}" published successfully!`, 'success', 'fas fa-bullhorn');
    form.reset();
    window.closeModal('createCampaignModal');
    
    renderOrganizerMetrics();
    renderOverviewCards();
    renderOrganizerCampaignsTable();
  });
}

function initDriveCreationForm() {
  const form = document.getElementById('createDriveForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('newDriveTitle').value.trim();
    const category = document.getElementById('newDriveCategory').value;
    const volunteersNeeded = document.getElementById('newDriveVolunteersNeeded').value;
    const location = document.getElementById('newDriveLocation').value.trim();
    const date = document.getElementById('newDriveDate').value.trim();
    const skillLevel = document.getElementById('newDriveSkill').value.trim() || 'Beginner / Open for all';
    const description = document.getElementById('newDriveDesc').value.trim();

    const orgName = document.getElementById('orgSidebarName').textContent || 'Green Earth Foundation';

    const newOpp = window.HCStore.addOpportunity({
      title,
      category,
      volunteersNeeded: Number(volunteersNeeded) || 20,
      volunteersRegistered: 0,
      location,
      date,
      skillLevel,
      description,
      ngoName: orgName,
      image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80'
    });

    window.showToast(`✨ Volunteer Drive "${newOpp.title}" is now open for applications!`, 'success', 'fas fa-calendar-check');
    form.reset();
    window.closeModal('createDriveModal');

    renderOrganizerMetrics();
    renderOrganizerEventsTable();
  });
}

function initSettingsForm() {
  const form = document.getElementById('orgSettingsForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('settingsOrgName').value.trim();
    const category = document.getElementById('settingsOrgCategory').value;
    const location = document.getElementById('settingsOrgLocation').value.trim();
    const website = document.getElementById('settingsOrgWebsite').value.trim();
    const phone = document.getElementById('settingsOrgPhone').value.trim();
    const desc = document.getElementById('settingsOrgDesc').value.trim();

    window.HCStore.updateNGO('ngo-1', {
      name,
      category,
      location,
      website,
      phone,
      description: desc
    });

    const u = window.HCStore.getCurrentUser();
    if (u && u.role === 'ngo') {
      window.HCStore.updateUserProfile({ orgName: name, city: location });
    }

    syncOrganizerSidebar();
    window.showToast('✅ Organization settings saved successfully!', 'success', 'fas fa-check-circle');
  });
}
