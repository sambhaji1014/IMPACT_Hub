/**
 * HopeConnect AI - Dynamic Donation Impact Calculator
 */

document.addEventListener('DOMContentLoaded', () => {
  initImpactCalculator();
});

function initImpactCalculator() {
  const amountSlider = document.getElementById('calcSlider');
  const amountDisplay = document.getElementById('calcAmountDisplay');
  const presetButtons = document.querySelectorAll('.amount-preset-btn');
  const impactItemsList = document.getElementById('impactItemsList');
  const dynamicHeadingAmount = document.getElementById('dynamicHeadingAmount');
  const calcDonateBtn = document.getElementById('calcDonateBtn');

  if (!amountSlider && !presetButtons.length) return;

  function updateImpactUI(amount) {
    amount = parseInt(amount, 10) || 100;
    
    if (amountSlider) amountSlider.value = amount;
    if (amountDisplay) amountDisplay.textContent = `₹${amount.toLocaleString('en-IN')}`;
    if (dynamicHeadingAmount) dynamicHeadingAmount.textContent = `₹${amount.toLocaleString('en-IN')}`;

    // Highlight matching preset button if any
    presetButtons.forEach(btn => {
      if (parseInt(btn.getAttribute('data-amount'), 10) === amount) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Calculate dynamic impact equivalents
    if (impactItemsList) {
      const studentSupplies = Math.max(1, Math.floor(amount / 200));
      const treesPlanted = Math.max(2, Math.floor(amount / 100));
      const mealsServed = Math.max(3, Math.floor(amount / 50));
      const healthKits = Math.max(1, Math.floor(amount / 500));

      impactItemsList.innerHTML = `
        <li class="impact-item">
          <div class="impact-item-icon"><i class="fas fa-book-reader" style="color: var(--accent-orange);"></i></div>
          <div>
            <strong>Educational Supplies for ${studentSupplies} Student${studentSupplies > 1 ? 's' : ''}</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Provides notebooks, stationery, and learning guides for a school term.</div>
          </div>
        </li>
        <li class="impact-item">
          <div class="impact-item-icon"><i class="fas fa-tree" style="color: var(--accent-green);"></i></div>
          <div>
            <strong>${treesPlanted} Native Saplings Planted & Nurtured</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Includes organic compost, drip support, and 2-year survival tracking.</div>
          </div>
        </li>
        <li class="impact-item">
          <div class="impact-item-icon"><i class="fas fa-utensils" style="color: var(--accent-gold-hover);"></i></div>
          <div>
            <strong>${mealsServed} Nutritious Warm Meals</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Freshly prepared hot meals distributed in child shelter centers.</div>
          </div>
        </li>
        ${amount >= 500 ? `
        <li class="impact-item">
          <div class="impact-item-icon"><i class="fas fa-briefcase-medical" style="color: var(--accent-blue);"></i></div>
          <div>
            <strong>${healthKits} Comprehensive First-Aid & Health Kit${healthKits > 1 ? 's' : ''}</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Essential sanitization, basic diagnostic kits for elderly rural patients.</div>
          </div>
        </li>` : ''}
      `;
    }

    if (calcDonateBtn) {
      calcDonateBtn.onclick = () => {
        if (typeof window.openDonationModal === 'function') {
          window.openDonationModal('camp-1', amount);
        } else {
          window.location.href = `campaigns.html?donateAmount=${amount}`;
        }
      };
    }
  }

  // Preset button listeners
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-amount');
      updateImpactUI(val);
    });
  });

  // Slider listener
  if (amountSlider) {
    amountSlider.addEventListener('input', (e) => {
      updateImpactUI(e.target.value);
    });
  }

  // Initialize with ₹1,000 default
  updateImpactUI(1000);
}
