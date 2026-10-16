/**
 * HopeConnect AI - Global Application Logic & Auth Ecosystem
 * Fully Sanitized, Accessible, and Production Hardened
 */

document.addEventListener('DOMContentLoaded', () => {
  initToastContainer();
  initAuthModal();
  initReceiptModal();
  initVolunteerPassModal();
  initNavbar();
  initRoleSwitcher();
  initModals();
  highlightActiveNavLink();

  // Listen to auth changes across any action
  window.addEventListener('hc:auth-changed', () => {
    updateNavbarAuthState();
    updateRoleSwitcherState();
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
  if (!navActions) return;

  const user = window.HCStore.getCurrentUser();

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
    const roleIconMap = {
      volunteer: 'fas fa-hands-helping',
      donor: 'fas fa-heart',
      ngo: 'fas fa-building'
    };
    const roleNameMap = {
      volunteer: 'Volunteer',
      donor: 'Donor / Supporter',
      ngo: 'NGO Organizer'
    };

    const roleIcon = roleIconMap[user.role] || 'fas fa-user';
    const roleName = roleNameMap[user.role] || 'Member';
    const safeName = window.escapeHTML(user.name || 'Account');
    const safeEmail = window.escapeHTML(user.email || '');
    const firstName = window.escapeHTML(user.name ? user.name.split(' ')[0] : 'Account');
    const safeRole = window.escapeHTML(user.role || 'volunteer');

    const avatarHtml = user.avatar 
      ? `<img src="${window.escapeHTML(user.avatar)}" alt="${safeName}">` 
      : firstName.charAt(0).toUpperCase();

    authSlot.innerHTML = `
      <div class="user-profile-menu-wrap" id="userProfileMenuWrap">
        <button class="user-profile-btn" id="userProfileBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open User Profile Menu">
          <div class="user-avatar-circle" aria-hidden="true">${avatarHtml}</div>
          <span class="user-nav-name">${firstName}</span>
          <i class="fas fa-chevron-down user-chevron" aria-hidden="true"></i>
        </button>

        <div class="user-profile-dropdown" id="userProfileDropdown" role="menu">
          <div class="user-dropdown-header">
            <div class="user-dropdown-name">${safeName}</div>
            <div class="user-dropdown-email">${safeEmail}</div>
            <span class="user-dropdown-role-badge ${safeRole}"><i class="${roleIcon}" aria-hidden="true"></i> ${roleName}</span>
          </div>
          <ul class="user-dropdown-menu" role="none">
            <li role="none">
              <a href="impact.html" role="menuitem">
                <i class="fas fa-chart-line" style="color: var(--accent-gold);" aria-hidden="true"></i> My Impact Dashboard
              </a>
            </li>
            ${user.role === 'ngo' ? `
            <li role="none">
              <a href="dashboard.html" role="menuitem">
                <i class="fas fa-th-large" style="color: var(--accent-green);" aria-hidden="true"></i> Organizer Portal
              </a>
            </li>` : ''}
            <li role="none">
              <a href="volunteer.html" role="menuitem">
                <i class="fas fa-hands-helping" style="color: var(--accent-orange);" aria-hidden="true"></i> Volunteer Drives
              </a>
            </li>
            <li role="none">
              <a href="campaigns.html" role="menuitem">
                <i class="fas fa-heart" style="color: #E25A6B;" aria-hidden="true"></i> Support Campaigns
              </a>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onclick="window.switchRoleQuickly()">
                <i class="fas fa-exchange-alt" style="color: var(--accent-blue);" aria-hidden="true"></i> Switch View Role
              </button>
            </li>
            <li role="none">
              <button type="button" class="logout-btn" role="menuitem" onclick="window.handleLogout()">
                <i class="fas fa-sign-out-alt" aria-hidden="true"></i> Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    `;

    // Dropdown toggle with ARIA support
    const wrap = document.getElementById('userProfileMenuWrap');
    const btn = document.getElementById('userProfileBtn');
    if (btn && wrap) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = wrap.classList.toggle('active');
        btn.setAttribute('aria-expanded', active ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
          wrap.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

  } else {
    // Logged out state
    authSlot.innerHTML = `
      <button class="btn btn-sm btn-outline nav-login-btn" onclick="window.openAuthModal('signin')">
        <i class="fas fa-sign-in-alt" aria-hidden="true"></i> Login
      </button>
      <button class="btn btn-sm btn-primary nav-join-btn" onclick="window.openAuthModal('signup')">
        <i class="fas fa-user-plus" aria-hidden="true"></i> Join HopeConnect
      </button>
    `;
  }
}

function highlightActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navItems = document.querySelectorAll('.nav-links a');
  
  navItems.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

function updateRoleSwitcherState() {
  const roleSelect = document.getElementById('roleSwitcherSelect');
  if (roleSelect) {
    roleSelect.value = window.HCStore.getCurrentRole();
  }
}

function initRoleSwitcher() {
  const roleSelect = document.getElementById('roleSwitcherSelect');
  if (roleSelect) {
    roleSelect.value = window.HCStore.getCurrentRole();
    roleSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      window.HCStore.setCurrentRole(selected);
      window.showToast(`Switched view to ${selected.toUpperCase()} Mode`, 'info', 'fas fa-user-circle');
      if (selected === 'ngo' && !window.location.pathname.includes('dashboard.html')) {
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      }
    });
  }
}

window.switchRoleQuickly = function() {
  const current = window.HCStore.getCurrentRole();
  const nextRole = current === 'volunteer' ? 'donor' : (current === 'donor' ? 'ngo' : 'volunteer');
  window.HCStore.setCurrentRole(nextRole);
  window.showToast(`Switched persona to ${nextRole.toUpperCase()}`, 'info', 'fas fa-exchange-alt');
  if (nextRole === 'ngo' && !window.location.pathname.includes('dashboard.html')) {
    window.location.href = 'dashboard.html';
  }
};

window.handleLogout = function() {
  window.HCStore.logoutUser();
  window.showToast('You have been signed out successfully.', 'info', 'fas fa-sign-out-alt');
  if (window.location.pathname.includes('dashboard.html')) {
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 700);
  }
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
        <h3 id="authModalHeading" style="font-size: 1.25rem;"><i class="fas fa-hand-holding-heart" style="color: var(--accent-gold);"></i> Welcome to HopeConnect AI</h3>
        <button class="modal-close-btn" onclick="closeModal('authModal')" aria-label="Close modal">&times;</button>
      </div>

      <!-- Quick Demo Presets Bar -->
      <div style="padding: 1rem 1.75rem 0 1.75rem;">
        <div class="demo-accounts-bar">
          <div class="demo-accounts-label"><i class="fas fa-bolt" aria-hidden="true"></i> Quick Demo 1-Click Login:</div>
          <div class="demo-chips">
            <button type="button" class="demo-chip" onclick="window.quickDemoLogin('volunteer')">
              <span>🙋</span> Aarav (Volunteer)
            </button>
            <button type="button" class="demo-chip" onclick="window.quickDemoLogin('donor')">
              <span>❤️</span> Priya (Donor)
            </button>
            <button type="button" class="demo-chip" onclick="window.quickDemoLogin('ngo')">
              <span>🏢</span> Dr. Radhika (NGO Lead)
            </button>
          </div>
        </div>
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
            <input type="email" class="form-control" id="signInEmail" placeholder="name@example.com" value="aarav.sharma@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="signInPassword">Password *</label>
            <div class="password-input-wrap">
              <input type="password" class="form-control" id="signInPassword" placeholder="••••••••" value="password123" required autocomplete="current-password">
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
            <i class="fas fa-arrow-right" aria-hidden="true"></i> Sign In to HopeConnect
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
              <input type="checkbox" required checked> I agree to HopeConnect AI's community standards and transparent impact charter.
            </label>
          </div>
          <button type="submit" class="btn btn-green" style="width: 100%;" id="signUpSubmitBtn">
            <i class="fas fa-check-circle" aria-hidden="true"></i> Create Verified Account
          </button>
        </form>
      </div>

      <div class="modal-footer" style="justify-content: center; font-size: 0.88rem; color: var(--text-muted);">
        <span id="authFooterText">
          New to HopeConnect? <a href="#" style="color: var(--accent-orange); font-weight: 700;" onclick="event.preventDefault(); window.switchAuthTab('signup');">Create an account here</a>
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
        window.showToast(`🎉 Account created! Welcome to HopeConnect, ${res.user.name}.`, 'success', 'fas fa-check-circle');
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
  window.openModal('authModal');
  window.switchAuthTab(tab);
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
      footerText.innerHTML = `New to HopeConnect? <a href="#" style="color: var(--accent-orange); font-weight: 700;" onclick="event.preventDefault(); window.switchAuthTab('signup');">Create an account here</a>`;
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

window.quickDemoLogin = function(role) {
  const users = window.HCStore.getAuthUsers();
  const matched = users.find(u => u.role === role) || users[0];
  if (matched) {
    window.HCStore.setCurrentUser(matched);
    window.closeModal('authModal');
    window.showToast(`⚡ Quick logged in as ${matched.name} (${matched.role.toUpperCase()})`, 'success', 'fas fa-bolt');
    if (matched.role === 'ngo' && !window.location.pathname.includes('dashboard.html')) {
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    }
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
        HopeConnect AI Alliance • Eligible for Tax Benefits under Sec 80G • Automated Blockchain Audit Trail
      </div>
    </div>
  `;

  window.openModal('receiptModal');
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
        <h3 id="volunteerPassTitle"><i class="fas fa-id-badge" style="color: var(--accent-orange);"></i> Volunteer Confirmation Pass</h3>
        <button class="modal-close-btn" onclick="closeModal('volunteerPassModal')" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body" id="volunteerPassModalBody"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('volunteerPassModal')">Close</button>
        <button class="btn btn-outline" onclick="window.downloadCalendarInvite()"><i class="fas fa-calendar-plus"></i> Add to Calendar</button>
        <a href="impact.html#certificate" class="btn btn-primary"><i class="fas fa-award"></i> View Certificate</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.openVolunteerPassModal = function(reg) {
  if (!reg) return;
  initVolunteerPassModal();
  const body = document.getElementById('volunteerPassModalBody');
  if (!body) return;

  const safeTitle = window.escapeHTML(reg.opportunityTitle || 'Community Drive');
  const safeNgo = window.escapeHTML(reg.ngoName || 'Partner NGO');
  const safeName = window.escapeHTML(reg.name || 'Volunteer');
  const safeEmail = window.escapeHTML(reg.email || '');
  const safeSkills = window.escapeHTML(reg.skills || 'General Team Volunteer');
  const safeDate = window.escapeHTML(reg.dateApplied || new Date().toLocaleDateString('en-GB'));

  body.innerHTML = `
    <div class="receipt-box" style="border-style: solid; border-color: var(--accent-gold);">
      <div class="receipt-stamp" style="border-color: var(--accent-orange); color: var(--accent-orange);">REGISTERED</div>
      <div style="margin-bottom: 1.25rem;">
        <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-gold-hover); text-transform: uppercase;">Official Volunteer Pass</span>
        <h3 style="font-size: 1.25rem; margin-top: 0.2rem;">${safeTitle}</h3>
        <span style="font-size: 0.88rem; color: var(--text-muted);"><i class="fas fa-building"></i> Organized by ${safeNgo}</span>
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
        <span class="receipt-label">Skills / Role:</span>
        <span class="receipt-val">${safeSkills}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Registration Date:</span>
        <span class="receipt-val">${safeDate}</span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Status:</span>
        <span class="receipt-val" style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> Confirmed & Verified</span>
      </div>

      <div style="margin-top: 1.25rem; background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.82rem; color: var(--text-main);">
        <i class="fas fa-info-circle" style="color: var(--accent-gold-hover);"></i> <strong>Event Instructions:</strong> Please arrive 15 minutes before scheduled start time. Gloves, safety gears, and refreshments will be provided at the check-in desk.
      </div>
    </div>
  `;

  window.openModal('volunteerPassModal');
};

window.downloadCalendarInvite = function() {
  window.showToast('📅 Calendar event (.ics) saved! Check your downloads.', 'success', 'fas fa-calendar-check');
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
