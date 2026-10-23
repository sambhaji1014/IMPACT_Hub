/**
 * ImpactHub - Global Application Logic & Auth Ecosystem
 * Fully Sanitized, Accessible, and Production Hardened
 */

document.addEventListener('DOMContentLoaded', () => {
  initToastContainer();
  initAuthModal();
  initReceiptModal();
  initVolunteerPassModal();
  initNavbar();
  initModals();
  highlightActiveNavLink();

  // Listen to auth changes across any action
  window.addEventListener('ih:auth-changed', () => {
    updateNavbarAuthState();
  });
  window.addEventListener('hc:auth-changed', () => {
    updateNavbarAuthState();
  });
});

/* ==========================================================================
   Toast Notification System (XSS-Safe)
   ========================================================================== */
function initToastContainer() {
  if (!document.getElementById('toastContainer')) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
}

window.showToast = function(message, type = 'success', icon = 'fas fa-check-circle') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');

  const safeIcon = window.escapeHTML(icon);
  const safeMessage = window.escapeHTML(message);

  toast.innerHTML = `
    <i class="${safeIcon} toast-icon" aria-hidden="true"></i>
    <div class="toast-content">
      <span>${safeMessage}</span>
    </div>
  `;

  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, 4200);
};

/* ==========================================================================
   Navbar & Authentication State Manager
   ========================================================================== */
function initNavbar() {
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      const isExpanded = navLinks.classList.toggle('active');
      mobileBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      const icon = mobileBtn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
      }
    });
  }

  updateNavbarAuthState();
}

function updateNavbarAuthState() {
  const navActions = document.querySelector('.nav-actions');
  const navLinksList = document.querySelector('.nav-links');
  if (!navActions) return;

  const user = (window.ImpactHubAPI && window.ImpactHubAPI.getCurrentUser()) || (window.HCStore && window.HCStore.getCurrentUser());

  // Role-aware navigation links
  if (navLinksList) {
    if (!user) {
      navLinksList.innerHTML = `
        <li><a href="/">Home</a></li>
        <li><a href="/campaigns">Campaigns</a></li>
        <li><a href="/drives">Volunteer Drives</a></li>
        <li><a href="/ngos">NGO Directory</a></li>
        <li><a href="/leaderboard">Leaderboard</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      `;
    } else {
      const primaryRole = (user.roles && user.roles[0]) || user.role || 'volunteer';
      if (primaryRole === 'admin') {
        navLinksList.innerHTML = `
          <li><a href="/">Home</a></li>
          <li><a href="/dashboard?tab=overview">Admin Overview</a></li>
          <li><a href="/dashboard?tab=verification">Verification Queue</a></li>
          <li><a href="/dashboard?tab=audit">Audit Logs</a></li>
          <li><a href="/dashboard?tab=leaderboard">Leaderboard</a></li>
        `;
      } else if (primaryRole === 'ngo') {
        navLinksList.innerHTML = `
          <li><a href="/">Home</a></li>
          <li><a href="/dashboard?tab=campaigns">My Campaigns</a></li>
          <li><a href="/drives">Volunteer Drives</a></li>
          <li><a href="/dashboard?tab=applicants">Participant Roster</a></li>
          <li><a href="/dashboard">NGO Portal</a></li>
        `;
      } else if (primaryRole === 'donor') {
        navLinksList.innerHTML = `
          <li><a href="/">Home</a></li>
          <li><a href="/campaigns">Campaigns</a></li>
          <li><a href="/leaderboard">Rewards & Tiers</a></li>
          <li><a href="/dashboard">My Donations</a></li>
        `;
      } else {
        navLinksList.innerHTML = `
          <li><a href="/">Home</a></li>
          <li><a href="/drives">Find Drives</a></li>
          <li><a href="/leaderboard">Rewards & Badges</a></li>
          <li><a href="/dashboard">My Registrations</a></li>
        `;
      }
    }
    highlightActiveNavLink();
  }

  let authSlot = navActions.querySelector('.nav-auth-slot');
  if (!authSlot) {
    authSlot = document.createElement('div');
    authSlot.className = 'nav-auth-slot';
    authSlot.style.display = 'flex';
    authSlot.style.alignItems = 'center';
    authSlot.style.gap = '0.65rem';

    // Remove legacy static login buttons if found
    const legacyLoginBtns = navActions.querySelectorAll('.nav-actions > button:not(.mobile-menu-btn)');
    legacyLoginBtns.forEach(btn => btn.remove());

    const mobileBtn = navActions.querySelector('.mobile-menu-btn');
    if (mobileBtn) {
      navActions.insertBefore(authSlot, mobileBtn);
    } else {
      navActions.appendChild(authSlot);
    }
  }

  if (user) {
    const primaryRole = (user.roles && user.roles[0]) || user.role || 'volunteer';
    const roleIconMap = {
      volunteer: 'fas fa-hands-helping',
      donor: 'fas fa-heart',
      ngo: 'fas fa-building',
      admin: 'fas fa-shield-alt'
    };
    const roleNameMap = {
      volunteer: 'Volunteer',
      donor: 'Donor / Supporter',
      ngo: 'NGO Organizer',
      admin: 'Administrator'
    };

    const roleIcon = roleIconMap[primaryRole] || 'fas fa-user';
    const roleName = roleNameMap[primaryRole] || 'Member';
    const safeName = window.escapeHTML(user.name || 'Account');
    const safeEmail = window.escapeHTML(user.email || '');
    const firstName = window.escapeHTML(user.name ? user.name.split(' ')[0] : 'Account');

    authSlot.innerHTML = `
      <div class="user-profile-menu-wrap" id="userProfileMenuWrap">
        <button class="user-profile-btn" id="userProfileBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open User Profile Menu" style="display: flex; align-items: center; gap: 0.5rem; background: #FFFFFF; border: 1.5px solid var(--accent-green); border-radius: var(--radius-pill); padding: 0.35rem 0.85rem; cursor: pointer;">
          <div class="user-avatar-circle" aria-hidden="true" style="width: 28px; height: 28px; border-radius: 50%; background: var(--accent-green); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">
            ${firstName.charAt(0).toUpperCase()}
          </div>
          <span class="user-nav-name" style="font-size: 0.88rem; font-weight: 600; color: var(--text-main);">${firstName}</span>
          <i class="fas fa-chevron-down user-chevron" aria-hidden="true" style="font-size: 0.75rem; color: var(--text-muted);"></i>
        </button>

        <div class="user-profile-dropdown" id="userProfileDropdown" role="menu">
          <div class="user-dropdown-header" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-light);">
            <div class="user-dropdown-name" style="font-weight: 700; color: var(--text-main);">${safeName}</div>
            <div class="user-dropdown-email" style="font-size: 0.8rem; color: var(--text-muted);">${safeEmail}</div>
            <span class="badge" style="background: var(--accent-green-light); color: var(--accent-green); font-size: 0.75rem; margin-top: 0.4rem; display: inline-block;"><i class="${roleIcon}" aria-hidden="true"></i> ${roleName}</span>
          </div>
          <ul class="user-dropdown-menu" role="none" style="list-style: none; padding: 0.5rem 0;">
            <li role="none">
              <a href="/dashboard" role="menuitem" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1.25rem; color: var(--text-main); text-decoration: none; font-size: 0.9rem;">
                <i class="fas fa-tachometer-alt" style="color: var(--accent-green);" aria-hidden="true"></i> My Dashboard
              </a>
            </li>
            <li role="none">
              <a href="/leaderboard" role="menuitem" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1.25rem; color: var(--text-main); text-decoration: none; font-size: 0.9rem;">
                <i class="fas fa-award" style="color: #D97706;" aria-hidden="true"></i> Rewards & Leaderboard
              </a>
            </li>
            <li role="none" style="border-top: 1px solid var(--border-light); margin-top: 0.4rem; padding-top: 0.4rem;">
              <button type="button" class="logout-btn" role="menuitem" onclick="window.handleLogout()" style="width: 100%; text-align: left; display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1.25rem; background: none; border: none; color: #DC2626; font-size: 0.9rem; cursor: pointer;">
                <i class="fas fa-sign-out-alt" aria-hidden="true"></i> Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    `;

    // Dropdown toggle
    const wrap = document.getElementById('userProfileMenuWrap');
    const btn = document.getElementById('userProfileBtn');
    if (btn && wrap) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
          wrap.classList.remove('active');
        }
      });
    }

  } else {
    // Logged out state - single canonical auth routes
    authSlot.innerHTML = `
      <a href="/auth?tab=signin" class="btn btn-sm btn-outline nav-login-btn">
        <i class="fas fa-sign-in-alt" aria-hidden="true"></i> Sign In
      </a>
      <a href="/auth?tab=signup" class="btn btn-sm btn-primary nav-join-btn">
        <i class="fas fa-user-plus" aria-hidden="true"></i> Sign Up
      </a>
    `;
  }
}

function highlightActiveNavLink() {
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  const currentFull = currentPath + currentSearch;
  const navItems = document.querySelectorAll('.nav-links a');

  let hasExactMatch = false;
  navItems.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentFull) {
      hasExactMatch = true;
    }
  });

  navItems.forEach(link => {
    const href = link.getAttribute('href');
    let isActive = false;
    if (hasExactMatch) {
      isActive = (href === currentFull);
    } else {
      isActive = (href === currentPath || 
        (currentPath === '/' && (href === '/' || href === 'index.html')) ||
        (currentPath === '/dashboard' && (href === '/dashboard' || href === '/dashboard?tab=overview'))
      );
    }

    if (isActive) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}
window.highlightActiveNavLink = highlightActiveNavLink;

window.handleLogout = async function() {
  try {
    if (window.ImpactHubAPI) {
      await window.ImpactHubAPI.logout();
    }
  } catch (e) {}
  try {
    if (window.HCStore) {
      window.HCStore.logoutUser();
    }
  } catch (e) {}
  localStorage.removeItem('ih_token');
  localStorage.removeItem('ih_user');
  window.showToast('You have been signed out successfully.', 'info', 'fas fa-sign-out-alt');
  setTimeout(() => {
    window.location.href = '/auth?tab=signin';
  }, 350);
};

/* ==========================================================================
   Universal Authentication Modal (Sign In & Sign Up)
   ========================================================================== */
function initAuthModal() {
  let modal = document.getElementById('authModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'authModal';
    document.body.appendChild(modal);
  }

  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'authModalHeading');

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <h3 id="authModalHeading" style="font-size: 1.25rem;"><i class="fas fa-hand-holding-heart" style="color: var(--accent-green);"></i> Welcome to ImpactHub</h3>
        <button class="modal-close-btn" onclick="closeModal('authModal')" aria-label="Close modal">&times;</button>
      </div>



      <!-- Auth Tabs -->
      <div style="padding: 0 1.75rem;">
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab-btn active" id="authTabSignInBtn" role="tab" aria-selected="true" onclick="window.switchAuthTab('signin')">
            <i class="fas fa-sign-in-alt" aria-hidden="true"></i> Sign In
          </button>
          <button type="button" class="auth-tab-btn" id="authTabSignUpBtn" role="tab" aria-selected="false" onclick="window.switchAuthTab('signup')">
            <i class="fas fa-user-plus" aria-hidden="true"></i> Create Account
          </button>
        </div>
      </div>

      <div class="modal-body" style="padding-top: 0.5rem;">
        <!-- Sign In Form -->
        <form id="authSignInForm">
          <div class="form-group">
            <label for="signInEmail">Email Address *</label>
            <input type="email" class="form-control" id="signInEmail" placeholder="your.email@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="signInPassword">Password *</label>
            <div class="password-input-wrap">
              <input type="password" class="form-control" id="signInPassword" placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" onclick="window.togglePasswordVisibility('signInPassword', this)">
                <i class="fas fa-eye" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <label class="form-check-label">
              <input type="checkbox" checked id="rememberMeCheckbox"> Remember me
            </label>
            <a href="#" style="font-size: 0.82rem; color: var(--accent-orange); font-weight: 600;" onclick="event.preventDefault(); window.showToast('Reset password link sent to registered email.', 'info', 'fas fa-envelope');">Forgot Password?</a>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;" id="signInSubmitBtn">
            <i class="fas fa-arrow-right" aria-hidden="true"></i> Sign In to ImpactHub
          </button>
        </form>

        <!-- Sign Up Form -->
        <form id="authSignUpForm" style="display: none;">
          <div class="form-group">
            <label for="signUpName">Full Name *</label>
            <input type="text" class="form-control" id="signUpName" placeholder="e.g. Maya Deshmukh" required autocomplete="name">
          </div>
          <div class="form-group">
            <label for="signUpEmail">Email Address *</label>
            <input type="email" class="form-control" id="signUpEmail" placeholder="maya@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="signUpPassword">Password *</label>
            <div class="password-input-wrap">
              <input type="password" class="form-control" id="signUpPassword" placeholder="Minimum 6 characters" minlength="6" required autocomplete="new-password">
              <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility" onclick="window.togglePasswordVisibility('signUpPassword', this)">
                <i class="fas fa-eye" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="signUpRole">Primary Role on Platform *</label>
            <select class="form-control" id="signUpRole" onchange="window.handleSignUpRoleChange(this.value)">
              <option value="volunteer">🙋 Volunteer (Join Drives & Earn Certificates)</option>
              <option value="donor">❤️ Donor (Support Verified Crowdfunding)</option>
              <option value="ngo">🏢 NGO Lead / Organizer (Publish Campaigns & Recruit)</option>
            </select>
          </div>
          <div class="form-group" id="signUpOrgGroup" style="display: none;">
            <label for="signUpOrgName">Organization / Trust Name *</label>
            <input type="text" class="form-control" id="signUpOrgName" placeholder="e.g. Pune River Revitalization Trust">
          </div>
          <div style="margin-bottom: 1.25rem;">
            <label class="form-check-label">
              <input type="checkbox" required checked> I agree to ImpactHub's community standards and transparent impact charter.
            </label>
          </div>
          <button type="submit" class="btn btn-green" style="width: 100%;" id="signUpSubmitBtn">
            <i class="fas fa-check-circle" aria-hidden="true"></i> Create Verified Account
          </button>
        </form>
      </div>

      <div class="modal-footer" style="justify-content: center; font-size: 0.88rem; color: var(--text-muted);">
        <span id="authFooterText">
          New to ImpactHub? <a href="#" style="color: var(--accent-green); font-weight: 700;" onclick="event.preventDefault(); window.switchAuthTab('signup');">Create an account here</a>
        </span>
      </div>
    </div>
  `;

  // Attach submit listeners
  const signInForm = document.getElementById('authSignInForm');
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signInEmail').value;
      const pass = document.getElementById('signInPassword').value;

      const res = window.HCStore.loginUser(email, pass);
      if (res.success) {
        window.closeModal('authModal');
        window.showToast(`✨ Welcome back, ${res.user.name}! Signed in as ${res.user.role.toUpperCase()}`, 'success', 'fas fa-check-circle');
        if (res.user.role === 'ngo' && !window.location.pathname.includes('dashboard.html')) {
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        }
      } else {
        window.showToast(res.message, 'error', 'fas fa-exclamation-circle');
      }
    });
  }

  const signUpForm = document.getElementById('authSignUpForm');
  if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signUpName').value.trim();
      const email = document.getElementById('signUpEmail').value.trim();
      const password = document.getElementById('signUpPassword').value;
      const role = document.getElementById('signUpRole').value;
      const orgName = document.getElementById('signUpOrgName').value.trim();

      if (role === 'ngo' && !orgName) {
        window.showToast('Please enter your NGO or Trust name.', 'error', 'fas fa-exclamation-circle');
        return;
      }

      const res = window.HCStore.registerUser({
        name,
        email,
        password,
        role,
        orgName
      });

      if (res.success) {
        window.closeModal('authModal');
        window.showToast(`🎉 Account created! Welcome to ImpactHub, ${res.user.name}.`, 'success', 'fas fa-check-circle');
        signUpForm.reset();
        if (role === 'ngo') {
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        }
      } else {
        window.showToast(res.message, 'error', 'fas fa-exclamation-circle');
      }
    });
  }
}

window.openAuthModal = function(tab = 'signin') {
  const returnTo = window.location.pathname !== '/auth' ? ('&returnTo=' + encodeURIComponent(window.location.pathname + window.location.search)) : '';
  window.location.href = '/auth?tab=' + encodeURIComponent(tab) + returnTo;
};

window.switchAuthTab = function(tab) {
  const signInBtn = document.getElementById('authTabSignInBtn');
  const signUpBtn = document.getElementById('authTabSignUpBtn');
  const signInForm = document.getElementById('authSignInForm');
  const signUpForm = document.getElementById('authSignUpForm');
  const footerText = document.getElementById('authFooterText');

  if (tab === 'signin') {
    if (signInBtn) { signInBtn.classList.add('active'); signInBtn.setAttribute('aria-selected', 'true'); }
    if (signUpBtn) { signUpBtn.classList.remove('active'); signUpBtn.setAttribute('aria-selected', 'false'); }
    if (signInForm) signInForm.style.display = 'block';
    if (signUpForm) signUpForm.style.display = 'none';
    if (footerText) {
      footerText.innerHTML = `New to ImpactHub? <a href="#" style="color: var(--accent-green); font-weight: 700;" onclick="event.preventDefault(); window.switchAuthTab('signup');">Create an account here</a>`;
    }
  } else {
    if (signInBtn) { signInBtn.classList.remove('active'); signInBtn.setAttribute('aria-selected', 'false'); }
    if (signUpBtn) { signUpBtn.classList.add('active'); signUpBtn.setAttribute('aria-selected', 'true'); }
    if (signInForm) signInForm.style.display = 'none';
    if (signUpForm) signUpForm.style.display = 'block';
    if (footerText) {
      footerText.innerHTML = `Already have an account? <a href="#" style="color: var(--accent-orange); font-weight: 700;" onclick="event.preventDefault(); window.switchAuthTab('signin');">Sign in here</a>`;
    }
  }
};

window.handleSignUpRoleChange = function(role) {
  const orgGroup = document.getElementById('signUpOrgGroup');
  if (orgGroup) {
    orgGroup.style.display = role === 'ngo' ? 'block' : 'none';
  }
};

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input) {
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = `<i class="fas fa-${isPass ? 'eye-slash' : 'eye'}" aria-hidden="true"></i>`;
    btn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
  }
};



/* ==========================================================================
   Universal Donation Receipt Modal (XSS-Safe)
   ========================================================================== */
function initReceiptModal() {
  if (document.getElementById('receiptModal')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'receiptModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'receiptModalTitle');

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 580px;">
      <div class="modal-header">
        <h3 id="receiptModalTitle"><i class="fas fa-file-invoice" style="color: var(--accent-green);"></i> Official Donation Receipt</h3>
        <button class="modal-close-btn" onclick="closeModal('receiptModal')" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body" id="receiptModalBody"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('receiptModal')">Close</button>
        <button class="btn btn-outline" onclick="window.printReceipt()"><i class="fas fa-print"></i> Print Receipt</button>
        <a href="impact.html" class="btn btn-green"><i class="fas fa-chart-line"></i> View In Impact Dashboard</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.openDonationReceiptModal = function(donation) {
  if (!donation) return;
  initReceiptModal();
  const body = document.getElementById('receiptModalBody');
  if (!body) return;

  const safeAmount = Number(donation.amount || 0).toLocaleString('en-IN');
  const safeTxn = window.escapeHTML(donation.transactionId || 'TXN_HC_892144');
  const safeCampaign = window.escapeHTML(donation.campaignTitle || 'Social Impact Campaign');
  const safeNgo = window.escapeHTML(donation.ngoName || 'Verified Partner NGO');
  const safeDonor = window.escapeHTML(donation.donorName || 'Kind Changemaker');
  const safeDate = window.escapeHTML(donation.date || new Date().toLocaleDateString('en-GB'));

  body.innerHTML = `
    <div class="receipt-box" id="printableReceiptArea">
      <div class="receipt-stamp">VERIFIED 80G</div>
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="font-size: 1.75rem; font-weight: 800; color: var(--accent-green);">₹${safeAmount}</div>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">TAX DEDUCTIBLE SOCIAL CONTRIBUTION</span>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">Transaction Reference:</span>
        <span class="receipt-val" style="font-family: monospace; font-size: 0.95rem;">${safeTxn}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Beneficiary Campaign:</span>
        <span class="receipt-val">${safeCampaign}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Implementing NGO:</span>
        <span class="receipt-val"><strong>${safeNgo}</strong></span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Donor Name:</span>
        <span class="receipt-val">${safeDonor}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Date & Time:</span>
        <span class="receipt-val">${safeDate}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Payment Status:</span>
        <span class="receipt-val" style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Successfully Settled (100% Direct Transfer)</span>
      </div>

      <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed var(--border-light); font-size: 0.78rem; color: var(--text-muted); text-align: center;">
        ImpactHub Social Alliance • Demonstration 80G Reference Receipt
      </div>
    </div>
  `;

  window.openModal('receiptModal');
};

window.viewDonationReceiptModal = function(don) {
  if (!don) return;
  window.openDonationReceiptModal({
    amount: don.amount,
    transactionId: don.reference_code,
    campaignTitle: don.campaign_title,
    ngoName: don.ngo_name || 'Community NGO',
    donorName: don.donor_name || 'Generous Donor',
    date: don.created_at ? don.created_at.split('T')[0] : 'Recent'
  });
};

window.viewDigitalPassModal = function(app) {
  if (!app) return;
  window.openVolunteerPassModal({
    opportunityTitle: app.opportunity_title,
    ngoName: app.ngo_name,
    name: app.name,
    email: app.email,
    skills: app.skills,
    dateApplied: app.created_at ? app.created_at.split('T')[0] : 'Recent'
  });
};

window.printReceipt = function() {
  window.print();
};

/* ==========================================================================
   Universal Volunteer Pass / Confirmation Modal (XSS-Safe)
   ========================================================================== */
function initVolunteerPassModal() {
  if (document.getElementById('volunteerPassModal')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'volunteerPassModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'volunteerPassTitle');

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 560px;">
      <div class="modal-header">
        <h3 id="volunteerPassTitle"><i class="fas fa-id-badge" style="color: var(--accent-orange);"></i> Volunteer Digital Pass</h3>
        <button class="modal-close-btn" onclick="closeModal('volunteerPassModal')" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body" id="volunteerPassModalBody"></div>
      <div class="modal-footer" id="volunteerPassModalFooter">
        <button class="btn btn-secondary" onclick="closeModal('volunteerPassModal')">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.openVolunteerPassModal = function(reg) {
  if (!reg) return;
  initVolunteerPassModal();
  const body = document.getElementById('volunteerPassModalBody');
  const footer = document.getElementById('volunteerPassModalFooter');
  if (!body) return;

  const driveId = reg.driveId || reg.opportunityId || reg.id;
  const passCode = reg.passCode || reg.id || `IH-PASS-${Date.now().toString().slice(-4)}`;
  const qrUrl = reg.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(passCode)}`;

  const safeTitle = window.escapeHTML(reg.opportunityTitle || reg.drive?.title || 'Community Drive');
  const safeNgo = window.escapeHTML(reg.ngoName || reg.drive?.ngo?.orgName || 'Partner NGO');
  const safeName = window.escapeHTML(reg.name || reg.volunteerName || 'Volunteer');
  const safeEmail = window.escapeHTML(reg.email || reg.volunteerEmail || '');
  const safeSkills = window.escapeHTML(reg.skills || 'General Volunteer');
  const safeDate = window.escapeHTML(reg.dateApplied || (reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('en-IN') : 'Confirmed'));
  const isAttended = reg.status === 'ATTENDED';

  body.innerHTML = `
    <div class="receipt-box" style="border-style: solid; border-color: var(--accent-green);">
      <div class="receipt-stamp" style="border-color: var(--accent-green); color: var(--accent-green);">${isAttended ? 'ATTENDED' : 'CONFIRMED'}</div>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem;">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-green); text-transform: uppercase;">Official Volunteer Pass</span>
          <h3 style="font-size: 1.2rem; margin: 0.25rem 0;">${safeTitle}</h3>
          <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fas fa-building"></i> ${safeNgo}</span>
        </div>
        <div style="text-align: center; flex-shrink: 0;">
          <img src="${qrUrl}" alt="Check-in QR Code" style="width: 110px; height: 110px; border-radius: 8px; border: 1px solid var(--border-light); background: #FFF; padding: 4px;">
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">Scan for Check-in</div>
        </div>
      </div>

      <div class="receipt-row">
        <span class="receipt-label">Pass Reference:</span>
        <span class="receipt-val"><code>${passCode}</code></span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Volunteer Name:</span>
        <span class="receipt-val"><strong>${safeName}</strong></span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Contact Email:</span>
        <span class="receipt-val">${safeEmail}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Assigned Role:</span>
        <span class="receipt-val">${safeSkills}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Registration Date:</span>
        <span class="receipt-val">${safeDate}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Attendance Verification:</span>
        <span class="receipt-val" style="color: var(--accent-green); font-weight: 700;">
          <i class="fas fa-check-circle"></i> ${isAttended ? 'Verified by NGO Organizer' : 'Confirmed on Drive Roster'}
        </span>
      </div>

      <div style="margin-top: 1.25rem; background: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-main);">
        <i class="fas fa-info-circle" style="color: var(--accent-green);"></i> <strong>Check-In Instructions:</strong> Present this digital pass or mention your reference code <code>${passCode}</code> upon arrival at the NGO desk.
      </div>
    </div>
  `;

  if (footer) {
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="closeModal('volunteerPassModal')">Close</button>
      <a href="/api/v1/drives/${driveId}/calendar.ics" class="btn btn-outline" download><i class="fas fa-calendar-plus"></i> Add to Calendar (.ics)</a>
      ${isAttended ? `
        <a href="/api/v1/drives/registrations/${reg.id}/certificate.pdf" target="_blank" class="btn btn-green"><i class="fas fa-award"></i> Download Certificate (PDF)</a>
      ` : ''}
    `;
  }

  window.openModal('volunteerPassModal');
};

/* ==========================================================================
   Modals Backdrop & Escape Logic
   ========================================================================== */
function initModals() {
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const backdrop = btn.closest('.modal-backdrop');
      if (backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
}

window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.promptResetDemoData = function() {
  if (confirm('🔄 Reset all ImpactHub demo data to its pristine state?\n\nThis will restore default volunteer opportunities, campaigns, donation records, and sample users.')) {
    window.HCStore.resetDemoData();
    window.showToast('✅ Demo data restored to initial state!', 'success', 'fas fa-undo');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  }
};

/* Campaign Details Modal */
window.openCampaignDetailsModal = function(campId) {
  const c = window.HCStore.getCampaignById(campId);
  if (!c) return;

  let modal = document.getElementById('campaignDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'campaignDetailsModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  const percent = Math.min(100, Math.round(((c.raised || 0) / (c.goal || 1)) * 100));
  const safeTitle = window.escapeHTML(c.title);
  const safeNgo = window.escapeHTML(c.ngoName);
  const safeLoc = window.escapeHTML(c.location);
  const safeCategory = window.escapeHTML(c.category);
  const safeDesc = window.escapeHTML(c.description);
  const safeProblem = window.escapeHTML(c.problemStatement || 'Grassroots communities face critical resource limitations that impede sustained development and dignity.');
  const safeActivities = window.escapeHTML(c.plannedActivities || 'Executing direct ground support, provisioning necessary supplies, training volunteers, and conducting transparent milestone audits.');
  const safeImpact = window.escapeHTML(c.intendedImpact || 'Measurable upliftment for vulnerable families with direct progress updates sent to all campaign donors.');

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 680px;">
      <div class="modal-header">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-orange); text-transform: uppercase;">
            <i class="fas fa-tag"></i> ${safeCategory} • ${safeLoc}
          </span>
          <h3 style="font-size: 1.3rem; margin-top: 0.2rem;">${safeTitle}</h3>
        </div>
        <button class="modal-close-btn" onclick="closeModal('campaignDetailsModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 1.5rem; max-height: 240px;">
          <img src="${c.image}" alt="${safeTitle}" style="width: 100%; height: 240px; object-fit: cover;">
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 0.75rem 1rem; color: #FFF; font-size: 0.85rem;">
            <i class="fas fa-building"></i> Beneficiary Organization: <strong>${safeNgo}</strong>
          </div>
        </div>

        <!-- Funding Progress Bar -->
        <div style="background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-light); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
            <div>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Raised so far:</span>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-green);">₹${(c.raised || 0).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Target Goal:</span>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">₹${(c.goal || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div class="progress-track" style="height: 10px; margin-bottom: 0.5rem;">
            <div class="progress-bar" style="width: ${percent}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
            <span><strong>${percent}%</strong> funded • <strong>${c.supporters || 0}</strong> changemakers</span>
            <span><i class="fas fa-clock"></i> <strong>${c.daysLeft || 14}</strong> days remaining</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem; color: var(--accent-orange);"><i class="fas fa-exclamation-circle"></i> The Challenge</h4>
            <p style="font-size: 0.9rem; line-height: 1.55;">${safeProblem}</p>
          </div>
          <div>
            <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem; color: var(--accent-blue);"><i class="fas fa-tasks"></i> Planned Action Plan</h4>
            <p style="font-size: 0.9rem; line-height: 1.55;">${safeActivities}</p>
          </div>
          <div>
            <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem; color: var(--accent-green);"><i class="fas fa-seedling"></i> Verified Social Outcome</h4>
            <p style="font-size: 0.9rem; line-height: 1.55;">${safeImpact}</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('campaignDetailsModal')">Close</button>
        <button class="btn btn-green" onclick="closeModal('campaignDetailsModal'); if(typeof window.openDonationModal === 'function') { window.openDonationModal('${c.id}'); } else { window.location.href = 'campaigns.html?campaign=${c.id}'; }">
          <i class="fas fa-heart"></i> Donate to this Cause
        </button>
      </div>
    </div>
  `;

  window.openModal('campaignDetailsModal');
};

/* Opportunity Details Modal */
window.openOpportunityDetailsModal = function(oppId) {
  const opp = window.HCStore.getOpportunityById(oppId);
  if (!opp) return;

  let modal = document.getElementById('oppDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'oppDetailsModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  const slotsRemaining = Math.max(0, (opp.volunteersNeeded || 20) - (opp.volunteersRegistered || 0));
  const safeTitle = window.escapeHTML(opp.title);
  const safeNgo = window.escapeHTML(opp.ngoName);
  const safeLoc = window.escapeHTML(opp.location);
  const safeCategory = window.escapeHTML(opp.category);
  const safeDesc = window.escapeHTML(opp.description);
  const safeReq = window.escapeHTML(opp.requirements || 'All enthusiastic community volunteers welcome. Tools and orientation provided.');
  const safeDuration = window.escapeHTML(opp.duration || '3-4 Hours');
  const safeTime = window.escapeHTML(opp.time || 'Morning Schedule (09:00 AM onwards)');
  const safeDate = window.escapeHTML(opp.date);
  const safeSkills = window.escapeHTML(opp.skillLevel || 'Beginner Friendly');

  const u = window.HCStore.getCurrentUser();
  const isRegistered = u && window.HCStore.isUserRegisteredFor(opp.id, u.email);

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 660px;">
      <div class="modal-header">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-orange); text-transform: uppercase;">
            <i class="fas fa-tag"></i> ${safeCategory} • ${safeSkills}
          </span>
          <h3 style="font-size: 1.3rem; margin-top: 0.2rem;">${safeTitle}</h3>
        </div>
        <button class="modal-close-btn" onclick="closeModal('oppDetailsModal')">&times;</button>
      </div>
      <div class="modal-body">
        <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 1.5rem; max-height: 220px;">
          <img src="${opp.image}" alt="${safeTitle}" style="width: 100%; height: 220px; object-fit: cover;">
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 0.75rem 1rem; color: #FFF; font-size: 0.85rem;">
            <i class="fas fa-building"></i> Host NGO: <strong>${safeNgo}</strong>
          </div>
        </div>

        <!-- Key Meta Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light); margin-bottom: 1.25rem;">
          <div><i class="fas fa-calendar-alt" style="color: var(--accent-orange);"></i> <strong>Date:</strong> ${safeDate}</div>
          <div><i class="fas fa-clock" style="color: var(--accent-gold-hover);"></i> <strong>Time:</strong> ${safeTime}</div>
          <div><i class="fas fa-hourglass-half" style="color: var(--accent-green);"></i> <strong>Duration:</strong> ${safeDuration}</div>
          <div><i class="fas fa-users" style="color: var(--accent-blue);"></i> <strong>Slots Left:</strong> ${slotsRemaining} of ${opp.volunteersNeeded}</div>
          <div style="grid-column: 1 / -1;"><i class="fas fa-map-marker-alt" style="color: #E25A6B;"></i> <strong>Venue:</strong> ${safeLoc}</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem;"><i class="fas fa-info-circle"></i> About This Drive</h4>
          <p style="font-size: 0.9rem; line-height: 1.55; margin-bottom: 0.75rem;">${safeDesc}</p>
          <h4 style="font-size: 0.95rem; margin-bottom: 0.35rem;"><i class="fas fa-clipboard-check"></i> What to Bring / Requirements</h4>
          <p style="font-size: 0.9rem; line-height: 1.55;">${safeReq}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('oppDetailsModal')">Close</button>
        ${isRegistered ? `
          <button class="btn btn-secondary" disabled style="opacity: 0.75; cursor: not-allowed;">
            <i class="fas fa-check-circle" style="color: var(--accent-green);"></i> Already Registered
          </button>
        ` : `
          <button class="btn btn-primary" onclick="closeModal('oppDetailsModal'); if(typeof window.openJoinModal === 'function') { window.openJoinModal('${opp.id}'); } else { window.location.href = 'volunteer.html?opp=${opp.id}'; }">
            <i class="fas fa-user-plus"></i> Join This Drive
          </button>
        `}
      </div>
    </div>
  `;

  window.openModal('oppDetailsModal');
};
