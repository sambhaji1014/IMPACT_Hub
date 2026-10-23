/**
 * ImpactHub - AI Impact Match Recommendation Engine
 * Transparent, Multi-Factor Rule-Based Recommendation Algorithm
 * Matches: Cause (40%) + Location/City (25%) + Skills (20%) + Availability (15%)
 * Formatted with clear reasoning and explanation of recommendation scores.
 */

document.addEventListener('DOMContentLoaded', () => {
  initRecommendationEngine();
});

// User preference state
const userAIPreferences = {
  cause: 'Environment',
  city: 'All',
  skill: 'Gardening, Nature',
  time: 'Weekends'
};

function initRecommendationEngine() {
  const causeButtons = document.querySelectorAll('.ai-chip-btn');
  const citySelect = document.getElementById('aiFilterCity');
  const skillSelect = document.getElementById('aiFilterSkill');
  const timeSelect = document.getElementById('aiFilterTime');
  const recsContainer = document.getElementById('aiRecsContainer');

  if (!recsContainer) return;

  // Sync initial user from store if available
  const user = window.HCStore ? window.HCStore.getCurrentUser() : null;
  if (user) {
    if (user.city && user.city.includes('Pune')) userAIPreferences.city = 'Pune';
    if (user.city && user.city.includes('Mumbai')) userAIPreferences.city = 'Mumbai';
    if (user.skills) userAIPreferences.skill = user.skills;
  }

  // Cause Chip Buttons
  causeButtons.forEach(button => {
    button.addEventListener('click', () => {
      causeButtons.forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
      userAIPreferences.cause = button.getAttribute('data-cause');
      runAIMatchPipeline();
    });
  });

  // Secondary Preference Controls (if present on page)
  if (citySelect) {
    citySelect.value = userAIPreferences.city;
    citySelect.addEventListener('change', (e) => {
      userAIPreferences.city = e.target.value;
      runAIMatchPipeline();
    });
  }

  if (skillSelect) {
    skillSelect.addEventListener('change', (e) => {
      userAIPreferences.skill = e.target.value;
      runAIMatchPipeline();
    });
  }

  if (timeSelect) {
    timeSelect.addEventListener('change', (e) => {
      userAIPreferences.time = e.target.value;
      runAIMatchPipeline();
    });
  }

  // Initial Run
  runAIMatchPipeline();
}

function runAIMatchPipeline() {
  const aiResponseText = document.getElementById('aiResponseText');
  const recsContainer = document.getElementById('aiRecsContainer');
  if (!recsContainer) return;

  if (aiResponseText) {
    aiResponseText.innerHTML = `
      <i class="fas fa-spinner fa-spin" style="color: var(--accent-orange);" aria-hidden="true"></i> 
      Evaluating cause alignment for <strong>${window.escapeHTML(userAIPreferences.cause)}</strong> 
      ${userAIPreferences.city !== 'All' ? `near <strong>${window.escapeHTML(userAIPreferences.city)}</strong>` : ''}...
    `;
    setTimeout(() => {
      aiResponseText.innerHTML = `
        ✨ <strong>AI Impact Match Complete:</strong> Curated top opportunities scoring up to 98% compatibility with your cause preference 
        (<strong>${window.escapeHTML(userAIPreferences.cause)}</strong>), your skills, and schedule.
      `;
      generateScoredRecommendations();
    }, 280);
  } else {
    generateScoredRecommendations();
  }
}

function calculateMatchScore(opp, preferences) {
  let score = 0;
  let reasons = [];

  // 1. Cause Alignment (40 Points)
  if (opp.category.toLowerCase() === preferences.cause.toLowerCase()) {
    score += 40;
    reasons.push(`Direct match with your focus on ${opp.category}`);
  } else {
    score += 15; // Cross-cause bonus
  }

  // 2. Location Alignment (25 Points)
  const oppLoc = (opp.location || opp.city || '').toLowerCase();
  const prefCity = (preferences.city || 'All').toLowerCase();
  if (prefCity === 'all') {
    score += 25;
    reasons.push('Matches open regional accessibility');
  } else if (oppLoc.includes(prefCity)) {
    score += 25;
    reasons.push(`Convenient location in ${preferences.city}`);
  } else {
    score += 8;
  }

  // 3. Skill & Interest Fit (20 Points)
  const skillKeywords = (preferences.skill || '').toLowerCase().split(/[\s,]+/);
  const oppText = `${opp.title} ${opp.description} ${opp.skillLevel || ''}`.toLowerCase();
  let matchedSkills = skillKeywords.filter(k => k.length > 3 && oppText.includes(k));
  if (matchedSkills.length > 0) {
    score += 20;
    reasons.push(`Utilizes relevant skill keywords (${matchedSkills.slice(0, 2).join(', ')})`);
  } else {
    score += 12;
    reasons.push('Welcomes general volunteer participation');
  }

  // 4. Availability & Schedule (15 Points)
  const oppDate = (opp.date || '').toLowerCase();
  const prefTime = (preferences.time || 'Weekends').toLowerCase();
  if (prefTime.includes('weekend') && (oppDate.includes('saturday') || oppDate.includes('sunday') || oppDate.includes('weekend'))) {
    score += 15;
    reasons.push('Scheduled on weekends');
  } else {
    score += 10;
  }

  const finalScore = Math.min(98, Math.max(65, score));
  return {
    score: finalScore,
    reasonText: reasons.join(' • ')
  };
}

function generateScoredRecommendations() {
  const recsContainer = document.getElementById('aiRecsContainer');
  if (!recsContainer || !window.HCStore) return;

  const allOpps = window.HCStore.getOpportunities();
  const allNgos = window.HCStore.getNGOs();

  // Score each opportunity
  const scoredOpps = allOpps.map(opp => {
    const analysis = calculateMatchScore(opp, userAIPreferences);
    return {
      opp,
      score: analysis.score,
      reasonText: analysis.reasonText
    };
  });

  // Sort descending by match score
  scoredOpps.sort((a, b) => b.score - a.score);
  const topOpps = scoredOpps.slice(0, 3);

  // Find relevant NGO partner
  const relevantNgos = allNgos.filter(n => n.category.toLowerCase() === userAIPreferences.cause.toLowerCase());
  const topNgo = relevantNgos.length > 0 ? relevantNgos[0] : allNgos[0];

  const esc = (s) => (window.escapeHTML ? window.escapeHTML(s) : String(s || ''));

  let html = `
    <div style="margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
      <span style="font-size: 0.82rem; color: var(--text-muted);">
        <i class="fas fa-check-double" style="color: var(--accent-green);"></i> 
        Transparent Deterministic Model: <strong>${userAIPreferences.cause}</strong> | City: <strong>${userAIPreferences.city}</strong>
      </span>
      <span class="section-badge" style="background: var(--accent-gold-light); color: #B38600; font-size: 0.75rem; padding: 0.2rem 0.55rem;">
        <i class="fas fa-brain"></i> Multi-Factor Weighted Fit
      </span>
    </div>
  `;

  topOpps.forEach(({ opp, score, reasonText }) => {
    const scoreColor = score >= 85 ? 'var(--accent-green)' : (score >= 75 ? 'var(--accent-orange)' : 'var(--accent-gold-hover)');
    const scoreBg = score >= 85 ? 'var(--accent-green-light)' : (score >= 75 ? 'var(--accent-orange-light)' : 'var(--accent-gold-light)');

    html += `
      <div class="rec-card" style="margin-bottom: 1rem; position: relative;">
        <img src="${esc(opp.image)}" alt="${esc(opp.title)}" loading="lazy">
        <div class="rec-card-content">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
              <span class="section-badge" style="padding: 0.15rem 0.55rem; font-size: 0.72rem; margin-bottom: 0;">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i> ${esc(opp.date)}
              </span>
              <span style="background: ${scoreBg}; color: ${scoreColor}; font-weight: 800; font-size: 0.78rem; padding: 0.2rem 0.55rem; border-radius: var(--radius-pill); border: 1px solid ${scoreColor}40;">
                <i class="fas fa-sparkles"></i> ${score}% Fit
              </span>
            </div>

            <h4 style="font-size: 1.05rem; margin-bottom: 0.25rem;">${esc(opp.title)}</h4>
            <p style="font-size: 0.82rem; margin-bottom: 0.4rem; color: var(--text-muted);">
              <i class="fas fa-building" style="color: var(--accent-orange);" aria-hidden="true"></i> <strong>${esc(opp.ngoName)}</strong> • 
              <i class="fas fa-map-marker-alt" style="color: #E25A6B;" aria-hidden="true"></i> ${esc(opp.location)}
            </p>

            <div style="background: var(--bg-primary); padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-light); font-size: 0.76rem; color: var(--text-main); margin-bottom: 0.65rem; line-height: 1.4;">
              <i class="fas fa-info-circle" style="color: var(--accent-blue);"></i> <strong>Why Recommended:</strong> ${esc(reasonText)}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.8rem; color: var(--accent-green); font-weight: 600;">
              <i class="fas fa-users" aria-hidden="true"></i> ${Number(opp.volunteersRegistered || 0)}/${Number(opp.volunteersNeeded || 0)} Joined
            </span>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-secondary" onclick="window.openOpportunityDetailsModal('${opp.id}')">
                Details
              </button>
              <a href="volunteer.html?opp=${encodeURIComponent(opp.id)}&search=${encodeURIComponent(opp.title)}" class="btn btn-sm btn-primary">
                Join Drive
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  if (topNgo) {
    html += `
      <div class="rec-card" style="background: linear-gradient(135deg, #FFFFFF, #FFFDF5); border: 1.5px solid var(--accent-gold); margin-top: 1rem;">
        <img src="${esc(topNgo.logo)}" alt="${esc(topNgo.name)}" style="border-radius: 50%; width: 70px; height: 70px; align-self: center;" loading="lazy">
        <div class="rec-card-content">
          <div>
            <span class="section-badge" style="background: var(--accent-green-light); color: var(--accent-green); padding: 0.15rem 0.6rem; font-size: 0.72rem; margin-bottom: 0.35rem;">
              <i class="fas fa-check-circle" aria-hidden="true"></i> Recommended Verified NGO
            </span>
            <h4 style="font-size: 1.05rem;">${esc(topNgo.name)}</h4>
            <p style="font-size: 0.82rem; margin-bottom: 0.4rem;">${esc(topNgo.description)}</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              <i class="fas fa-star" style="color: var(--accent-gold);" aria-hidden="true"></i> ${Number(topNgo.rating || 4.8)} Community Trust Rating
            </span>
            <a href="ngos.html?search=${encodeURIComponent(topNgo.name)}" class="btn btn-sm btn-secondary">
              View Profile
            </a>
          </div>
        </div>
      </div>
    `;
  }

  recsContainer.innerHTML = html;
}

// Global hook to trigger AI match update from anywhere
window.triggerAIMatch = function(cause, city, skill) {
  if (cause) userAIPreferences.cause = cause;
  if (city) userAIPreferences.city = city;
  if (skill) userAIPreferences.skill = skill;
  runAIMatchPipeline();
};
