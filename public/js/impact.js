/**
 * ImpactHub - Platform Impact & Transparency Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initPlatformMetrics();
  initDonationCalculator();
  initCauseComparison();
  initCampaignVisualizations();
  initImpactCertificate();

  // Listen for reset or updates
  window.addEventListener('hc:data-reset', () => {
    initPlatformMetrics();
    initCauseComparison();
    initCampaignVisualizations();
  });
  window.addEventListener('hc:donation-added', () => {
    initPlatformMetrics();
    initCauseComparison();
    initCampaignVisualizations();
  });
});

/**
 * 1. Calculate and Render Aggregate Platform Metrics
 */
function initPlatformMetrics() {
  const campaigns = window.HCStore.getCampaigns();
  const ngos = window.HCStore.getNGOs();
  const opportunities = window.HCStore.getOpportunities();
  const donations = window.HCStore.getDonations();
  const registrations = window.HCStore.getVolunteerRegistrations();

  // Total funds raised across all campaigns
  const totalRaised = campaigns.reduce((acc, c) => acc + (c.raisedAmount || 0), 0);
  
  // Volunteer hours: base platform hours + user logged hours (approx 4h per registered drive)
  const baseVolunteerHours = 1240;
  const userHours = registrations.length * 4;
  const totalHours = baseVolunteerHours + userHours;

  // Beneficiaries reached calculation (e.g. approx 1 person per ₹45 raised)
  const totalBeneficiaries = Math.round(totalRaised / 42) + 3800;

  const fundsEl = document.getElementById('statTotalPlatformFunds');
  const hoursEl = document.getElementById('statTotalPlatformHours');
  const ngosEl = document.getElementById('statTotalPlatformNgos');
  const livesEl = document.getElementById('statTotalPlatformLives');

  if (fundsEl) fundsEl.textContent = '₹' + totalRaised.toLocaleString('en-IN');
  if (hoursEl) hoursEl.textContent = totalHours.toLocaleString('en-IN') + ' hrs';
  if (ngosEl) ngosEl.textContent = ngos.length + ' Verified';
  if (livesEl) livesEl.textContent = totalBeneficiaries.toLocaleString('en-IN') + '+';
}

/**
 * 2. Interactive Donation Impact Calculator
 */
const IMPACT_MULTIPLIERS = {
  'Education': {
    unit: 'students supported',
    ratio: 500, // ₹500 per student/month
    deliverable: (qty) => `Provides comprehensive educational kits, notebooks, and digital class access for <strong>${qty} underprivileged student${qty > 1 ? 's' : ''}</strong> for an entire school term.`
  },
  'Environment': {
    unit: 'native saplings planted & geotagged',
    ratio: 100, // ₹100 per sapling & maintenance
    deliverable: (qty) => `Funds planting, protective tree guards, and 2-year maintenance for <strong>${qty} native indigenous tree sapling${qty > 1 ? 's' : ''}</strong> along rural river basins.`
  },
  'Healthcare': {
    unit: 'diagnostic health checkups',
    ratio: 250, // ₹250 per diagnostic screening
    deliverable: (qty) => `Sponsors free mobile medical checkups, blood sugar screenings, and essential generic medicine for <strong>${qty} elderly villager${qty > 1 ? 's' : ''}</strong>.`
  },
  'Hunger Relief': {
    unit: 'nutritious warm meals',
    ratio: 35, // ₹35 per wholesome meal
    deliverable: (qty) => `Distributes <strong>${qty} fresh, warm nutritious mid-day meals</strong> to daily wage migrant families and slum community centers.`
  },
  'Animal Welfare': {
    unit: 'stray animals vaccinated & cared for',
    ratio: 400, // ₹400 per animal vaccination & feeding
    deliverable: (qty) => `Covers anti-rabies vaccination, emergency wound treatment, and rescue foster nutrition for <strong>${qty} stray animal${qty > 1 ? 's' : ''}</strong>.`
  }
};

let currentCalcCause = 'Education';
let currentCalcAmount = 1500;

function initDonationCalculator() {
  const causeSelect = document.getElementById('calcCauseSelect');
  const amountInput = document.getElementById('calcCustomAmount');
  const pillBtns = document.querySelectorAll('.calc-amount-pill');
  const resultDeliverableEl = document.getElementById('calcDeliverableText');
  const resultUnitsEl = document.getElementById('calcUnitsHighlight');
  const donateCauseBtn = document.getElementById('calcDonateLinkBtn');

  function updateCalculator() {
    const info = IMPACT_MULTIPLIERS[currentCalcCause] || IMPACT_MULTIPLIERS['Education'];
    const units = Math.max(1, Math.floor(currentCalcAmount / info.ratio));
    
    if (resultUnitsEl) {
      resultUnitsEl.textContent = `${units} ${info.unit}`;
    }
    if (resultDeliverableEl) {
      resultDeliverableEl.innerHTML = info.deliverable(units);
    }
    if (donateCauseBtn) {
      donateCauseBtn.href = `campaigns.html?category=${encodeURIComponent(currentCalcCause)}`;
      donateCauseBtn.innerHTML = `<i class="fas fa-hand-holding-heart"></i> Support an Active ${currentCalcCause} Campaign`;
    }
  }

  if (causeSelect) {
    causeSelect.addEventListener('change', (e) => {
      currentCalcCause = e.target.value;
      updateCalculator();
    });
  }

  if (amountInput) {
    amountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        currentCalcAmount = val;
        pillBtns.forEach(p => p.classList.remove('active'));
        updateCalculator();
      }
    });
  }

  pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pillBtns.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const val = parseInt(btn.getAttribute('data-amount'), 10);
      currentCalcAmount = val;
      if (amountInput) amountInput.value = val;
      updateCalculator();
    });
  });

  updateCalculator();
}

/**
 * 3. Cause-Wise Impact Breakdown
 */
function initCauseComparison() {
  const campaigns = window.HCStore.getCampaigns();
  const opportunities = window.HCStore.getOpportunities();

  const causes = ['Education', 'Environment', 'Healthcare', 'Child Welfare', 'Animal Welfare'];
  
  // Calculate funding per cause
  const fundingByCause = {};
  const volunteersByCause = {};

  causes.forEach(c => {
    fundingByCause[c] = 0;
    volunteersByCause[c] = 0;
  });

  campaigns.forEach(camp => {
    if (fundingByCause[camp.category] !== undefined) {
      fundingByCause[camp.category] += (camp.raisedAmount || 0);
    }
  });

  opportunities.forEach(opp => {
    if (volunteersByCause[opp.category] !== undefined) {
      volunteersByCause[opp.category] += (opp.volunteersRegistered || 0);
    }
  });

  const maxFunding = Math.max(...Object.values(fundingByCause), 1);
  const container = document.getElementById('causeBreakdownBars');
  if (container) {
    container.innerHTML = causes.map(cause => {
      const amount = fundingByCause[cause] || 0;
      const vols = volunteersByCause[cause] || 0;
      const pct = Math.round((amount / maxFunding) * 100);

      return `
        <div style="margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.35rem; font-size: 0.9rem;">
            <div>
              <strong>${cause}</strong>
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">${vols} volunteers deployed</span>
            </div>
            <div>
              <span style="font-weight: 700; color: var(--text-main);">₹${amount.toLocaleString('en-IN')}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);"> funded</span>
            </div>
          </div>
          <div style="height: 10px; background: var(--border-light); border-radius: var(--radius-pill); overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--accent-gold), var(--accent-green)); border-radius: var(--radius-pill); transition: width 0.8s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * 4. Campaign Progress Visualizations List
 */
function initCampaignVisualizations() {
  const container = document.getElementById('liveCampaignsProgressList');
  if (!container) return;

  const campaigns = window.HCStore.getCampaigns();

  container.innerHTML = campaigns.slice(0, 4).map(c => {
    const pct = Math.min(100, Math.round((c.raisedAmount / c.targetAmount) * 100));
    return `
      <div style="background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div>
            <span class="badge" style="background: var(--bg-primary); border: 1px solid var(--border-light); font-size: 0.72rem; margin-bottom: 0.25rem; display: inline-block;">${c.category}</span>
            <h4 style="font-size: 1rem; margin: 0; color: var(--text-main);">${c.title}</h4>
            <span style="font-size: 0.82rem; color: var(--accent-orange); font-weight: 600;">${c.ngoName}</span>
          </div>
          <div style="text-align: right; min-width: 90px;">
            <span style="font-size: 1.15rem; font-weight: 800; color: var(--accent-green);">${pct}%</span>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${c.supportersCount || 12} Donors</div>
          </div>
        </div>

        <div style="height: 8px; background: var(--border-light); border-radius: var(--radius-pill); overflow: hidden; margin-top: 0.35rem;">
          <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--accent-gold), var(--accent-orange)); border-radius: var(--radius-pill);"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); margin-top: 0.15rem;">
          <span>Raised: <strong style="color: var(--text-main);">₹${(c.raisedAmount || 0).toLocaleString('en-IN')}</strong></span>
          <span>Target: <strong>₹${c.targetAmount.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 5. Certificate Preview Sync
 */
function initImpactCertificate() {
  const nameInput = document.getElementById('certVolunteerName');
  const user = window.HCStore.getCurrentUser();
  if (nameInput && user && user.name) {
    nameInput.value = user.name;
  }
}
