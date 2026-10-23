/**
 * ImpactHub - Multi-Role Dashboard Engine (Production Hardened)
 * Strictly isolated, per-account authorized experiences:
 * 1. Volunteers (Personal Applications, Digital Passes, PDF Certificates, Verified Hours, Gamification)
 * 2. Donors (Donation Ledger, Section 80G PDF Receipts, Tier Progress, Supported Campaigns)
 * 3. NGOs (Own Campaigns, Own Volunteer Drives, Participant Roster, Attendance Logging & Hours Awarding)
 * 4. Platform Admin (Platform Telemetry, NGO Verification Queue, User Suspension, Reports Moderation, Audit Trail)
 */

let currentUser = null;
let currentMeData = null;
let pendingAdminAction = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
});

async function initDashboard() {
  const metaEl = document.getElementById('dashUserMeta');
  const nameEl = document.getElementById('dashUserName');
  const roleBadgeEl = document.getElementById('dashUserRoleBadge');

  if (metaEl) {
    metaEl.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 0.5rem;"><i class="fas fa-spinner fa-spin" style="color: var(--accent-green);"></i> Loading user profile...</span>';
  }

  let loadError = null;

  try {
    currentUser = await window.ImpactHubAPI.fetchCurrentUser();
    if (!currentUser) {
      if (window.ImpactHubAPI.clearAuth) window.ImpactHubAPI.clearAuth();
      if (window.showToast) window.showToast('Session expired or unauthorized. Please sign in.', 'error');
      setTimeout(() => {
        window.location.href = '/auth?tab=signin&returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
      }, 500);
      return;
    }
  } catch (err) {
    console.error('Error loading profile in dashboard:', err);
    loadError = err;
    if (err.status === 401 || err.status === 403) {
      if (window.ImpactHubAPI.clearAuth) window.ImpactHubAPI.clearAuth();
      if (window.showToast) window.showToast('Authentication required. Please sign in.', 'error');
      setTimeout(() => {
        window.location.href = '/auth?tab=signin&returnTo=' + encodeURIComponent(window.location.pathname + window.location.search);
      }, 500);
      return;
    }
  } finally {
    if (!currentUser && loadError) {
      if (metaEl) {
        metaEl.innerHTML = `
          <div style="display: inline-flex; align-items: center; gap: 0.6rem; color: #DC2626; font-size: 0.88rem; flex-wrap: wrap;">
            <span><i class="fas fa-exclamation-triangle"></i> Failed to connect to server: ${window.escapeHTML(loadError.message || 'Connection error')}</span>
            <button class="btn btn-xs btn-outline" style="color: #DC2626; border-color: #DC2626; padding: 0.2rem 0.5rem;" onclick="initDashboard()">
              <i class="fas fa-redo"></i> Retry
            </button>
          </div>
        `;
      }
      return;
    }
  }

  // Render User Header & Role Controls
  renderDashboardHeader();

  // Check Email Verification Banner
  checkVerificationBanner();

  // Determine Primary Role
  const role = currentUser.role || 'volunteer';

  if (role === 'admin') {
    await renderAdminDashboard();
  } else {
    // If a non-admin is accessing an admin tab, remove query param
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (['overview', 'verification', 'audit', 'leaderboard', 'users', 'reports'].includes(tab)) {
      window.history.replaceState({}, '', '/dashboard');
    }
    if (role === 'ngo') {
      await renderNgoDashboard();
    } else if (role === 'donor') {
      await renderDonorDashboard();
    } else {
      await renderVolunteerDashboard();
    }
  }

  // Listen for custom platform events
  window.addEventListener('ih:data-reset', () => window.location.reload(), { once: true });
  window.addEventListener('ih:application-created', () => {
    if (currentUser && currentUser.role === 'volunteer') renderVolunteerApplications();
  });
  window.addEventListener('ih:donation-made', () => {
    if (currentUser && currentUser.role === 'donor') renderDonorHistory();
  });
}

function checkVerificationBanner() {
  const banner = document.getElementById('emailVerificationBanner');
  if (!banner) return;
  if (currentUser && !currentUser.emailVerified && !currentUser.emailVerifiedAt) {
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

window.handleResendVerification = async function() {
  const btn = document.getElementById('resendVerificationBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatching...';
  }

  try {
    const res = await window.ImpactHubAPI.resendVerification();
    window.showToast(res.message || 'Verification link dispatched! Check your email or /dev-mailbox.', 'success');
    
    // 60-second cooldown
    let countdown = 60;
    const interval = setInterval(() => {
      countdown--;
      if (btn) {
        btn.textContent = `Resend in ${countdown}s`;
        if (countdown <= 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> Resend Verification Link';
        }
      } else {
        clearInterval(interval);
      }
    }, 1000);
  } catch (err) {
    window.showToast(err.message || 'Failed to resend verification.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Resend Verification Link';
    }
  }
};

window.handleQuickVerify = async function() {
  const btn = document.getElementById('quickVerifyDashboardBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
  }
  try {
    const res = await fetch('/api/v1/auth/dev-quick-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser?.email })
    });
    const d = await res.json();
    if (res.ok && d.success) {
      window.showToast('Email verified successfully!', 'success');
      setTimeout(() => window.location.reload(), 400);
    } else {
      throw new Error(d.message || 'Verification failed');
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Retry Verify';
    }
    window.showToast(err.message, 'error');
  }
};

/**
 * Dashboard Header & Role Controls (No Persona Switcher)
 */
function renderDashboardHeader() {
  const nameEl = document.getElementById('dashUserName');
  const roleBadgeEl = document.getElementById('dashUserRoleBadge');
  const metaEl = document.getElementById('dashUserMeta');

  const role = currentUser.role || 'volunteer';

  const roleLabels = {
    volunteer: '🙋 Volunteer Changemaker',
    donor: '❤️ Verified Philanthropist',
    ngo: '🏢 NGO Organizer',
    admin: '🛡️ Platform Administrator'
  };

  if (nameEl) {
    const avatarHtml = currentUser.avatar
      ? `<img src="${window.escapeHTML(currentUser.avatar)}" alt="${window.escapeHTML(currentUser.name)}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-green); vertical-align: middle; margin-right: 0.65rem;">`
      : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; background: var(--accent-green-light); color: var(--accent-green); font-weight: 700; font-size: 1rem; margin-right: 0.65rem;"><i class="${role === 'admin' ? 'fas fa-user-shield' : (role === 'ngo' ? 'fas fa-building' : (role === 'donor' ? 'fas fa-hand-holding-heart' : 'fas fa-user'))}"></i></span>`;
    nameEl.innerHTML = `<span style="display: inline-flex; align-items: center;">${avatarHtml}<span>${window.escapeHTML(currentUser.name || 'User')}</span></span>`;
  }
  if (roleBadgeEl) {
    roleBadgeEl.innerHTML = roleLabels[role] || 'Member Account';
  }
  if (metaEl) {
    const location = currentUser.city || 'India';
    const email = currentUser.email;
    metaEl.innerHTML = `<i class="fas fa-map-marker-alt" style="color: var(--accent-green);"></i> ${window.escapeHTML(location)} &bull; <i class="fas fa-envelope"></i> ${window.escapeHTML(email)}`;
  }

  // Strict View Isolation: Show ONLY this role's view
  const volContainer = document.getElementById('volunteerDashboardView');
  const donContainer = document.getElementById('donorDashboardView');
  const ngoContainer = document.getElementById('ngoDashboardView');
  const adminContainer = document.getElementById('adminDashboardView');

  if (volContainer) volContainer.style.display = role === 'volunteer' ? 'block' : 'none';
  if (donContainer) donContainer.style.display = role === 'donor' ? 'block' : 'none';
  if (ngoContainer) ngoContainer.style.display = role === 'ngo' ? 'block' : 'none';
  if (adminContainer) adminContainer.style.display = role === 'admin' ? 'block' : 'none';
}

/**
 * =========================================================================
 * 1. VOLUNTEER DASHBOARD EXPERIENCE
 * =========================================================================
 */
async function renderVolunteerDashboard() {
  try {
    const data = await window.ImpactHubAPI.getMe('volunteer');
    currentMeData = data;
    renderVolunteerApplicationsFromData(data.registrations || []);
    renderVolunteerRewardsFromData(data.profile || {}, data.badges || []);
    renderVolunteerRecommendedDrives();

    // Populate profile form in volunteer view if present
    const profName = document.getElementById('volProfName');
    const profPhone = document.getElementById('volProfPhone');
    const profCity = document.getElementById('volProfCity');
    const profBio = document.getElementById('volProfBio');

    if (profName) profName.value = currentUser.name || '';
    if (profPhone) profPhone.value = currentUser.phone || '';
    if (profCity) profCity.value = currentUser.city || '';
    if (profBio) profBio.value = currentUser.bio || '';

    const form = document.getElementById('volProfileForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await window.ImpactHubAPI.updateMyProfile({
            name: profName.value,
            phone: profPhone.value,
            city: profCity.value,
            bio: profBio.value
          });
          window.showToast('Volunteer profile saved successfully!', 'success');
        } catch (err) {
          window.showToast('Profile update failed: ' + err.message, 'error');
        }
      };
    }
  } catch (err) {
    console.error('Error rendering volunteer dashboard:', err);
  }
}

function renderVolunteerRewardsFromData(profile, badges) {
  const hoursEl = document.getElementById('volStatHours');
  const ptsEl = document.getElementById('volStatPoints');
  const levelNameEl = document.getElementById('volLevelName');
  const nextLevelNameEl = document.getElementById('volNextLevelName');
  const progressTextEl = document.getElementById('volLevelProgressText');
  const progressBarEl = document.getElementById('volLevelProgressBar');

  const totalHours = profile.totalHours || 0;
  const points = profile.points || 0;
  const level = profile.level || 'Bronze Changemaker';

  if (hoursEl) hoursEl.textContent = `${totalHours} hrs`;
  if (ptsEl) ptsEl.textContent = `${points}`;
  if (levelNameEl) levelNameEl.textContent = level;

  // Level Progression: Bronze (0-15 hrs), Silver (15-40 hrs), Gold (40-100 hrs), Platinum (100+)
  let nextLevel = 'Silver Advocate';
  let targetHours = 15;
  let progress = 0;

  if (totalHours < 15) {
    nextLevel = 'Silver Advocate';
    targetHours = 15;
    progress = Math.min(100, Math.round((totalHours / 15) * 100));
  } else if (totalHours < 40) {
    nextLevel = 'Gold Leader';
    targetHours = 40;
    progress = Math.min(100, Math.round(((totalHours - 15) / 25) * 100));
  } else if (totalHours < 100) {
    nextLevel = 'Platinum Champion';
    targetHours = 100;
    progress = Math.min(100, Math.round(((totalHours - 40) / 60) * 100));
  } else {
    nextLevel = 'Legendary Guardian';
    targetHours = 200;
    progress = 100;
  }

  if (nextLevelNameEl) nextLevelNameEl.textContent = nextLevel;
  if (progressTextEl) progressTextEl.textContent = `${totalHours} / ${targetHours} hrs`;
  if (progressBarEl) progressBarEl.style.width = `${progress}%`;

  const badgesList = document.getElementById('volBadgesList');
  if (badgesList) {
    if (!badges || badges.length === 0) {
      badgesList.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-muted);">Join your first drive to earn recognition badges!</span>';
    } else {
      badgesList.innerHTML = badges.map(b => `
        <span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); padding: 0.4rem 0.75rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.4rem;">
          <i class="${b.icon || 'fas fa-award'}"></i> ${window.escapeHTML(b.name)}
        </span>
      `).join('');
    }
  }
}

function renderVolunteerApplicationsFromData(apps) {
  const tbody = document.getElementById('volApplicationsTbody');
  if (!tbody) return;

  const appliedEl = document.getElementById('volStatApplied');
  const confirmedEl = document.getElementById('volStatConfirmed');

  if (appliedEl) appliedEl.textContent = apps.length;
  if (confirmedEl) {
    const confirmedCount = apps.filter(a => a.status === 'CONFIRMED' || a.status === 'ATTENDED').length;
    confirmedEl.textContent = confirmedCount;
  }

  if (!apps || apps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          You have not applied for any volunteer drives yet. Explore upcoming initiatives to get involved!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = apps.map(app => {
    const isAttended = app.status === 'ATTENDED';
    const isConfirmed = app.status === 'CONFIRMED';
    const badgeColor = isAttended ? 'var(--accent-green)' : (isConfirmed ? '#2563EB' : '#D97706');
    const badgeBg = isAttended ? 'var(--accent-green-light)' : (isConfirmed ? '#EFF6FF' : '#FEF3C7');
    const statusText = isAttended ? 'Attended & Verified' : (isConfirmed ? 'Confirmed Spot' : 'Pending');

    const driveTitle = app.drive ? app.drive.title : 'Volunteer Drive';
    const ngoName = app.drive?.ngo?.orgName || 'Partner NGO';
    const driveDate = app.drive ? new Date(app.drive.startsAt).toLocaleDateString('en-IN') : 'Active';
    const driveLoc = app.drive ? `${app.drive.city} (${app.drive.address})` : 'Local';

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main); display: block;">${window.escapeHTML(driveTitle)}</strong>
          <span style="font-size: 0.8rem; color: var(--accent-green); font-weight: 600;"><i class="fas fa-building"></i> ${window.escapeHTML(ngoName)}</span>
        </td>
        <td>${driveDate}</td>
        <td>${window.escapeHTML(driveLoc)}</td>
        <td>
          <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 700;">
            <i class="fas fa-check-circle"></i> ${statusText}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button class="btn btn-xs btn-outline" onclick='window.openVolunteerPassModal(${JSON.stringify(app).replace(/'/g, "&apos;")})'>
              <i class="fas fa-qrcode"></i> Pass
            </button>
            ${isAttended ? `
              <a href="/api/v1/drives/registrations/${app.id}/certificate.pdf" target="_blank" class="btn btn-xs btn-green" title="Download Verified Service Certificate">
                <i class="fas fa-file-pdf"></i> Certificate
              </a>
            ` : `
              <a href="/api/v1/drives/${app.driveId}/calendar.ics" class="btn btn-xs btn-outline" title="Add to Calendar (.ics)">
                <i class="fas fa-calendar-plus"></i> .ics
              </a>
            `}
          </div>
        </td>
        <td>
          ${!isAttended ? `
            <button class="btn btn-xs btn-outline" style="color: #DC2626; border-color: #FECACA;" onclick="cancelVolunteerApp('${app.id}')">
              <i class="fas fa-times"></i> Cancel
            </button>
          ` : '<span style="font-size: 0.8rem; color: var(--accent-green); font-weight: 600;">Completed</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.cancelVolunteerApp = async function(appId) {
  if (confirm('Are you sure you want to cancel this drive registration?')) {
    try {
      await window.ImpactHubAPI.cancelApplication(appId);
      window.showToast('Registration cancelled successfully.', 'info');
      await renderVolunteerDashboard();
    } catch (e) {
      window.showToast('Cancel failed: ' + e.message, 'error');
    }
  }
};

async function renderVolunteerRecommendedDrives() {
  const container = document.getElementById('volRecommendedDrives');
  if (!container) return;

  try {
    const opps = await window.ImpactHubAPI.getOpportunities();
    const slice = (opps || []).slice(0, 3);
    if (slice.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No upcoming drives at this moment.</div>';
      return;
    }
    container.innerHTML = slice.map(o => `
      <div style="background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); font-size: 0.72rem; margin-bottom: 0.5rem; display: inline-block;">
            ${window.escapeHTML(o.category)}
          </span>
          <h4 style="font-size: 1rem; margin-bottom: 0.35rem; color: var(--text-main);">${window.escapeHTML(o.title)}</h4>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            <i class="fas fa-map-marker-alt" style="color: var(--accent-green);"></i> ${window.escapeHTML(o.city || o.location)}
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 0.75rem; margin-top: 0.75rem;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--accent-green);">${o.slotsRemaining || 5} spots left</span>
          <a href="/drives" class="btn btn-xs btn-primary">Join Drive</a>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

/**
 * =========================================================================
 * 2. DONOR DASHBOARD EXPERIENCE
 * =========================================================================
 */
async function renderDonorDashboard() {
  try {
    const data = await window.ImpactHubAPI.getMe('donor');
    currentMeData = data;

    renderDonorHistoryFromData(data.donations || []);
    renderDonorRewardsFromData(data.profile || {}, data.badges || []);
    renderDonorSavedCampaigns(data.savedCampaigns || []);

    const nameInput = document.getElementById('donorProfName');
    const phoneInput = document.getElementById('donorProfPhone');
    const cityInput = document.getElementById('donorProfCity');

    if (nameInput) nameInput.value = currentUser.name || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';
    if (cityInput) cityInput.value = currentUser.city || '';

    const form = document.getElementById('donorProfileForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await window.ImpactHubAPI.updateMyProfile({
            name: nameInput.value,
            phone: phoneInput.value,
            city: cityInput.value
          });
          window.showToast('Donor profile preferences updated.', 'success');
        } catch (err) {
          window.showToast('Profile error: ' + err.message, 'error');
        }
      };
    }
  } catch (err) {
    console.error('Error rendering donor dashboard:', err);
  }
}

function renderDonorRewardsFromData(profile, badges) {
  const ptsEl = document.getElementById('donorStatPoints');
  const tierNameEl = document.getElementById('donorTierName');
  const nextTierNameEl = document.getElementById('donorNextTierName');
  const progressTextEl = document.getElementById('donorTierProgressText');
  const progressBarEl = document.getElementById('donorTierProgressBar');

  const totalDonated = profile.totalDonated || 0;
  const points = profile.points || 0;
  const tier = profile.tier || 'Supporter';

  if (ptsEl) ptsEl.textContent = `${points}`;
  if (tierNameEl) tierNameEl.textContent = tier;

  // Tier Progression
  let nextTier = 'Silver Philanthropist';
  let targetAmount = 5000;
  let progress = 0;

  if (totalDonated < 5000) {
    nextTier = 'Silver Philanthropist';
    targetAmount = 5000;
    progress = Math.min(100, Math.round((totalDonated / 5000) * 100));
  } else if (totalDonated < 25000) {
    nextTier = 'Gold Benefactor';
    targetAmount = 25000;
    progress = Math.min(100, Math.round(((totalDonated - 5000) / 20000) * 100));
  } else if (totalDonated < 100000) {
    nextTier = 'Platinum Champion';
    targetAmount = 100000;
    progress = Math.min(100, Math.round(((totalDonated - 25000) / 75000) * 100));
  } else {
    nextTier = 'Visionary Luminary';
    targetAmount = 250000;
    progress = 100;
  }

  if (nextTierNameEl) nextTierNameEl.textContent = nextTier;
  if (progressTextEl) progressTextEl.textContent = `₹${totalDonated.toLocaleString('en-IN')} contributed (₹${Math.max(0, targetAmount - totalDonated).toLocaleString('en-IN')} to next tier)`;
  if (progressBarEl) progressBarEl.style.width = `${progress}%`;

  const badgesList = document.getElementById('donorBadgesList');
  if (badgesList) {
    if (!badges || badges.length === 0) {
      badgesList.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-muted);">Make your first cause contribution to earn donor badges!</span>';
    } else {
      badgesList.innerHTML = badges.map(b => `
        <span class="badge" style="background: #EFF6FF; color: #2563EB; padding: 0.4rem 0.75rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.4rem;">
          <i class="${b.icon || 'fas fa-heart'}"></i> ${window.escapeHTML(b.name)}
        </span>
      `).join('');
    }
  }
}

function renderDonorHistoryFromData(donations) {
  const tbody = document.getElementById('donorHistoryTbody');
  if (!tbody) return;

  const totalEl = document.getElementById('donorStatTotal');
  const countEl = document.getElementById('donorStatCount');

  const totalAmount = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  if (totalEl) totalEl.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (countEl) countEl.textContent = donations.length;

  if (!donations || donations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No donation records found yet. Explore our verified causes to make your first contribution!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = donations.map(d => {
    const title = d.campaign ? d.campaign.title : 'Community Campaign';
    const ngoName = d.campaign?.ngo?.orgName || 'Verified NGO';
    const amount = Number(d.amount) || 0;
    const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : 'Recent';
    const ref = d.receiptNo || d.referenceCode || d.id;

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main); display: block;">${window.escapeHTML(title)}</strong>
          <span style="font-size: 0.8rem; color: var(--accent-green);"><i class="fas fa-building"></i> ${window.escapeHTML(ngoName)}</span>
        </td>
        <td>${date}</td>
        <td><strong style="color: var(--accent-green);">₹${amount.toLocaleString('en-IN')}</strong></td>
        <td><code style="font-size: 0.8rem; font-weight: 700; background: var(--bg-primary); padding: 0.2rem 0.4rem; border-radius: 4px;">${ref}</code></td>
        <td><span class="badge" style="background: var(--accent-green-light); color: var(--accent-green);"><i class="fas fa-check-circle"></i> Succeeded</span></td>
        <td>
          <a href="/api/v1/donations/${d.id}/receipt.pdf" target="_blank" class="btn btn-xs btn-green" title="Download Official Section 80G Tax Receipt (PDF)">
            <i class="fas fa-file-pdf"></i> Receipt (PDF)
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function renderDonorSavedCampaigns(saved) {
  const container = document.getElementById('donorSupportedCampaigns');
  if (!container) return;

  if (!saved || saved.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No saved campaigns. Click the bookmark icon on any campaign to save it here!</div>';
    return;
  }

  container.innerHTML = saved.map(c => `
    <div style="background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); font-size: 0.72rem; margin-bottom: 0.5rem; display: inline-block;">
          ${window.escapeHTML(c.category)}
        </span>
        <h4 style="font-size: 1rem; margin-bottom: 0.35rem; color: var(--text-main);">${window.escapeHTML(c.title)}</h4>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          Goal: ₹${(c.goalAmount || 50000).toLocaleString('en-IN')} &bull; Raised: ₹${(c.raisedAmount || 0).toLocaleString('en-IN')}
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 0.75rem; margin-top: 0.75rem;">
        <a href="/campaigns" class="btn btn-xs btn-primary">Support</a>
      </div>
    </div>
  `).join('');
}

/**
 * =========================================================================
 * 3. NGO DASHBOARD EXPERIENCE (PER-ACCOUNT DATA)
 * =========================================================================
 */
async function renderNgoDashboard() {
  try {
    const data = await window.ImpactHubAPI.getMe('ngo');
    currentMeData = data;

    renderNgoVerificationAlert(data.profile || {});
    renderNgoMetricsFromData(data);
    renderNgoCampaignsFromData(data.campaigns || []);
    renderNgoDrivesFromData(data.drives || []);
    renderNgoApplicantsFromData(data.roster || []);
  } catch (err) {
    console.error('Error rendering NGO dashboard:', err);
  }
}

function renderNgoVerificationAlert(profile) {
  const alertEl = document.getElementById('ngoVerificationAlert');
  const noticeBadge = document.getElementById('ngoVerificationNoticeBadge');
  if (!alertEl) return;

  const status = profile.verificationStatus || 'PENDING';

  if (status === 'VERIFIED') {
    alertEl.innerHTML = `
      <div style="background: var(--accent-green-light); border: 1px solid var(--accent-green); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; color: var(--accent-green);">
        <i class="fas fa-check-circle" style="font-size: 1.25rem;"></i>
        <div>
          <strong>Verified Non-Profit (Section 12A/80G Compliant):</strong> Your entity credentials are confirmed by administrators. All campaigns and drives are live in public discovery.
        </div>
      </div>
    `;
    if (noticeBadge) {
      noticeBadge.style.display = 'inline-block';
      noticeBadge.className = 'badge';
      noticeBadge.style.background = 'var(--accent-green-light)';
      noticeBadge.style.color = 'var(--accent-green)';
      noticeBadge.innerHTML = '<i class="fas fa-check-circle"></i> Verified Non-Profit';
    }
  } else {
    alertEl.innerHTML = `
      <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; color: #B45309;">
        <i class="fas fa-hourglass-half" style="font-size: 1.25rem;"></i>
        <div>
          <strong>Verification Pending Platform Administrator Review:</strong> Your entity registration is under review. You can create draft campaigns and schedule drives; they will be published upon admin verification.
        </div>
      </div>
    `;
    if (noticeBadge) {
      noticeBadge.style.display = 'inline-block';
      noticeBadge.className = 'badge';
      noticeBadge.style.background = '#FEF3C7';
      noticeBadge.style.color = '#B45309';
      noticeBadge.innerHTML = '<i class="fas fa-clock"></i> Verification Pending';
    }
  }
}

function renderNgoMetricsFromData(data) {
  const campEl = document.getElementById('ngoStatCampaigns');
  const oppEl = document.getElementById('ngoStatOpportunities');
  const raisedEl = document.getElementById('ngoStatRaised');
  const applicantsStatEl = document.getElementById('ngoStatApplicants');

  if (campEl) campEl.textContent = (data.campaigns || []).length;
  if (oppEl) oppEl.textContent = (data.drives || []).length;

  const totalRaised = (data.campaigns || []).reduce((sum, c) => sum + (c.raisedAmount || 0), 0);
  if (raisedEl) raisedEl.textContent = `₹${totalRaised.toLocaleString('en-IN')}`;
  if (applicantsStatEl) applicantsStatEl.textContent = (data.roster || []).length;
}

function renderNgoCampaignsFromData(campaigns) {
  const container = document.getElementById('ngoCampaignsList');
  if (!container) return;

  if (!campaigns || campaigns.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); grid-column: 1/-1;">No published campaigns yet. Click "Create New Campaign" to start fundraising.</div>';
    return;
  }

  container.innerHTML = campaigns.map(c => `
    <div style="background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
      <span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); margin-bottom: 0.5rem; display: inline-block;">${window.escapeHTML(c.category)}</span>
      <h4 style="font-size: 1.1rem; margin-bottom: 0.35rem; color: var(--text-main);">${window.escapeHTML(c.title)}</h4>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        Goal: <strong>₹${(c.goalAmount || 50000).toLocaleString('en-IN')}</strong> &bull; Raised: <strong style="color: var(--accent-green);">₹${(c.raisedAmount || 0).toLocaleString('en-IN')}</strong>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <a href="/campaigns?campaign=${c.id}" class="btn btn-xs btn-outline"><i class="fas fa-eye"></i> View Public Page</a>
      </div>
    </div>
  `).join('');
}

function renderNgoDrivesFromData(drives) {
  const container = document.getElementById('ngoOpportunitiesList');
  if (!container) return;

  if (!drives || drives.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); grid-column: 1/-1;">No scheduled volunteer drives. Click "Create Volunteer Drive" to organize an initiative.</div>';
    return;
  }

  container.innerHTML = drives.map(o => `
    <div style="background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm);">
      <span class="badge" style="background: #EFF6FF; color: #2563EB; margin-bottom: 0.5rem; display: inline-block;">${window.escapeHTML(o.category)}</span>
      <h4 style="font-size: 1.1rem; margin-bottom: 0.35rem; color: var(--text-main);">${window.escapeHTML(o.title)}</h4>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
        <i class="fas fa-calendar-alt"></i> ${new Date(o.startsAt).toLocaleDateString('en-IN')} &bull; <i class="fas fa-map-marker-alt"></i> ${window.escapeHTML(o.city)}
      </div>
      <div style="font-size: 0.82rem; color: var(--accent-green); font-weight: 600; margin-bottom: 0.75rem;">
        ${o._count?.registrations || 0}/${o.capacity || 20} Volunteers Registered
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <a href="/drives" class="btn btn-xs btn-outline"><i class="fas fa-eye"></i> View Drive</a>
      </div>
    </div>
  `).join('');
}

function renderNgoApplicantsFromData(roster) {
  const tbody = document.getElementById('ngoApplicantsTbody');
  if (!tbody) return;

  if (!roster || roster.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No volunteers have registered for your drives yet.</td></tr>';
    return;
  }

  tbody.innerHTML = roster.map(a => {
    const isAttended = a.status === 'ATTENDED';
    const driveTitle = a.drive ? a.drive.title : 'Volunteer Drive';
    const volName = a.volunteer ? a.volunteer.name : 'Volunteer';
    const volEmail = a.volunteer ? a.volunteer.email : '';

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main);">${window.escapeHTML(volName)}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${window.escapeHTML(volEmail)}</div>
        </td>
        <td>${window.escapeHTML(driveTitle)}</td>
        <td><code style="font-size: 0.8rem; background: var(--bg-primary); padding: 0.2rem 0.4rem; border-radius: 4px;">${a.passCode || a.id}</code></td>
        <td>
          <span class="badge" style="background: ${isAttended ? 'var(--accent-green-light)' : '#EFF6FF'}; color: ${isAttended ? 'var(--accent-green)' : '#2563EB'};">
            ${isAttended ? 'Attended & Verified' : 'Confirmed'}
          </span>
        </td>
        <td>
          <input type="number" id="hours_${a.id}" value="${a.hoursVerified || 4}" min="1" max="24" style="width: 60px; padding: 0.2rem; border: 1px solid var(--border-light); border-radius: 4px; text-align: center;" ${isAttended ? 'disabled' : ''}>
        </td>
        <td>
          ${!isAttended ? `
            <button class="btn btn-xs btn-green" onclick="handleMarkAttendance('${a.id}')">
              <i class="fas fa-check"></i> Verify & Award Points
            </button>
          ` : `
            <span style="color: var(--accent-green); font-size: 0.82rem; font-weight: 600;">
              <i class="fas fa-award"></i> Verified (${a.hoursVerified} hrs)
            </span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

window.handleMarkAttendance = async function(regId) {
  const hoursInput = document.getElementById(`hours_${regId}`);
  const hours = hoursInput ? Number(hoursInput.value) || 4 : 4;

  try {
    const res = await window.ImpactHubAPI.markAttendance(regId, hours);
    window.showToast(`Verified! Awarded ${res.pointsEarned || 80} impact points to volunteer.`, 'success');
    await renderNgoDashboard();
  } catch (err) {
    window.showToast('Failed to mark attendance: ' + err.message, 'error');
  }
};

/**
 * =========================================================================
 * 4. ADMIN DASHBOARD EXPERIENCE (SUPER PORTAL)
 * =========================================================================
 */
let allAdminUsers = [];
let allAdminNgos = [];
let currentNgoStatusFilter = 'ALL';
let currentNgoSearch = '';
let auditState = {
  page: 1,
  limit: 15,
  search: '',
  action: 'ALL',
  startDate: '',
  endDate: ''
};
let currentLeaderboardCategory = 'volunteers';
let cachedLeaderboardData = null;
let adminTabListenersAttached = false;

async function renderAdminDashboard() {
  // Read target tab from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get('tab') || 'overview';

  // Attach tab navigation listeners once
  if (!adminTabListenersAttached) {
    adminTabListenersAttached = true;

    // Handle browser back / forward
    window.addEventListener('popstate', () => {
      if (currentUser && currentUser.role === 'admin') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'overview';
        switchAdminTab(tab, false);
      }
    });

    // Intercept clicks on nav-links pointing to /dashboard?tab=...
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href*="/dashboard?tab="], a[href="/dashboard"]');
      if (link && currentUser && currentUser.role === 'admin') {
        const href = link.getAttribute('href');
        const url = new URL(href, window.location.origin);
        if (url.pathname === '/dashboard') {
          e.preventDefault();
          const targetTab = url.searchParams.get('tab') || 'overview';
          switchAdminTab(targetTab, true);
        }
      }
    });
  }

  // Initial tab activation
  await switchAdminTab(requestedTab, false);

  // Background refresh of metrics for badge counts
  renderAdminOverviewMetrics(false).catch(console.warn);
}

window.switchAdminTab = async function(tabName, updateUrl = true) {
  const validTabs = ['overview', 'verification', 'audit', 'leaderboard', 'users', 'reports'];
  const targetTab = validTabs.includes(tabName) ? tabName : 'overview';

  // Update browser URL without full reload
  if (updateUrl) {
    const currentTabInUrl = new URLSearchParams(window.location.search).get('tab');
    if (currentTabInUrl !== targetTab) {
      const newUrl = `/dashboard?tab=${targetTab}`;
      window.history.pushState({ tab: targetTab }, '', newUrl);
    }
  }

  // Update Navbar active link highlight
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === `/dashboard?tab=${targetTab}` || (targetTab === 'overview' && href === '/dashboard')) {
      a.classList.add('active');
    } else if (href && href.startsWith('/dashboard')) {
      a.classList.remove('active');
    }
  });

  // Tab Panes & Buttons Mapping
  const panes = {
    overview: document.getElementById('adminTabPaneOverview'),
    verification: document.getElementById('adminTabPaneVerification'),
    audit: document.getElementById('adminTabPaneAudit'),
    leaderboard: document.getElementById('adminTabPaneLeaderboard'),
    users: document.getElementById('adminTabPaneUsers'),
    reports: document.getElementById('adminTabPaneReports')
  };

  const buttons = {
    overview: document.getElementById('adminTabBtnOverview'),
    verification: document.getElementById('adminTabBtnVerification'),
    audit: document.getElementById('adminTabBtnAudit'),
    leaderboard: document.getElementById('adminTabBtnLeaderboard'),
    users: document.getElementById('adminTabBtnUsers'),
    reports: document.getElementById('adminTabBtnReports')
  };

  // Toggle visibility and active states
  Object.keys(panes).forEach(key => {
    if (panes[key]) panes[key].style.display = key === targetTab ? 'block' : 'none';
    if (buttons[key]) buttons[key].classList.toggle('active', key === targetTab);
  });

  // Render panel specific content
  try {
    if (targetTab === 'overview') {
      await renderAdminOverviewMetrics(true);
    } else if (targetTab === 'verification') {
      await renderAdminNgoQueue();
    } else if (targetTab === 'audit') {
      await renderAdminAuditTrail();
    } else if (targetTab === 'leaderboard') {
      await renderAdminLeaderboard();
    } else if (targetTab === 'users') {
      await renderAdminUsersList();
    } else if (targetTab === 'reports') {
      await renderAdminReportsList();
    }
  } catch (err) {
    console.error(`Error loading admin tab ${targetTab}:`, err);
  }
};

/**
 * 4.1 Admin Overview Metrics
 */
async function renderAdminOverviewMetrics(showLoading = false) {
  const loadingEl = document.getElementById('adminOverviewLoading');
  const errorEl = document.getElementById('adminOverviewError');
  const contentEl = document.getElementById('adminOverviewContent');

  if (showLoading && loadingEl && contentEl) {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
  }

  try {
    const res = await window.ImpactHubAPI.getAdminData();
    if (!res.success || !res.metrics) {
      throw new Error(res.message || 'Malformed telemetry response');
    }

    const m = res.metrics;

    // Platform Users
    const usersEl = document.getElementById('adminStatUsers');
    const breakdownEl = document.getElementById('adminStatUserBreakdown');
    if (usersEl) usersEl.textContent = Number(m.totalUsers || 0).toLocaleString('en-IN');
    if (breakdownEl) {
      breakdownEl.textContent = `${m.volunteersCount || 0} Volunteers • ${m.donorsCount || 0} Donors • ${m.ngosCount || 0} NGOs`;
    }

    // NGO Counts
    const totalNgosEl = document.getElementById('adminStatTotalNgos');
    const vNgosEl = document.getElementById('adminStatVerifiedNgos');
    const pNgosEl = document.getElementById('adminStatPendingNgos');
    const pendingBadge = document.getElementById('adminPendingNgoBadge');

    const totalNgos = (m.verifiedNgos || 0) + (m.pendingNgos || 0) + (m.rejectedNgos || 0);
    if (totalNgosEl) totalNgosEl.textContent = totalNgos;
    if (vNgosEl) vNgosEl.textContent = m.verifiedNgos || 0;
    if (pNgosEl) pNgosEl.textContent = m.pendingNgos || 0;

    if (pendingBadge) {
      if ((m.pendingNgos || 0) > 0) {
        pendingBadge.textContent = m.pendingNgos;
        pendingBadge.style.display = 'inline-block';
      } else {
        pendingBadge.style.display = 'none';
      }
    }

    // Verified Donations
    const fundsEl = document.getElementById('adminStatFunds');
    const donationsCountEl = document.getElementById('adminStatDonationsCount');
    if (fundsEl) fundsEl.textContent = `₹${Number(m.totalDonated || 0).toLocaleString('en-IN')}`;
    if (donationsCountEl) {
      donationsCountEl.textContent = `${m.donationsCount || 0} Successful Transactions`;
    }

    // Service Hours
    const hoursEl = document.getElementById('adminStatVolunteerHours');
    const volunteersCountEl = document.getElementById('adminStatVolunteersCount');
    if (hoursEl) hoursEl.textContent = `${Number(m.volunteerHoursSum || 0).toLocaleString('en-IN')} hrs`;
    if (volunteersCountEl) {
      volunteersCountEl.textContent = `${m.volunteersCount || 0} Active Changemakers`;
    }

    // Live Campaigns & Drives
    const initiativesEl = document.getElementById('adminStatInitiatives');
    const campaignsDrivesEl = document.getElementById('adminStatCampaignsDrives');
    if (initiativesEl) initiativesEl.textContent = (m.campaignsCount || 0) + (m.drivesCount || 0);
    if (campaignsDrivesEl) {
      campaignsDrivesEl.textContent = `${m.campaignsCount || 0} Campaigns • ${m.drivesCount || 0} Drives`;
    }

    // System Audit Events & Reports
    const auditCountEl = document.getElementById('adminStatAuditLogsCount');
    const pendingReportsEl = document.getElementById('adminStatPendingReports');
    if (auditCountEl) auditCountEl.textContent = Number(m.totalAuditLogs || 0).toLocaleString('en-IN');
    if (pendingReportsEl) {
      pendingReportsEl.textContent = `${m.pendingReports || 0} Pending Flagged Reports`;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  } catch (err) {
    console.error('Failed to load admin overview metrics:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msg = document.getElementById('adminOverviewErrorMsg');
      if (msg) msg.textContent = `Failed to load overview data: ${err.message}`;
    }
  }
}

/**
 * 4.2 Non-Profit Verification Queue
 */
async function renderAdminNgoQueue() {
  const tbody = document.getElementById('adminNgosTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin" style="color: var(--accent-green); margin-right: 0.5rem;"></i> Loading verification queue from database...</td></tr>';

  try {
    const res = await window.ImpactHubAPI.getAdminNgos(currentNgoStatusFilter, currentNgoSearch);
    allAdminNgos = res.ngos || [];

    if (allAdminNgos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
            <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--accent-green); margin-bottom: 0.75rem; display: block;"></i>
            <strong style="color: var(--text-main); font-size: 1rem; display: block;">No NGOs Found</strong>
            <p style="margin: 0.35rem 0 0 0; font-size: 0.88rem;">There are no organization records matching filter "${currentNgoStatusFilter}" ${currentNgoSearch ? `and query "${currentNgoSearch}"` : ''}.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = allAdminNgos.map(n => {
      const isVerified = n.verificationStatus === 'VERIFIED';
      const isRejected = n.verificationStatus === 'REJECTED';
      const statusColor = isVerified ? 'var(--accent-green)' : (isRejected ? '#DC2626' : '#D97706');
      const statusBg = isVerified ? 'var(--accent-green-light)' : (isRejected ? '#FEE2E2' : '#FEF3C7');
      const escapedOrg = window.escapeHTML(n.orgName || 'Unnamed NGO');

      return `
        <tr>
          <td>
            <strong style="color: var(--text-main); display: block; font-size: 0.95rem;">${escapedOrg}</strong>
            <span style="font-size: 0.78rem; color: var(--text-muted);">
              <i class="fas fa-user"></i> ${window.escapeHTML(n.user?.name || 'Contact')} &bull; <i class="fas fa-envelope"></i> ${window.escapeHTML(n.user?.email || 'N/A')}
            </span>
          </td>
          <td>
            <code style="font-size: 0.82rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-light); font-weight: 600;">
              ${window.escapeHTML(n.registrationNumber || 'Pending')}
            </code>
          </td>
          <td>
            <strong>${window.escapeHTML(n.cause || 'General')}</strong>
            <span style="font-size: 0.78rem; color: var(--text-muted); display: block;"><i class="fas fa-map-marker-alt"></i> ${window.escapeHTML(n.city || 'India')}</span>
          </td>
          <td>
            ${n.website ? `
              <a href="${window.escapeHTML(n.website)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.82rem; color: var(--accent-green); text-decoration: none; font-weight: 600;">
                <i class="fas fa-external-link-alt"></i> Visit Site
              </a>
            ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">None provided</span>'}
          </td>
          <td>
            <span class="badge" style="background: ${statusBg}; color: ${statusColor}; font-weight: 700; padding: 0.3rem 0.6rem;">
              ${n.verificationStatus}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-xs btn-outline" onclick="viewAdminNgoDetails('${n.id}')" title="Inspect full profile and documentation">
                <i class="fas fa-eye"></i> Details
              </button>
              ${!isVerified ? `
                <button class="btn btn-xs btn-green" onclick="promptAdminNgoAction('${n.id}', 'VERIFIED', '${escapedOrg}')">
                  <i class="fas fa-check"></i> Approve
                </button>
              ` : ''}
              ${!isRejected ? `
                <button class="btn btn-xs btn-outline" style="color: #DC2626; border-color: #FECACA;" onclick="promptAdminNgoAction('${n.id}', 'REJECTED', '${escapedOrg}')">
                  <i class="fas fa-ban"></i> Reject
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load NGOs queue:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #DC2626; padding: 2rem;">
          <i class="fas fa-exclamation-triangle"></i> Error loading verification queue: ${window.escapeHTML(err.message)}
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-xs btn-outline" style="color: #DC2626; border-color: #DC2626;" onclick="renderAdminNgoQueue()">Retry</button>
          </div>
        </td>
      </tr>
    `;
  }
}

window.filterAdminNgoStatus = function(status) {
  currentNgoStatusFilter = status;
  ['Pending', 'Verified', 'Rejected', 'All'].forEach(key => {
    const btn = document.getElementById(`ngoFilter${key}`);
    if (btn) btn.classList.toggle('active', key.toUpperCase() === status);
  });
  renderAdminNgoQueue();
};

let ngoSearchTimeout = null;
window.handleAdminNgoSearch = function(q) {
  currentNgoSearch = q;
  clearTimeout(ngoSearchTimeout);
  ngoSearchTimeout = setTimeout(() => {
    renderAdminNgoQueue();
  }, 300);
};

window.viewAdminNgoDetails = function(ngoId) {
  const ngo = allAdminNgos.find(n => n.id === ngoId);
  if (!ngo) return;

  const createdDate = ngo.createdAt ? new Date(ngo.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  
  const content = `
    <div style="font-size: 0.92rem; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
        <div>
          <h4 style="margin: 0 0 0.2rem 0; font-size: 1.2rem; color: var(--text-main);">${window.escapeHTML(ngo.orgName)}</h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Registered on ${createdDate}</span>
        </div>
        <span class="badge" style="font-weight: 700; ${ngo.verificationStatus === 'VERIFIED' ? 'background: var(--accent-green-light); color: var(--accent-green);' : (ngo.verificationStatus === 'REJECTED' ? 'background: #FEE2E2; color: #DC2626;' : 'background: #FEF3C7; color: #D97706;')}">
          ${ngo.verificationStatus}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div>
          <strong style="color: var(--text-muted); font-size: 0.8rem; display: block;">Registration Number</strong>
          <code>${window.escapeHTML(ngo.registrationNumber || 'N/A')}</code>
        </div>
        <div>
          <strong style="color: var(--text-muted); font-size: 0.8rem; display: block;">Cause & Category</strong>
          <span>${window.escapeHTML(ngo.cause || 'General')}</span>
        </div>
        <div>
          <strong style="color: var(--text-muted); font-size: 0.8rem; display: block;">Location</strong>
          <span>${window.escapeHTML(ngo.city || 'India')}</span>
        </div>
        <div>
          <strong style="color: var(--text-muted); font-size: 0.8rem; display: block;">Official Website</strong>
          <span>${ngo.website ? `<a href="${window.escapeHTML(ngo.website)}" target="_blank" style="color: var(--accent-green);">${window.escapeHTML(ngo.website)}</a>` : 'Not provided'}</span>
        </div>
      </div>

      <div style="margin-bottom: 1rem; background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--radius-md);">
        <strong style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">Authorized Contact Person</strong>
        <div><strong>${window.escapeHTML(ngo.user?.name || 'Contact')}</strong> (${window.escapeHTML(ngo.user?.email || 'N/A')})</div>
        ${ngo.user?.phone ? `<div style="font-size: 0.82rem; color: var(--text-muted);"><i class="fas fa-phone"></i> ${window.escapeHTML(ngo.user.phone)}</div>` : ''}
      </div>

      ${ngo.mission ? `
        <div style="margin-bottom: 1rem;">
          <strong style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">Organization Mission</strong>
          <p style="margin: 0; font-size: 0.86rem; color: var(--text-main);">${window.escapeHTML(ngo.mission)}</p>
        </div>
      ` : ''}

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; pt: 1rem; border-top: 1px solid var(--border-light);">
        ${ngo.verificationStatus !== 'VERIFIED' ? `
          <button class="btn btn-sm btn-green" onclick="closeModal('adminNgoDetailsModal'); promptAdminNgoAction('${ngo.id}', 'VERIFIED', '${window.escapeHTML(ngo.orgName)}')">
            <i class="fas fa-check"></i> Approve Organization
          </button>
        ` : ''}
        ${ngo.verificationStatus !== 'REJECTED' ? `
          <button class="btn btn-sm btn-outline" style="color: #DC2626; border-color: #FECACA;" onclick="closeModal('adminNgoDetailsModal'); promptAdminNgoAction('${ngo.id}', 'REJECTED', '${window.escapeHTML(ngo.orgName)}')">
            <i class="fas fa-ban"></i> Reject Organization
          </button>
        ` : ''}
      </div>
    </div>
  `;

  let detailsModal = document.getElementById('adminNgoDetailsModal');
  if (!detailsModal) {
    detailsModal = document.createElement('div');
    detailsModal.id = 'adminNgoDetailsModal';
    detailsModal.className = 'modal-backdrop';
    detailsModal.innerHTML = `
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <h3 style="font-size: 1.15rem; color: var(--text-main);"><i class="fas fa-building" style="color: var(--accent-green);"></i> Organization Verification Details</h3>
          <button class="modal-close-btn" onclick="closeModal('adminNgoDetailsModal')">&times;</button>
        </div>
        <div class="modal-body" id="adminNgoDetailsBody"></div>
      </div>
    `;
    document.body.appendChild(detailsModal);
  }

  const bodyEl = document.getElementById('adminNgoDetailsBody');
  if (bodyEl) bodyEl.innerHTML = content;
  window.openModal('adminNgoDetailsModal');
};

/**
 * 4.3 Platform Security & System Audit Trail (Server-side Pagination & Filtering)
 */
async function renderAdminAuditTrail() {
  const tbody = document.getElementById('adminAuditTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin" style="color: #2563EB; margin-right: 0.5rem;"></i> Loading audit events from database...</td></tr>';

  try {
    const res = await window.ImpactHubAPI.getAdminAuditLogs(auditState);
    const logs = res.logs || [];
    const pagination = res.pagination || { page: 1, limit: auditState.limit, total: logs.length, totalPages: 1 };

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
            <i class="fas fa-search" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem; display: block;"></i>
            <strong style="color: var(--text-main); font-size: 1rem; display: block;">No Audit Logs Found</strong>
            <p style="margin: 0.35rem 0 0 0; font-size: 0.88rem;">No events match the specified action, search term, or date range.</p>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = logs.map(l => {
        const dt = new Date(l.createdAt);
        const formattedDate = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const formattedTime = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Action Badge Colors
        let actionBg = '#EFF6FF';
        let actionColor = '#2563EB';
        if (l.action.includes('VERIFY') || l.action.includes('RESTORE') || l.action === 'LOGIN') {
          actionBg = 'var(--accent-green-light)';
          actionColor = 'var(--accent-green)';
        } else if (l.action.includes('REJECT') || l.action.includes('SUSPEND') || l.action === 'LOGOUT') {
          actionBg = '#FEE2E2';
          actionColor = '#DC2626';
        } else if (l.action.includes('DONATION')) {
          actionBg = '#F0FDF4';
          actionColor = '#16A34A';
        } else if (l.action.includes('ROLE')) {
          actionBg = '#F5F3FF';
          actionColor = '#7C3AED';
        }

        const actorName = l.user ? `${window.escapeHTML(l.user.name)}` : 'System / Guest';
        const actorRole = l.user ? `${window.escapeHTML(l.user.role || 'user')}` : 'automated';

        return `
          <tr>
            <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
              <strong>${formattedDate}</strong>
              <div style="font-size: 0.75rem;">${formattedTime}</div>
            </td>
            <td>
              <span class="badge" style="background: ${actionBg}; color: ${actionColor}; font-weight: 700; font-size: 0.78rem;">
                ${window.escapeHTML(l.action)}
              </span>
            </td>
            <td>
              <strong style="color: var(--text-main); font-size: 0.86rem; display: block;">${actorName}</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${actorRole}</span>
            </td>
            <td>
              <span class="badge" style="background: var(--bg-primary); border: 1px solid var(--border-light); font-size: 0.78rem;">
                ${window.escapeHTML(l.entity || l.targetType || 'PLATFORM')}
              </span>
              ${l.entityId ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; font-family: monospace;">${window.escapeHTML(l.entityId.slice(0, 12))}...</div>` : ''}
            </td>
            <td style="font-size: 0.84rem; max-width: 280px; word-break: break-word;">
              ${window.escapeHTML(l.details || '')}
            </td>
            <td style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace; white-space: nowrap;">
              ${window.escapeHTML(l.ipAddress || '127.0.0.1')}
            </td>
          </tr>
        `;
      }).join('');
    }

    // Update Pagination UI
    const total = pagination.total || 0;
    const page = pagination.page || 1;
    const limit = pagination.limit || auditState.limit;
    const totalPages = Math.max(1, pagination.totalPages || Math.ceil(total / limit));

    const infoEl = document.getElementById('auditPaginationInfo');
    const indicatorEl = document.getElementById('auditPageIndicator');
    const prevBtn = document.getElementById('auditPrevBtn');
    const nextBtn = document.getElementById('auditNextBtn');

    if (infoEl) {
      const start = total === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, total);
      infoEl.textContent = `Showing ${start} - ${end} of ${total} entries`;
    }
    if (indicatorEl) indicatorEl.textContent = `Page ${page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

  } catch (err) {
    console.error('Failed to load audit logs:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #DC2626; padding: 2rem;">
          <i class="fas fa-exclamation-triangle"></i> Failed to retrieve audit logs: ${window.escapeHTML(err.message)}
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-xs btn-outline" style="color: #DC2626; border-color: #DC2626;" onclick="renderAdminAuditTrail()">Retry</button>
          </div>
        </td>
      </tr>
    `;
  }
}

window.applyAuditFilters = function() {
  const searchInput = document.getElementById('auditSearchInput');
  const actionFilter = document.getElementById('auditActionFilter');
  const startDate = document.getElementById('auditStartDate');
  const endDate = document.getElementById('auditEndDate');

  auditState.search = searchInput ? searchInput.value.trim() : '';
  auditState.action = actionFilter ? actionFilter.value : 'ALL';
  auditState.startDate = startDate ? startDate.value : '';
  auditState.endDate = endDate ? endDate.value : '';
  auditState.page = 1;

  renderAdminAuditTrail();
};

window.resetAuditFilters = function() {
  const searchInput = document.getElementById('auditSearchInput');
  const actionFilter = document.getElementById('auditActionFilter');
  const startDate = document.getElementById('auditStartDate');
  const endDate = document.getElementById('auditEndDate');

  if (searchInput) searchInput.value = '';
  if (actionFilter) actionFilter.value = 'ALL';
  if (startDate) startDate.value = '';
  if (endDate) endDate.value = '';

  auditState = {
    page: 1,
    limit: 15,
    search: '',
    action: 'ALL',
    startDate: '',
    endDate: ''
  };

  renderAdminAuditTrail();
};

window.changeAuditPage = function(delta) {
  auditState.page = Math.max(1, auditState.page + delta);
  renderAdminAuditTrail();
};

window.exportAdminAuditLogsCSV = function() {
  const params = new URLSearchParams();
  params.append('format', 'csv');
  if (auditState.search) params.append('search', auditState.search);
  if (auditState.action && auditState.action !== 'ALL') params.append('action', auditState.action);
  if (auditState.startDate) params.append('startDate', auditState.startDate);
  if (auditState.endDate) params.append('endDate', auditState.endDate);

  window.location.href = `/api/v1/admin/audit-logs?${params.toString()}`;
};

/**
 * 4.4 Impact Leaderboard (Ranked Volunteers, Donors, NGOs)
 */
async function renderAdminLeaderboard(forceRefresh = false) {
  const container = document.getElementById('adminLeaderboardContainer');
  if (!container) return;

  if (!cachedLeaderboardData || forceRefresh) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--accent-green); margin-bottom: 0.75rem;"></i>
        <p style="margin: 0;">Calculating leaderboard rankings from verified database metrics...</p>
      </div>
    `;

    try {
      cachedLeaderboardData = await window.ImpactHubAPI.getAdminLeaderboard();
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #DC2626; background: #FEE2E2; border-radius: var(--radius-md);">
          <i class="fas fa-exclamation-triangle"></i> Failed to load leaderboard: ${window.escapeHTML(err.message)}
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-sm btn-outline" style="color: #DC2626; border-color: #DC2626;" onclick="renderAdminLeaderboard(true)">Retry</button>
          </div>
        </div>
      `;
      return;
    }
  }

  const d = cachedLeaderboardData;
  const list = d[currentLeaderboardCategory] || [];

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fas fa-trophy" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
        <p style="margin: 0; font-size: 0.95rem;">No ranking data recorded yet in category "${currentLeaderboardCategory}".</p>
      </div>
    `;
    return;
  }

  // Render Table based on selected category
  if (currentLeaderboardCategory === 'volunteers') {
    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="custom-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Volunteer Changemaker</th>
              <th>Location</th>
              <th>Verified Service</th>
              <th>Impact Points</th>
              <th>Badge Tier</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(v => {
              const rankBadge = v.rank === 1 ? '🥇 <span style="font-weight: 700; color: #D97706;">#1 Gold</span>' :
                               (v.rank === 2 ? '🥈 <span style="font-weight: 700; color: #64748B;">#2 Silver</span>' :
                               (v.rank === 3 ? '🥉 <span style="font-weight: 700; color: #B45309;">#3 Bronze</span>' :
                               `<span style="color: var(--text-muted); font-weight: 600;">#${v.rank}</span>`));
              return `
                <tr>
                  <td>${rankBadge}</td>
                  <td>
                    <strong style="color: var(--text-main); display: block;">${window.escapeHTML(v.name)}</strong>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${window.escapeHTML(v.email)}</span>
                  </td>
                  <td>${window.escapeHTML(v.city || 'India')}</td>
                  <td><strong style="color: var(--accent-green); font-size: 1rem;">${v.totalHours !== undefined ? v.totalHours : (v.hours || 0)}</strong> hrs</td>
                  <td><strong style="color: #2563EB;">${v.points || 0}</strong> pts</td>
                  <td><span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); font-weight: 700;">${window.escapeHTML(v.level || 'Bronze Changemaker')}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (currentLeaderboardCategory === 'donors') {
    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="custom-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Philanthropic Donor</th>
              <th>Location</th>
              <th>Total Contributed</th>
              <th>Successful Donations</th>
              <th>Donor Tier</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(dn => {
              const rankBadge = dn.rank === 1 ? '🥇 <span style="font-weight: 700; color: #D97706;">#1 Gold</span>' :
                                (dn.rank === 2 ? '🥈 <span style="font-weight: 700; color: #64748B;">#2 Silver</span>' :
                                (dn.rank === 3 ? '🥉 <span style="font-weight: 700; color: #B45309;">#3 Bronze</span>' :
                                `<span style="color: var(--text-muted); font-weight: 600;">#${dn.rank}</span>`));
              return `
                <tr>
                  <td>${rankBadge}</td>
                  <td>
                    <strong style="color: var(--text-main); display: block;">${window.escapeHTML(dn.name)}</strong>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${window.escapeHTML(dn.email)}</span>
                  </td>
                  <td>${window.escapeHTML(dn.city || 'India')}</td>
                  <td><strong style="color: var(--accent-green); font-size: 1.05rem;">₹${Number(dn.totalDonated || 0).toLocaleString('en-IN')}</strong></td>
                  <td>${dn.donationsCount || 0} gifts</td>
                  <td><span class="badge" style="background: #FEF3C7; color: #B45309; font-weight: 700;">${window.escapeHTML(dn.tier || 'Supporter')}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // NGOs
    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="custom-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 70px;">Rank</th>
              <th>Organization</th>
              <th>Cause & Location</th>
              <th>Status</th>
              <th>Impact Score</th>
              <th>Active Campaigns</th>
              <th>Drives Hosted</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(n => {
              const rankBadge = n.rank === 1 ? '🥇 <span style="font-weight: 700; color: #D97706;">#1 Gold</span>' :
                                (n.rank === 2 ? '🥈 <span style="font-weight: 700; color: #64748B;">#2 Silver</span>' :
                                (n.rank === 3 ? '🥉 <span style="font-weight: 700; color: #B45309;">#3 Bronze</span>' :
                                `<span style="color: var(--text-muted); font-weight: 600;">#${n.rank}</span>`));
              return `
                <tr>
                  <td>${rankBadge}</td>
                  <td>
                    <strong style="color: var(--text-main); display: block;">${window.escapeHTML(n.orgName || n.name || 'Organization')}</strong>
                  </td>
                  <td>${window.escapeHTML(n.cause || 'General')} &bull; ${window.escapeHTML(n.city || 'India')}</td>
                  <td>
                    <span class="badge" style="background: ${n.verificationStatus === 'VERIFIED' ? 'var(--accent-green-light)' : '#FEF3C7'}; color: ${n.verificationStatus === 'VERIFIED' ? 'var(--accent-green)' : '#D97706'}; font-weight: 700;">
                      ${n.verificationStatus}
                    </span>
                  </td>
                  <td><strong style="color: var(--accent-green);">${Number(n.impactScore || (n.totalRaised ? n.totalRaised / 10 : 0)).toLocaleString('en-IN')} pts</strong></td>
                  <td><strong>${n.campaignsCount !== undefined ? n.campaignsCount : 0}</strong> campaigns</td>
                  <td><strong>${n.drivesCount !== undefined ? n.drivesCount : 0}</strong> drives</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

window.switchLeaderboardCategory = function(cat) {
  currentLeaderboardCategory = cat;
  const btnV = document.getElementById('leadCategoryVolunteers');
  const btnD = document.getElementById('leadCategoryDonors');
  const btnN = document.getElementById('leadCategoryNgos');

  if (btnV) btnV.classList.toggle('active', cat === 'volunteers');
  if (btnD) btnD.classList.toggle('active', cat === 'donors');
  if (btnN) btnN.classList.toggle('active', cat === 'ngos');

  renderAdminLeaderboard(false);
};

/**
 * 4.5 User Accounts & Role Management
 */
async function renderAdminUsersList() {
  const tbody = document.getElementById('adminUsersTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin" style="color: var(--accent-green); margin-right: 0.5rem;"></i> Loading user accounts...</td></tr>';

  try {
    const res = await window.ImpactHubAPI.request('/admin/users');
    allAdminUsers = res.users || [];
    renderFilteredAdminUsers(allAdminUsers);
  } catch (err) {
    console.error('Failed to load admin users:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #DC2626; padding: 1.5rem;">Error loading users: ${window.escapeHTML(err.message)}</td></tr>`;
  }
}

function renderFilteredAdminUsers(users) {
  const tbody = document.getElementById('adminUsersTbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No users match search criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isSuspended = u.isSuspended;
    const isVerified = !!u.emailVerifiedAt;

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main); display: block;">${window.escapeHTML(u.name)}</strong>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${window.escapeHTML(u.email)}</span>
        </td>
        <td>
          <span class="badge" style="background: var(--bg-primary); border: 1px solid var(--border-light); font-weight: 700;">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td>${window.escapeHTML(u.city || 'India')}</td>
        <td>
          <span class="badge" style="background: ${isSuspended ? '#FEE2E2' : (isVerified ? 'var(--accent-green-light)' : '#FEF3C7')}; color: ${isSuspended ? '#DC2626' : (isVerified ? 'var(--accent-green)' : '#D97706')}; font-weight: 700;">
            ${isSuspended ? 'SUSPENDED' : (isVerified ? 'VERIFIED' : 'UNVERIFIED')}
          </span>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
        <td>
          ${u.role !== 'admin' ? `
            <button class="btn btn-xs ${isSuspended ? 'btn-green' : 'btn-outline'}" style="${isSuspended ? '' : 'color: #DC2626; border-color: #FECACA;'}" onclick="promptAdminUserSuspend('${u.id}', ${!isSuspended}, '${window.escapeHTML(u.name)}')">
              ${isSuspended ? '<i class="fas fa-undo"></i> Restore' : '<i class="fas fa-user-slash"></i> Suspend'}
            </button>
          ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Admin (Protected)</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterAdminUsers = function(q) {
  const val = String(q || '').toLowerCase().trim();
  if (!val) {
    renderFilteredAdminUsers(allAdminUsers);
    return;
  }
  const filtered = allAdminUsers.filter(u =>
    (u.name && u.name.toLowerCase().includes(val)) ||
    (u.email && u.email.toLowerCase().includes(val)) ||
    (u.city && u.city.toLowerCase().includes(val)) ||
    (u.role && u.role.toLowerCase().includes(val))
  );
  renderFilteredAdminUsers(filtered);
};

/**
 * 4.6 Flagged Content Reports
 */
async function renderAdminReportsList() {
  const tbody = document.getElementById('adminReportsTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin" style="color: var(--accent-green); margin-right: 0.5rem;"></i> Loading flagged reports...</td></tr>';

  try {
    const res = await window.ImpactHubAPI.request('/reports');
    const reports = res.reports || [];

    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-shield-alt" style="color: var(--accent-green); font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i> No flagged content reported. Platform is clean!</td></tr>';
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
        <td><span class="badge" style="background: var(--bg-primary);">${window.escapeHTML(r.targetType)}</span></td>
        <td><code style="font-size: 0.78rem;">${window.escapeHTML(r.targetId)}</code></td>
        <td><strong>${window.escapeHTML(r.reason)}</strong></td>
        <td style="font-size: 0.85rem;">${window.escapeHTML(r.description || 'No description provided.')}</td>
        <td><span class="badge" style="background: #FEF3C7; color: #D97706; font-weight: 700;">${window.escapeHTML(r.status)}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load reports:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #DC2626;">Error loading reports: ${window.escapeHTML(err.message)}</td></tr>`;
  }
};

/**
 * Sensitive Admin Operations with Password Re-entry
 */
window.promptAdminNgoAction = function(ngoId, status, orgName) {
  pendingAdminAction = {
    type: 'ngo_verify',
    id: ngoId,
    status
  };

  const modal = document.getElementById('adminPasswordModal');
  const desc = document.getElementById('adminActionDescription');
  const reasonGroup = document.getElementById('adminRejectReasonGroup');
  const passInput = document.getElementById('adminConfirmPassInput');

  if (passInput) passInput.value = '';
  if (desc) {
    desc.textContent = `You are about to mark "${orgName}" as ${status}. Please enter your admin password to confirm.`;
  }
  if (reasonGroup) {
    reasonGroup.style.display = status === 'REJECTED' ? 'block' : 'none';
  }

  window.openModal('adminPasswordModal');
};

window.promptAdminUserSuspend = function(userId, isSuspended, userName) {
  pendingAdminAction = {
    type: 'user_suspend',
    id: userId,
    isSuspended
  };

  const modal = document.getElementById('adminPasswordModal');
  const desc = document.getElementById('adminActionDescription');
  const reasonGroup = document.getElementById('adminRejectReasonGroup');
  const passInput = document.getElementById('adminConfirmPassInput');

  if (passInput) passInput.value = '';
  if (desc) {
    desc.textContent = `You are about to ${isSuspended ? 'SUSPEND' : 'RESTORE'} account for "${userName}". Please enter your admin password to confirm.`;
  }
  if (reasonGroup) {
    reasonGroup.style.display = isSuspended ? 'block' : 'none';
  }

  window.openModal('adminPasswordModal');
};

const adminConfirmForm = document.getElementById('adminPasswordConfirmForm');
if (adminConfirmForm) {
  adminConfirmForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!pendingAdminAction) return;

    const adminPassword = document.getElementById('adminConfirmPassInput').value;
    const reason = document.getElementById('adminReasonInput') ? document.getElementById('adminReasonInput').value : '';
    const submitBtn = document.getElementById('adminConfirmActionBtn');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
    }

    try {
      if (pendingAdminAction.type === 'ngo_verify') {
        const res = await window.ImpactHubAPI.request(`/admin/ngos/${pendingAdminAction.id}/verify`, {
          method: 'POST',
          body: JSON.stringify({
            status: pendingAdminAction.status,
            rejectionReason: reason,
            adminPassword
          })
        });
        window.closeModal('adminPasswordModal');
        window.showToast(res.message || 'NGO verification status updated.', 'success');
        await renderAdminNgoQueue();
        await renderAdminOverviewMetrics();
      } else if (pendingAdminAction.type === 'user_suspend') {
        const res = await window.ImpactHubAPI.request(`/admin/users/${pendingAdminAction.id}/suspend`, {
          method: 'POST',
          body: JSON.stringify({
            isSuspended: pendingAdminAction.isSuspended,
            reason,
            adminPassword
          })
        });
        window.closeModal('adminPasswordModal');
        window.showToast(`User status updated to ${pendingAdminAction.isSuspended ? 'Suspended' : 'Active'}.`, 'success');
        await renderAdminUsersList();
      }
    } catch (err) {
      window.showToast('Authentication failed: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Confirm Action';
      }
    }
  };
}

/**
 * =========================================================================
 * 5. UNIVERSAL ACCOUNT SETTINGS & PRIVACY
 * =========================================================================
 */
window.openAccountSettingsModal = function() {
  const modal = document.getElementById('accountSettingsModal');
  if (!modal) return;

  // Populate profile fields
  const nameInput = document.getElementById('settingsFullName');
  const cityInput = document.getElementById('settingsCity');
  const bioInput = document.getElementById('settingsBio');
  const avatarInput = document.getElementById('settingsAvatar');

  if (nameInput) nameInput.value = currentUser.name || '';
  if (cityInput) cityInput.value = currentUser.city || '';
  if (bioInput) bioInput.value = currentUser.bio || '';
  if (avatarInput) avatarInput.value = currentUser.avatar || '';

  window.switchSettingsTab('profile');
  window.openModal('accountSettingsModal');
};

window.switchSettingsTab = function(tab) {
  const pPane = document.getElementById('settingsPaneProfile');
  const sPane = document.getElementById('settingsPaneSecurity');
  const dPane = document.getElementById('settingsPaneData');

  const pBtn = document.getElementById('settingsTabBtnProfile');
  const sBtn = document.getElementById('settingsTabBtnSecurity');
  const dBtn = document.getElementById('settingsTabBtnData');

  if (pPane) pPane.style.display = tab === 'profile' ? 'block' : 'none';
  if (sPane) sPane.style.display = tab === 'security' ? 'block' : 'none';
  if (dPane) dPane.style.display = tab === 'data' ? 'block' : 'none';

  if (pBtn) pBtn.classList.toggle('active', tab === 'profile');
  if (sBtn) sBtn.classList.toggle('active', tab === 'security');
  if (dBtn) dBtn.classList.toggle('active', tab === 'data');
};

// Profile Update Form
const profileForm = document.getElementById('settingsProfileForm');
if (profileForm) {
  profileForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('settingsFullName').value.trim();
    const city = document.getElementById('settingsCity').value.trim();
    const bio = document.getElementById('settingsBio').value.trim();
    const avatar = document.getElementById('settingsAvatar').value.trim();

    try {
      const updated = await window.ImpactHubAPI.updateMyProfile({ name, city, bio, avatar });
      currentUser.name = updated.name;
      currentUser.city = updated.city;
      renderDashboardHeader();
      window.showToast('Profile information updated successfully!', 'success');
      window.closeModal('accountSettingsModal');
    } catch (err) {
      window.showToast('Failed to update profile: ' + err.message, 'error');
    }
  };
}

// Password Change Form
const passForm = document.getElementById('settingsPasswordForm');
if (passForm) {
  passForm.onsubmit = async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('settingsCurrentPassword').value;
    const newPassword = document.getElementById('settingsNewPassword').value;

    if (newPassword.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      window.showToast('New password must be at least 8 characters with at least one letter and one number.', 'error');
      return;
    }

    try {
      await window.ImpactHubAPI.changePassword(currentPassword, newPassword);
      window.showToast('Password changed successfully! Please keep it secure.', 'success');
      passForm.reset();
    } catch (err) {
      window.showToast('Password change failed: ' + err.message, 'error');
    }
  };
}

// Email Change Form
const emailForm = document.getElementById('settingsEmailForm');
if (emailForm) {
  emailForm.onsubmit = async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('settingsNewEmail').value.trim();

    try {
      const res = await window.ImpactHubAPI.changeEmail(newEmail);
      window.showToast(res.message || 'Email verification link dispatched to new address.', 'success');
      emailForm.reset();
      currentUser.email = newEmail;
      currentUser.emailVerified = false;
      renderDashboardHeader();
      checkVerificationBanner();
    } catch (err) {
      window.showToast('Failed to change email: ' + err.message, 'error');
    }
  };
}

window.handleLogoutAllDevices = async function() {
  if (confirm('Are you sure you want to log out of all active devices and sessions?')) {
    try {
      await window.ImpactHubAPI.logoutAllDevices();
      window.showToast('All active sessions revoked. Please sign in again.', 'info');
      setTimeout(() => {
        window.location.href = '/auth?tab=signin';
      }, 500);
    } catch (err) {
      window.showToast('Failed to revoke sessions: ' + err.message, 'error');
    }
  }
};

window.handleExportData = async function() {
  try {
    const res = await window.ImpactHubAPI.exportMyData();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.userData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `impacthub_data_${currentUser.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.showToast('Account data exported successfully.', 'success');
  } catch (err) {
    window.showToast('Data export failed: ' + err.message, 'error');
  }
};

window.handleDeleteAccountPrompt = async function() {
  const pwd = prompt('WARNING: This will permanently delete your account.\nTo confirm, please enter your password:');
  if (!pwd) return;

  try {
    const res = await window.ImpactHubAPI.deleteMyAccount(pwd);
    alert(res.message || 'Your account has been deleted.');
    localStorage.removeItem('ih_token');
    localStorage.removeItem('ih_user');
    window.location.href = '/';
  } catch (err) {
    alert('Account deletion failed: ' + err.message);
  }
};
