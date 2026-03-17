/* ============================================
   Pinpoint 311 — Main JavaScript
   ============================================ */

// --- Vercel Web Analytics ---
import { inject } from '@vercel/analytics';
inject();

// --- Scroll-based nav style ---
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

// --- Mobile nav toggle ---
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// --- IntersectionObserver for scroll animations ---
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.animate-in').forEach(el => observer.observe(el));

// --- Portal tabs ---
const portalTabs = document.querySelectorAll('.portal-tab');
const portalPanels = document.querySelectorAll('.portal-panel');

portalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const portal = tab.dataset.portal;
    portalTabs.forEach(t => t.classList.remove('active'));
    portalPanels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`portal-${portal}`).classList.add('active');
  });
});

// --- Onboarding Wizard ---
const wizard = document.getElementById('wizard');
const totalSteps = 5;
let currentStep = 0;

function updateWizard() {
  // Update step visibility
  wizard.querySelectorAll('.wizard-step').forEach((step, i) => {
    step.classList.remove('active');
    if (i === currentStep) step.classList.add('active');
    // Show success step
    if (currentStep === 5 && parseInt(step.dataset.wizardStep) === 5) {
      step.style.display = 'block';
      step.classList.add('active');
    }
  });

  // Update progress bar
  const progressBar = document.getElementById('wizardProgressBar');
  const pct = Math.min(((currentStep + 1) / totalSteps) * 100, 100);
  progressBar.style.width = `${pct}%`;

  // Update step dots
  const dots = document.querySelectorAll('.wizard-step-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i < currentStep) dot.classList.add('completed');
    if (i === currentStep) dot.classList.add('active');
  });

  // Hide dots/progress on success
  const indicator = document.getElementById('wizardStepsIndicator');
  const progressWrapper = wizard.querySelector('.wizard-progress');
  if (currentStep >= 5) {
    indicator.style.display = 'none';
    progressWrapper.style.display = 'none';
  }

  // Generate summary on step 4
  if (currentStep === 4) {
    generateSummary();
  }
}

// Next / Prev buttons
wizard.addEventListener('click', (e) => {
  if (e.target.closest('.wizard-next')) {
    if (currentStep < totalSteps) {
      currentStep++;
      updateWizard();
    }
  }
  if (e.target.closest('.wizard-prev')) {
    if (currentStep > 0) {
      currentStep--;
      updateWizard();
    }
  }
});

// Submit button
document.getElementById('wizardSubmit').addEventListener('click', () => {
  currentStep = 5;
  updateWizard();
});

// --- Summary generation ---
function generateSummary() {
  const townName = document.getElementById('townName').value || 'Your Town';
  const stateName = document.getElementById('stateName').value || 'Not specified';
  const population = document.getElementById('population').value || 'Not specified';
  const currentSystem = document.getElementById('currentSystem').value || 'Not specified';

  const hasDocker = document.getElementById('hasDocker').checked;
  const hasDomain = document.getElementById('hasDomain').checked;
  const hasGCP = document.getElementById('hasGCP').checked;
  const hasIT = document.getElementById('hasIT').checked;

  const featAI = document.getElementById('featAI').checked;
  const featSMS = document.getElementById('featSMS').checked;
  const featResearch = document.getElementById('featResearch').checked;
  const featBranding = document.getElementById('featBranding').checked;
  const featTranslate = document.getElementById('featTranslate').checked;

  // Readiness score
  const readinessItems = [hasDocker, hasDomain, hasGCP, hasIT];
  const readinessScore = readinessItems.filter(Boolean).length;
  const readinessLabel = readinessScore >= 3 ? 'Ready to deploy' : readinessScore >= 1 ? 'Some setup needed' : 'Full setup needed';

  // Features list
  const features = [];
  if (featAI) features.push('AI Analysis');
  if (featSMS) features.push('SMS Alerts');
  if (featResearch) features.push('Research Suite');
  if (featBranding) features.push('Custom Branding');
  if (featTranslate) features.push('Multi-Language');

  // Record retention by state
  const retentionMap = {
    'Texas': '10 years', 'New Jersey': '7 years', 'Pennsylvania': '7 years', 'Wisconsin': '7 years',
    'New York': '6 years', 'Michigan': '6 years', 'Washington': '6 years', 'Connecticut': '6 years',
    'Georgia': '3 years', 'Massachusetts': '3 years'
  };
  const retention = retentionMap[stateName] || '5 years (default)';

  // Population labels
  const populationLabels = {
    '<5k': 'Under 5,000',
    '5k-25k': '5,000 – 25,000',
    '25k-100k': '25,000 – 100,000',
    '100k-500k': '100,000 – 500,000',
    '500k+': '500,000+'
  };

  const currentSystemLabels = {
    'none': 'None / Phone only',
    'seeclickfix': 'SeeClickFix',
    'qalert': 'QAlert',
    'other-vendor': 'Other vendor',
    'custom': 'Custom/in-house'
  };

  const summaryCard = document.getElementById('summaryCard');
  summaryCard.innerHTML = `
    <div class="summary-section">
      <h4>📋 Municipality Profile</h4>
      <div class="summary-row"><span class="summary-label">Municipality</span><span class="summary-value">${townName}, ${stateName}</span></div>
      <div class="summary-row"><span class="summary-label">Population</span><span class="summary-value">${populationLabels[population] || population}</span></div>
      <div class="summary-row"><span class="summary-label">Current System</span><span class="summary-value">${currentSystemLabels[currentSystem] || currentSystem}</span></div>
      <div class="summary-row"><span class="summary-label">Record Retention</span><span class="summary-value">${retention}</span></div>
    </div>
    <div class="summary-section">
      <h4>🔧 Technical Readiness</h4>
      <div class="summary-row"><span class="summary-label">Docker Host</span><span class="summary-value">${hasDocker ? '✅ Ready' : '❌ Needed'}</span></div>
      <div class="summary-row"><span class="summary-label">Custom Domain</span><span class="summary-value">${hasDomain ? '✅ Ready' : '❌ Needed'}</span></div>
      <div class="summary-row"><span class="summary-label">Google Cloud</span><span class="summary-value">${hasGCP ? '✅ Ready' : '❌ Needed'}</span></div>
      <div class="summary-row"><span class="summary-label">IT Staff</span><span class="summary-value">${hasIT ? '✅ Available' : '❌ Needed'}</span></div>
      <div class="summary-row"><span class="summary-label">Overall</span><span class="summary-value" style="color: var(--accent-primary)">${readinessLabel} (${readinessScore}/4)</span></div>
    </div>
    <div class="summary-section">
      <h4>🚀 Selected Features</h4>
      <div class="summary-row"><span class="summary-label">Modules</span><span class="summary-value">${features.join(', ') || 'None selected'}</span></div>
      <div class="summary-row"><span class="summary-label">Est. Hosting Cost</span><span class="summary-value" style="color: var(--accent-primary)">$5–10/month</span></div>
      <div class="summary-row"><span class="summary-label">Licensing Cost</span><span class="summary-value" style="color: var(--accent-primary)">$0 (MIT License)</span></div>
    </div>
  `;
}
