// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

/**
 * FireClaw Dashboard - Frontend Logic
 */

// State
let currentPage = 'overview';
let auditPage = 0;
const auditPageSize = 50;
let refreshInterval = null;
let allDomains = { trusted: [], neutral: [], suspicious: [], blocked: [] };
let domainSearchQuery = '';
const DOMAINS_PER_TIER = 20;

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const userEmailSpan = document.getElementById('user-email');
const pageTitle = document.getElementById('page-title');

let currentAuthMethod = 'password'; // track what the server is configured for

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check setup status first
  const setupStatus = await checkSetup();
  
  if (!setupStatus.setupComplete) {
    showSetup();
    initSetupWizard();
    return;
  }
  
  currentAuthMethod = setupStatus.authMethod || 'password';
  
  // Check if already authenticated
  const authStatus = await checkAuth();
  
  if (authStatus.authenticated) {
    showDashboard(authStatus.email);
  } else {
    showLogin();
  }
  
  // Register all dashboard event listeners
  initDashboardListeners();
});

// Dashboard event listener registration (called once)
function initDashboardListeners() {
  if (window.dashboardListenersAttached) return;
  window.dashboardListenersAttached = true;

  logoutBtn.addEventListener('click', logout);
  refreshBtn.addEventListener('click', () => loadPage(currentPage));

  // Password login
  const pwLoginBtn = document.getElementById('password-login-btn');
  const pwLoginInput = document.getElementById('password-login-input');
  if (pwLoginBtn) {
    pwLoginBtn.addEventListener('click', loginWithPassword);
  }
  if (pwLoginInput) {
    pwLoginInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loginWithPassword();
    });
  }

  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });

  // Audit log filters
  document.getElementById('audit-search')?.addEventListener('input', debounce(loadAuditLog, 500));
  document.getElementById('audit-severity-filter')?.addEventListener('change', loadAuditLog);
  document.getElementById('audit-domain-filter')?.addEventListener('input', debounce(loadAuditLog, 500));
  document.getElementById('audit-prev')?.addEventListener('click', () => {
    if (auditPage > 0) {
      auditPage--;
      loadAuditLog();
    }
  });
  document.getElementById('audit-next')?.addEventListener('click', () => {
    auditPage++;
    loadAuditLog();
  });

  // Auto-block threshold slider label
  const abSlider = document.getElementById('setting-auto-block-threshold');
  if (abSlider) {
    abSlider.addEventListener('input', () => updateAutoBlockLabel(abSlider.value));
  }

  // Domain management
  document.getElementById('add-domain-btn')?.addEventListener('click', addDomain);
  document.getElementById('domain-search')?.addEventListener('input', debounce(filterDomains, 300));

  // Accordion functionality
  initAccordions();
}

// Accordion initialization
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const tier = header.dataset.tier;
      const content = document.querySelector(`[data-tier-content="${tier}"]`);
      const isActive = content.classList.contains('active');
      
      // Toggle
      if (isActive) {
        content.classList.remove('active');
        header.classList.remove('active');
      } else {
        content.classList.add('active');
        header.classList.add('active');
      }
    });
  });
  
  // Set first accordion open by default
  const firstHeader = document.querySelector('.accordion-header[data-tier="trusted"]');
  if (firstHeader) {
    firstHeader.classList.add('active');
  }
}

// Authentication
async function checkSetup() {
  try {
    const response = await fetch('/api/setup/status');
    return await response.json();
  } catch { return { setupComplete: false }; }
}

async function checkAuth() {
  try {
    const response = await fetch('/api/auth/status');
    return await response.json();
  } catch (error) {
    console.error('Auth check failed:', error);
    return { authenticated: false };
  }
}

function showSetup() {
  setupScreen.classList.add('active');
  loginScreen.classList.remove('active');
  dashboardScreen.classList.remove('active');
}

function initSetupWizard() {
  const selectedMethod = 'password';
  const pwFields = document.getElementById('setup-password-fields');
  if (pwFields) pwFields.classList.remove('hidden');

  const setupSaveBtn = document.getElementById('setup-save-btn');
  if (!setupSaveBtn) return;

  setupSaveBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('setup-error');
    if (!errorEl) return;
    errorEl.classList.add('hidden');

    const passwordInput = document.getElementById('setup-password');
    const confirmInput = document.getElementById('setup-password-confirm');
    if (!passwordInput || !confirmInput) {
      errorEl.textContent = 'Setup form elements not found';
      errorEl.classList.remove('hidden');
      return;
    }

    const body = { 
      method: selectedMethod,
      password: passwordInput.value,
    };
    const confirm = confirmInput.value;
    
    if (!body.password || body.password.length < 8) { 
      errorEl.textContent = 'Password must be at least 8 characters'; 
      errorEl.classList.remove('hidden'); 
      return; 
    }
    if (body.password !== confirm) { 
      errorEl.textContent = 'Passwords do not match'; 
      errorEl.classList.remove('hidden'); 
      return; 
    }

    try {
      const resp = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (resp.ok) {
        currentAuthMethod = selectedMethod;
        if (data.recoveryKey) {
          alert(`SAVE YOUR RECOVERY KEY\n\n${data.recoveryKey}\n\nThis key is also saved to recovery-key.txt on the server.\nYou'll need it if you forget your password.`);
        }
        // Show onboarding wizard instead of going straight to dashboard
        showOnboarding();
      } else {
        errorEl.textContent = data.error;
        errorEl.classList.remove('hidden');
      }
    } catch (e) {
      errorEl.textContent = 'Setup failed: ' + e.message;
      errorEl.classList.remove('hidden');
    }
  });
}

// Onboarding wizard (task 4)
function showOnboarding() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('onboarding-screen').classList.add('active');
  initOnboarding();
}

function initOnboarding() {
  const saveBtn = document.getElementById('onboard-save-btn');
  const skipBtn = document.getElementById('onboard-skip-btn');
  
  // Populate model dropdown based on provider
  function populateOnboardModels(provider) {
    const modelSelect = document.getElementById('onboard-llm-model');
    const models = LLM_MODELS[provider] || [];
    modelSelect.innerHTML = models.map(m =>
      `<option value="${m.value}">${m.label}</option>`
    ).join('');
  }
  
  // Initial populate
  populateOnboardModels('anthropic');
  
  // Provider change handler
  document.getElementById('onboard-llm-provider').addEventListener('change', (e) => {
    populateOnboardModels(e.target.value);
    updateOnboardChecklist();
  });
  
  // API key toggle
  document.getElementById('onboard-toggle-api-key').addEventListener('click', () => {
    const input = document.getElementById('onboard-llm-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  
  // Checklist updates
  function updateOnboardChecklist() {
    const url = document.getElementById('onboard-gateway-url').value.trim();
    const token = document.getElementById('onboard-gateway-token').value.trim();
    const provider = document.getElementById('onboard-llm-provider').value;
    const apiKey = document.getElementById('onboard-llm-api-key').value.trim();
    
    const ocItem = document.getElementById('check-openclaw');
    const llmItem = document.getElementById('check-llm');
    
    if (url && token) {
      ocItem.classList.add('completed');
      ocItem.querySelector('.check-icon').className = 'check-icon check-complete';
    } else {
      ocItem.classList.remove('completed');
      ocItem.querySelector('.check-icon').className = 'check-icon check-incomplete';
    }
    
    if (provider && apiKey) {
      llmItem.classList.add('completed');
      llmItem.querySelector('.check-icon').className = 'check-icon check-complete';
    } else {
      llmItem.classList.remove('completed');
      llmItem.querySelector('.check-icon').className = 'check-icon check-incomplete';
    }
  }
  
  // Listen for input changes
  ['onboard-gateway-url', 'onboard-gateway-token', 'onboard-llm-api-key'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateOnboardChecklist);
  });
  
  saveBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('onboard-error');
    errorEl.classList.add('hidden');
    const url = document.getElementById('onboard-gateway-url').value.trim();
    const token = document.getElementById('onboard-gateway-token').value.trim();
    const provider = document.getElementById('onboard-llm-provider').value;
    const model = document.getElementById('onboard-llm-model').value;
    const apiKey = document.getElementById('onboard-llm-api-key').value.trim();
    
    if (!url) {
      errorEl.textContent = 'Gateway URL is required';
      errorEl.classList.remove('hidden');
      return;
    }
    
    try {
      const settings = { openclawUrl: url, openclawToken: token };
      
      // Include LLM settings if provided
      if (provider) {
        settings.llm = { provider, model };
        if (apiKey) {
          settings.llm.apiKey = apiKey;
        }
      }
      
      const resp = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (resp.ok) {
        showDashboard('admin');
      } else {
        errorEl.textContent = 'Failed to save settings';
        errorEl.classList.remove('hidden');
      }
    } catch (e) {
      errorEl.textContent = 'Error: ' + e.message;
      errorEl.classList.remove('hidden');
    }
  });
  
  skipBtn.addEventListener('click', () => {
    showDashboard('admin');
  });
}

async function loginWithPassword() {
  const input = document.getElementById('password-login-input');
  const errorEl = document.getElementById('login-password-error');
  errorEl.classList.add('hidden');
  const password = input.value;
  if (!password) { errorEl.textContent = 'Enter your password'; errorEl.classList.remove('hidden'); return; }
  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await resp.json();
    if (resp.ok) {
      showDashboard('admin');
    } else {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  } catch (e) {
    errorEl.textContent = 'Connection error';
    errorEl.classList.remove('hidden');
  }
}

// Recovery flow
document.getElementById('show-recovery-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form-password').classList.add('hidden');
  document.getElementById('login-form-recovery').classList.remove('hidden');
});

document.getElementById('back-to-login-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form-recovery').classList.add('hidden');
  document.getElementById('login-form-password').classList.remove('hidden');
});

document.getElementById('recovery-submit-btn')?.addEventListener('click', async () => {
  const key = document.getElementById('recovery-key-input').value.trim();
  const newPw = document.getElementById('recovery-new-password').value;
  const errorEl = document.getElementById('recovery-error');
  const successEl = document.getElementById('recovery-success');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!key || !newPw) { errorEl.textContent = 'Both fields required'; errorEl.classList.remove('hidden'); return; }
  if (newPw.length < 8) { errorEl.textContent = 'Password must be at least 8 characters'; errorEl.classList.remove('hidden'); return; }

  try {
    const resp = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryKey: key, newPassword: newPw })
    });
    const data = await resp.json();
    if (resp.ok) {
      successEl.textContent = 'Password reset! A new recovery key has been saved to the server.';
      successEl.classList.remove('hidden');
      setTimeout(() => showDashboard('admin'), 2000);
    } else {
      errorEl.textContent = data.error || 'Recovery failed';
      errorEl.classList.remove('hidden');
    }
  } catch (e) {
    errorEl.textContent = 'Connection error';
    errorEl.classList.remove('hidden');
  }
});

// OTP functions removed - password-only auth

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout failed:', error);
  }
  
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  showLogin();
}

function showLogin() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  loginScreen.classList.add('active');

  // Password-only login
  const pwLoginForm = document.getElementById('login-form-password');
  if (pwLoginForm) {
    pwLoginForm.classList.remove('hidden');
  }
  
  // Auto-check for updates (task 7)
  checkUpdateBanner();
}

async function checkUpdateBanner() {
  try {
    const resp = await fetch('/api/check-updates');
    const data = await resp.json();
    const banner = document.getElementById('update-banner');
    if (data.updateAvailable && banner) {
      banner.classList.remove('hidden');
    }
  } catch {}
}

function showDashboard(email) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  dashboardScreen.classList.add('active');
  userEmailSpan.textContent = email;
  
  // Ensure dashboard listeners are registered (needed after setup/onboarding flow)
  initDashboardListeners();
  
  // Load initial page
  navigateTo('overview');
  
  // Set up auto-refresh
  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      loadPage(currentPage);
    }, 5000);
  }
}

// Error display functions removed - errors handled inline in each form

// Navigation
function navigateTo(page) {
  currentPage = page;
  
  // Reset settings loaded flag when navigating away, so it reloads fresh next visit
  if (page !== 'settings') {
    window._settingsLoaded = false;
  }
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Update pages
  document.querySelectorAll('.page').forEach(p => {
    if (p.id === `page-${page}`) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
  
  // Update title
  const titles = {
    overview: 'Overview',
    audit: 'Audit Log',
    domains: 'Domain Management',
    config: 'Configuration',
    threats: 'Threat Feed',
    alerts: 'Alerts',
    settings: 'Settings'
  };
  pageTitle.textContent = titles[page] || 'Dashboard';
  
  // Load page data
  loadPage(page);
}

async function loadPage(page) {
  switch (page) {
    case 'overview':
      await loadOverview();
      break;
    case 'audit':
      await loadAuditLog();
      break;
    case 'domains':
      await loadDomains();
      break;
    case 'config':
      await loadConfig();
      break;
    case 'threats':
      await loadThreatFeed();
      break;
    case 'alerts':
      await loadAlerts();
      break;
    case 'settings':
      // Don't auto-refresh settings — it overwrites user's unsaved changes
      // Only load on first navigation (not on interval refresh)
      if (!window._settingsLoaded) {
        await loadSettings();
        window._settingsLoaded = true;
      }
      break;
  }
}

// Overview Page
async function loadOverview() {
  try {
    const response = await fetch('/api/stats/overview');
    const data = await response.json();
    
    document.getElementById('stat-total-fetches').textContent = data.totalFetches.toLocaleString();
    document.getElementById('stat-injections').textContent = data.injectionsDetected.toLocaleString();
    document.getElementById('stat-block-rate').textContent = `${data.blockRate}%`;
    
    // Top offenders
    const tbody = document.getElementById('top-offenders-table');
    if (data.topOffenders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-state">No detections yet</td></tr>';
    } else {
      tbody.innerHTML = data.topOffenders.map(item => `
        <tr>
          <td>${escapeHtml(item.domain)}</td>
          <td>${item.count}</td>
        </tr>
      `).join('');
    }
    
    // Draw trend chart
    drawTrendChart(data.trendData);
  } catch (error) {
    console.error('Failed to load overview:', error);
  }
}

function drawTrendChart(trendData) {
  const canvas = document.getElementById('trend-canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  const container = canvas.parentElement;
  canvas.width = container.clientWidth - 32;
  canvas.height = container.clientHeight - 32;
  
  if (trendData.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const padding = 40;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Find max value
  const maxFetches = Math.max(...trendData.map(d => d.fetches), 1);
  const maxInjections = Math.max(...trendData.map(d => d.injections), 1);
  const maxValue = Math.max(maxFetches, maxInjections);
  
  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();
  
  // Draw lines
  const stepX = chartWidth / (trendData.length - 1 || 1);
  
  // Fetches line (blue)
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  trendData.forEach((d, i) => {
    const x = padding + i * stepX;
    const y = canvas.height - padding - (d.fetches / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Injections line (red)
  ctx.strokeStyle = '#ff4500';
  ctx.lineWidth = 2;
  ctx.beginPath();
  trendData.forEach((d, i) => {
    const x = padding + i * stepX;
    const y = canvas.height - padding - (d.injections / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  // Draw labels
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  trendData.forEach((d, i) => {
    const x = padding + i * stepX;
    const label = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(label, x, canvas.height - padding + 20);
  });
  
  // Legend
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('● Fetches', padding, 20);
  ctx.fillStyle = '#ff4500';
  ctx.fillText('● Injections', padding + 100, 20);
}

// Audit Log Page
async function loadAuditLog() {
  const search = document.getElementById('audit-search').value;
  const severity = document.getElementById('audit-severity-filter').value;
  const domain = document.getElementById('audit-domain-filter').value;
  
  const params = new URLSearchParams({
    limit: auditPageSize,
    offset: auditPage * auditPageSize
  });
  
  if (search) params.append('search', search);
  if (severity) params.append('severity', severity);
  if (domain) params.append('domain', domain);
  
  try {
    const response = await fetch(`/api/audit-log?${params}`);
    const data = await response.json();
    
    const tbody = document.getElementById('audit-log-table');
    
    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No audit logs found</td></tr>';
    } else {
      tbody.innerHTML = data.logs.map(log => `
        <tr>
          <td>${new Date(log.timestamp).toLocaleString()}</td>
          <td title="${escapeHtml(log.url)}">${truncate(escapeHtml(log.url), 50)}</td>
          <td>${log.detections || 0} detections</td>
          <td><span class="action action-${log.flagged ? 'block' : 'allow'}">${log.flagged ? 'flagged' : log.operation || 'ok'}</span></td>
          <td><span class="severity severity-${log.severity || 'low'}">${log.severity || 'low'}</span></td>
        </tr>
      `).join('');
    }
    
    document.getElementById('audit-page-info').textContent = 
      `Page ${auditPage + 1} (${data.logs.length} of ${data.total} total)`;
  } catch (error) {
    console.error('Failed to load audit log:', error);
    document.getElementById('audit-log-table').innerHTML = '<tr><td colspan="5" class="empty-state">No audit entries yet</td></tr>';
  }
}

// Domain Management Page
async function loadDomains() {
  try {
    const response = await fetch('/api/domains');
    const data = await response.json();
    
    // Store all domains
    allDomains = {
      trusted: data.trusted || [],
      neutral: data.neutral || [],
      suspicious: data.suspicious || [],
      blocked: data.blocked || []
    };
    
    // Reset search
    domainSearchQuery = '';
    if (document.getElementById('domain-search')) {
      document.getElementById('domain-search').value = '';
    }
    
    // Render domains
    renderDomains();
  } catch (error) {
    console.error('Failed to load domains:', error);
  }
}

function renderDomains() {
  ['trusted', 'neutral', 'suspicious', 'blocked'].forEach(tier => {
    const list = document.getElementById(`${tier}-domains`);
    const countBadge = document.getElementById(`${tier}-count`);
    
    // Filter domains by search query
    let domains = allDomains[tier] || [];
    if (domainSearchQuery) {
      domains = domains.filter(d => 
        d.toLowerCase().includes(domainSearchQuery.toLowerCase())
      );
    }
    
    // Update count badge
    countBadge.textContent = domains.length;
    
    // Render domains
    if (domains.length === 0) {
      if (domainSearchQuery) {
        list.innerHTML = '<li class="empty">No domains match your search</li>';
      } else {
        list.innerHTML = '<li class="empty">No domains in this tier yet</li>';
      }
    } else {
      // Show first 20, with "show more" button if needed
      const visibleDomains = domains.slice(0, DOMAINS_PER_TIER);
      const hasMore = domains.length > DOMAINS_PER_TIER;
      
      list.innerHTML = visibleDomains.map(domain => `
        <li>
          ${escapeHtml(domain)}
          <button class="remove-btn" onclick="removeDomain('${escapeHtml(domain)}', '${tier}')">✕</button>
        </li>
      `).join('');
      
      if (hasMore) {
        const showMoreBtn = document.createElement('li');
        showMoreBtn.className = 'show-more-btn';
        showMoreBtn.textContent = `+${domains.length - DOMAINS_PER_TIER} more`;
        showMoreBtn.onclick = () => expandDomainTier(tier);
        list.appendChild(showMoreBtn);
      }
    }
  });
}

function expandDomainTier(tier) {
  const list = document.getElementById(`${tier}-domains`);
  
  // Filter domains by search query
  let domains = allDomains[tier] || [];
  if (domainSearchQuery) {
    domains = domains.filter(d => 
      d.toLowerCase().includes(domainSearchQuery.toLowerCase())
    );
  }
  
  // Show all domains
  list.innerHTML = domains.map(domain => `
    <li>
      ${escapeHtml(domain)}
      <button class="remove-btn" onclick="removeDomain('${escapeHtml(domain)}', '${tier}')">✕</button>
    </li>
  `).join('');
  
  // Add collapse button
  const collapseBtn = document.createElement('li');
  collapseBtn.className = 'show-more-btn';
  collapseBtn.textContent = 'Show less';
  collapseBtn.onclick = () => renderDomains();
  list.appendChild(collapseBtn);
}

function filterDomains(e) {
  domainSearchQuery = e.target.value;
  renderDomains();
}

async function addDomain() {
  const domain = document.getElementById('new-domain').value.trim();
  const tier = document.getElementById('new-domain-tier').value;
  
  if (!domain) {
    alert('Please enter a domain');
    return;
  }
  
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, tier })
    });
    
    if (response.ok) {
      document.getElementById('new-domain').value = '';
      await loadDomains();
    } else {
      alert('Failed to add domain');
    }
  } catch (error) {
    console.error('Failed to add domain:', error);
    alert('Network error');
  }
}

async function removeDomain(domain, tier) {
  if (!confirm(`Remove ${domain} from ${tier} list?`)) return;
  
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, tier: 'neutral' }) // Move to neutral instead of deleting
    });
    
    if (response.ok) {
      await loadDomains();
    } else {
      alert('Failed to remove domain');
    }
  } catch (error) {
    console.error('Failed to remove domain:', error);
    alert('Network error');
  }
}

// Configuration Page (task 9 — edit mode with save)
let configEditMode = false;

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    const json = JSON.stringify(data, null, 2);
    
    document.getElementById('config-display').textContent = json;
    document.getElementById('config-editor').value = json;
    
    // Exit edit mode on reload
    setConfigEditMode(false);
    
    // Attach listeners once
    if (!window.configListenersAttached) {
      document.getElementById('config-edit-btn').addEventListener('click', () => setConfigEditMode(true));
      document.getElementById('config-cancel-btn').addEventListener('click', () => setConfigEditMode(false));
      document.getElementById('config-save-btn').addEventListener('click', saveConfig);
      window.configListenersAttached = true;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
    document.getElementById('config-display').textContent = 'Error loading configuration';
  }
}

function setConfigEditMode(editing) {
  configEditMode = editing;
  document.getElementById('config-display').classList.toggle('hidden', editing);
  document.getElementById('config-editor').classList.toggle('hidden', !editing);
  document.getElementById('config-edit-btn').classList.toggle('hidden', editing);
  document.getElementById('config-save-btn').classList.toggle('hidden', !editing);
  document.getElementById('config-cancel-btn').classList.toggle('hidden', !editing);
  document.getElementById('config-warning').classList.toggle('hidden', !editing);
  document.getElementById('config-status').textContent = '';
}

async function saveConfig() {
  const statusEl = document.getElementById('config-status');
  const raw = document.getElementById('config-editor').value;
  
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    statusEl.textContent = '❌ Invalid JSON: ' + e.message;
    statusEl.className = 'settings-status error';
    return;
  }
  
  try {
    const resp = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    });
    if (resp.ok) {
      statusEl.textContent = '✅ Configuration saved';
      statusEl.className = 'settings-status success';
      document.getElementById('config-display').textContent = JSON.stringify(parsed, null, 2);
      setConfigEditMode(false);
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } else {
      statusEl.textContent = '❌ Failed to save';
      statusEl.className = 'settings-status error';
    }
  } catch (e) {
    statusEl.textContent = '❌ ' + e.message;
    statusEl.className = 'settings-status error';
  }
}

// Threat Feed Page
async function loadThreatFeed() {
  try {
    const response = await fetch('/api/threat-feed');
    const data = await response.json();
    
    // Network stats
    document.getElementById('threat-instances').textContent = data.networkStats.totalInstances;
    document.getElementById('threat-blocks').textContent = data.networkStats.injectionsBlockedThisWeek.toLocaleString();
    
    // Top threats
    const patternsTable = document.getElementById('threat-patterns-table');
    if (data.networkStats.topThreats.length === 0) {
      patternsTable.innerHTML = '<tr><td colspan="2" class="empty-state">No threat patterns detected yet</td></tr>';
    } else {
      patternsTable.innerHTML = data.networkStats.topThreats.map(t => `
        <tr>
          <td><code>${escapeHtml(t.pattern)}</code></td>
          <td>${t.count}</td>
        </tr>
      `).join('');
    }
    
    // Recent patterns
    const recentTable = document.getElementById('threat-recent-table');
    if (data.recentPatterns.length === 0) {
      recentTable.innerHTML = '<tr><td colspan="4" class="empty-state">No recent patterns</td></tr>';
    } else {
      recentTable.innerHTML = data.recentPatterns.map(p => `
        <tr>
          <td><code>${escapeHtml(p.pattern)}</code></td>
          <td>${new Date(p.firstSeen).toLocaleDateString()}</td>
          <td><span class="severity severity-${p.severity}">${p.severity}</span></td>
          <td>${p.detections}</td>
        </tr>
      `).join('');
    }
    
    // Blocked domains
    const domainsTable = document.getElementById('threat-domains-table');
    if (data.blockedDomains.length === 0) {
      domainsTable.innerHTML = '<tr><td colspan="3" class="empty-state">No blocked domains</td></tr>';
    } else {
      domainsTable.innerHTML = data.blockedDomains.map(d => `
        <tr>
          <td>${escapeHtml(d.domain)}</td>
          <td>${escapeHtml(d.reason)}</td>
          <td>${new Date(d.addedAt).toLocaleDateString()}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load threat feed:', error);
    document.getElementById('threat-patterns-table').innerHTML = '<tr><td colspan="2" class="empty-state">No threat data yet</td></tr>';
    document.getElementById('threat-recent-table').innerHTML = '<tr><td colspan="4" class="empty-state">No threat data yet</td></tr>';
    document.getElementById('threat-domains-table').innerHTML = '<tr><td colspan="3" class="empty-state">No threat data yet</td></tr>';
  }
}

// Alerts Page
async function loadAlerts() {
  try {
    const response = await fetch('/api/alerts?limit=50');
    const data = await response.json();
    
    const tbody = document.getElementById('alerts-table');
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No alerts yet — your security is on point! 🔥</td></tr>';
    } else {
      tbody.innerHTML = data.map(alert => `
        <tr>
          <td>${new Date(alert.timestamp).toLocaleString()}</td>
          <td><span class="severity severity-${alert.severity}">${alert.severity}</span></td>
          <td>${escapeHtml(alert.message || 'Alert triggered')}</td>
          <td title="${escapeHtml(alert.url)}">${truncate(escapeHtml(alert.url), 60)}</td>
        </tr>
      `).join('');
    }
    
    // Update stat card
    document.getElementById('stat-alerts').textContent = data.length;
  } catch (error) {
    console.error('Failed to load alerts:', error);
    document.getElementById('alerts-table').innerHTML = '<tr><td colspan="4" class="empty-state">No alerts yet</td></tr>';
  }
}

// LLM Provider → Model mapping
const LLM_MODELS = {
  anthropic: [
    { value: 'anthropic/claude-haiku-4', label: 'Claude Haiku 4 (Fast, Low Cost)' },
    { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced)' },
    { value: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6 (Most Capable)' }
  ],
  google: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast, Cheapest)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Balanced)' }
  ],
  openai: [
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Fast, Low Cost)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o (Balanced)' },
    { value: 'openai/gpt-4.1', label: 'GPT-4.1 (Most Capable)' }
  ],
  openrouter: [
    { value: 'openrouter/auto', label: 'Auto (Best value routing)' }
  ]
};

function populateModelDropdown(provider) {
  const modelSelect = document.getElementById('setting-llm-model');
  const models = LLM_MODELS[provider] || [];
  modelSelect.innerHTML = models.map(m =>
    `<option value="${m.value}">${m.label}</option>`
  ).join('');
}

function updateApiKeyStatus(hasKey) {
  const indicator = document.getElementById('api-key-status');
  const dot = indicator.querySelector('.status-dot');
  const text = indicator.querySelector('.status-text');
  if (hasKey) {
    indicator.classList.add('configured');
    indicator.classList.remove('not-configured');
    text.textContent = 'Configured ✓';
  } else {
    indicator.classList.remove('configured');
    indicator.classList.add('not-configured');
    text.textContent = 'Not configured';
  }
}

function updateSupabaseKeyStatus(hasKey) {
  const indicator = document.getElementById('supabase-key-status');
  if (!indicator) return;
  const text = indicator.querySelector('.status-text');
  if (hasKey) {
    indicator.classList.add('configured');
    indicator.classList.remove('not-configured');
    text.textContent = 'Configured ✓';
  } else {
    indicator.classList.remove('configured');
    indicator.classList.add('not-configured');
    text.textContent = 'Not configured';
  }
}

// Settings Page
async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    
    // Populate form fields
    document.getElementById('setting-share-data').checked = settings.privacy.shareData || false;
    document.getElementById('setting-severity-threshold').value = settings.alerts.severityThreshold || 'low';
    document.getElementById('setting-digest-mode').checked = settings.alerts.digestMode || false;
    document.getElementById('setting-quiet-start').value = settings.alerts.quietHours.start || '22:00';
    document.getElementById('setting-quiet-end').value = settings.alerts.quietHours.end || '08:00';
    
    document.getElementById('setting-max-fetches-hour').value = settings.rateLimits.maxFetchesPerHour || 1000;
    document.getElementById('setting-max-fetches-day').value = settings.rateLimits.maxFetchesPerDay || 10000;
    document.getElementById('setting-daily-cost-cap').value = settings.rateLimits.dailyCostCapCents || 500;
    
    document.getElementById('setting-default-trust').value = settings.domains.defaultTrust || 'neutral';
    const abVal = settings.domains.autoBlockThreshold || 0;
    document.getElementById('setting-auto-block-threshold').value = abVal;
    updateAutoBlockLabel(abVal);
    
    document.getElementById('setting-refresh-interval').value = settings.dashboard.refreshInterval || 5000;
    document.getElementById('setting-timezone').value = settings.dashboard.timezone || 'local';
    
    document.getElementById('setting-log-retention').value = settings.maintenance.logRetentionDays || 90;
    document.getElementById('fireclaw-version').textContent = settings.version || 'Unknown';
    
    // LLM settings
    const llm = settings.llm || {};
    const provider = llm.provider || 'anthropic';
    document.getElementById('setting-llm-provider').value = provider;
    populateModelDropdown(provider);
    document.getElementById('setting-llm-model').value = llm.model || 'anthropic/claude-haiku-4';
    
    // API key — server returns masked version if set
    const apiKeyInput = document.getElementById('setting-llm-api-key');
    if (llm.apiKeySet) {
      apiKeyInput.placeholder = '••••••••••••••••  (saved)';
      apiKeyInput.value = '';
      updateApiKeyStatus(true);
    } else {
      apiKeyInput.placeholder = 'Enter API key';
      apiKeyInput.value = '';
      updateApiKeyStatus(false);
    }

    // Supabase settings
    const supabase = settings.supabase || {};
    const supabaseUrlInput = document.getElementById('setting-supabase-url');
    const supabaseKeyInput = document.getElementById('setting-supabase-key');
    if (supabaseUrlInput) supabaseUrlInput.value = supabase.url || '';
    if (supabaseKeyInput) {
      if (supabase.supabaseKeySet) {
        supabaseKeyInput.placeholder = '••••••••••••••••  (saved)';
        supabaseKeyInput.value = '';
        updateSupabaseKeyStatus(true);
      } else {
        supabaseKeyInput.placeholder = 'Enter anon key';
        supabaseKeyInput.value = '';
        updateSupabaseKeyStatus(false);
      }
    }
    
    // Update privacy indicator
    updatePrivacyIndicator(settings.privacy.shareData);
    
    // Load usage stats
    loadUsageStats();
    
    // Set up event listeners (only once)
    if (!window.settingsListenersAttached) {
      setupSettingsListeners();
      window.settingsListenersAttached = true;
    }
    
    // Alerts: spending
    document.getElementById('setting-spending-alerts').checked = settings.alerts.spendingAlerts || false;
    document.getElementById('setting-spending-warn-pct').value = settings.alerts.spendingWarnPct || 80;
    
    // Auto-update check
    document.getElementById('setting-auto-update-check').checked = settings.maintenance.autoUpdateCheck || false;
    
    // Apply refresh interval if it changed
    applyRefreshInterval(settings.dashboard.refreshInterval);
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function setupSettingsListeners() {
  // Password-only auth settings (OTP removed)

  const saveAuthBtn = document.getElementById('save-auth-settings-btn');
  if (saveAuthBtn) {
    saveAuthBtn.addEventListener('click', saveAuthSettings);
  }

  // Privacy toggle — write to Supabase via backend (task 3)
  document.getElementById('setting-share-data').addEventListener('change', async (e) => {
    const sharing = e.target.checked;
    updatePrivacyIndicator(sharing);
    try {
      await fetch('/api/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareData: sharing })
      });
    } catch (err) {
      console.error('Failed to update sharing preference:', err);
    }
  });
  
  // LLM provider change → update model dropdown
  document.getElementById('setting-llm-provider').addEventListener('change', (e) => {
    populateModelDropdown(e.target.value);
  });
  
  // API key visibility toggle
  const toggleSupabaseKeyBtn = document.getElementById('toggle-supabase-key-btn');
  if (toggleSupabaseKeyBtn) {
    toggleSupabaseKeyBtn.addEventListener('click', () => {
      const input = document.getElementById('setting-supabase-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  document.getElementById('toggle-api-key-btn').addEventListener('click', () => {
    const input = document.getElementById('setting-llm-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  
  // Test LLM connection button
  const testLlmBtn = document.getElementById('test-llm-btn');
  if (testLlmBtn) {
    testLlmBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('llm-connection-status');
      const dotEl = statusEl.querySelector('.status-dot');
      const textEl = statusEl.querySelector('.status-text');

      testLlmBtn.disabled = true;
      testLlmBtn.textContent = '⏳ Testing...';
      statusEl.className = 'status-indicator';
      textEl.textContent = 'Testing...';

      try {
        const res = await fetch('/api/test-llm', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          statusEl.classList.add('connected');
          textEl.textContent = `Connected (${data.latencyMs}ms)`;
        } else {
          statusEl.classList.add('error');
          textEl.textContent = data.error || 'Connection failed';
        }
      } catch (err) {
        statusEl.classList.add('error');
        textEl.textContent = 'Cannot connect';
      } finally {
        testLlmBtn.disabled = false;
        testLlmBtn.textContent = '🧪 Test';
      }
    });
  }

  // Save button
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  
  // Export buttons
  document.getElementById('export-audit-btn').addEventListener('click', exportAuditLog);
  document.getElementById('export-domains-btn').addEventListener('click', exportDomains);
  document.getElementById('check-updates-btn').addEventListener('click', checkForUpdates);
}

function updatePrivacyIndicator(isSharing) {
  const indicator = document.getElementById('privacy-status-indicator');
  const statusText = indicator.querySelector('.status-text');
  
  if (isSharing) {
    indicator.classList.add('sharing');
    statusText.textContent = 'Sharing anonymized threat data';
  } else {
    indicator.classList.remove('sharing');
    statusText.textContent = 'Not sharing data';
  }
}

async function loadUsageStats() {
  try {
    const response = await fetch('/api/usage-stats');
    const stats = await response.json();
    
    document.getElementById('usage-today').textContent = stats.today.toLocaleString() + ' fetches';
    document.getElementById('usage-hour').textContent = stats.thisHour.toLocaleString() + ' fetches';
    document.getElementById('usage-cost').textContent = '$' + (stats.estimatedCostCents / 100).toFixed(2);
  } catch (error) {
    console.error('Failed to load usage stats:', error);
  }
}

async function saveSettings() {
  const saveBtn = document.getElementById('save-settings-btn');
  const statusSpan = document.getElementById('settings-status');
  
  saveBtn.disabled = true;
  saveBtn.textContent = '💾 Saving...';
  statusSpan.textContent = '';
  
  try {
    const settings = {
      privacy: {
        shareData: document.getElementById('setting-share-data').checked
      },
      alerts: {
        severityThreshold: document.getElementById('setting-severity-threshold').value,
        digestMode: document.getElementById('setting-digest-mode').checked,
        spendingAlerts: document.getElementById('setting-spending-alerts').checked,
        spendingWarnPct: parseInt(document.getElementById('setting-spending-warn-pct').value) || 80,
        quietHours: {
          start: document.getElementById('setting-quiet-start').value,
          end: document.getElementById('setting-quiet-end').value
        }
      },
      rateLimits: {
        maxFetchesPerHour: parseInt(document.getElementById('setting-max-fetches-hour').value),
        maxFetchesPerDay: parseInt(document.getElementById('setting-max-fetches-day').value),
        dailyCostCapCents: parseInt(document.getElementById('setting-daily-cost-cap').value)
      },
      domains: {
        defaultTrust: document.getElementById('setting-default-trust').value,
        autoBlockThreshold: parseInt(document.getElementById('setting-auto-block-threshold').value)
      },
      dashboard: {
        refreshInterval: parseInt(document.getElementById('setting-refresh-interval').value),
        timezone: document.getElementById('setting-timezone').value
      },
      maintenance: {
        logRetentionDays: parseInt(document.getElementById('setting-log-retention').value),
        autoUpdateCheck: document.getElementById('setting-auto-update-check').checked
      },
      llm: {
        provider: document.getElementById('setting-llm-provider').value,
        model: document.getElementById('setting-llm-model').value
      }
    };
    
    // Only include LLM API key if user entered a new one
    const apiKeyValue = document.getElementById('setting-llm-api-key').value.trim();
    if (apiKeyValue) {
      settings.llm.apiKey = apiKeyValue;
    }

    // Supabase config — always send URL; only send key if user entered a new one
    const supabaseUrlEl = document.getElementById('setting-supabase-url');
    const supabaseKeyEl = document.getElementById('setting-supabase-key');
    if (supabaseUrlEl) {
      settings.supabase = { url: supabaseUrlEl.value.trim() };
      const supabaseKeyValue = supabaseKeyEl ? supabaseKeyEl.value.trim() : '';
      if (supabaseKeyValue) {
        settings.supabase.key = supabaseKeyValue;
      }
    }
    
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    if (response.ok) {
      statusSpan.textContent = '✅ Settings saved successfully!';
      statusSpan.className = 'settings-status success';
      
      // Reload settings from server to confirm persistence
      await loadSettings();
      
      setTimeout(() => {
        statusSpan.textContent = '';
      }, 3000);
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    statusSpan.textContent = '❌ Failed to save settings';
    statusSpan.className = 'settings-status error';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Settings';
  }
}

function applyRefreshInterval(interval) {
  // Clear existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  // Set new interval if not disabled
  if (interval > 0) {
    refreshInterval = setInterval(() => {
      loadPage(currentPage);
    }, interval);
  }
}

async function exportAuditLog() {
  try {
    const response = await fetch('/api/export/audit-log');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fireclaw-audit-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export audit log:', error);
    alert('Failed to export audit log');
  }
}

async function exportDomains() {
  try {
    const response = await fetch('/api/export/domains');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fireclaw-domains-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export domains:', error);
    alert('Failed to export domains');
  }
}

async function checkForUpdates() {
  const btn = document.getElementById('check-updates-btn');
  const originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = '🔄 Checking...';
  
  try {
    const response = await fetch('/api/check-updates');
    const data = await response.json();
    
    if (data.updateAvailable) {
      alert(`Update available!\n\nCurrent: ${data.currentVersion}\nLatest: ${data.latestVersion}\n\nVisit fireclaw.app to download the latest version.`);
    } else {
      alert(`You're up to date! 🎉\n\nVersion: ${data.currentVersion}`);
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
    alert('Failed to check for updates. Please try again later.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Auth Settings (Settings page) — password only
async function saveAuthSettings() {
  const btn = document.getElementById('save-auth-settings-btn');
  const status = document.getElementById('auth-settings-status');
  btn.disabled = true;
  status.textContent = '';

  const body = { method: 'password' };
  const pw = document.getElementById('setting-new-password').value;
  const confirm = document.getElementById('setting-confirm-password').value;
  if (pw) {
    if (pw.length < 8) { status.textContent = '❌ Password must be 8+ chars'; btn.disabled = false; return; }
    if (pw !== confirm) { status.textContent = '❌ Passwords don\'t match'; btn.disabled = false; return; }
    body.password = pw;
  }

  try {
    const resp = await fetch('/api/auth/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (resp.ok) {
      currentAuthMethod = 'password';
      status.textContent = '✅ Saved';
      status.className = 'settings-status success';
      document.getElementById('setting-new-password').value = '';
      document.getElementById('setting-confirm-password').value = '';
      setTimeout(() => { status.textContent = ''; }, 3000);
    } else {
      const data = await resp.json();
      status.textContent = '❌ ' + (data.error || 'Failed');
      status.className = 'settings-status error';
    }
  } catch (e) {
    status.textContent = '❌ ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, length) {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function updateAutoBlockLabel(val) {
  const label = document.getElementById('auto-block-threshold-label');
  if (label) label.textContent = parseInt(val) === 0 ? 'Off' : val;
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
