/* ============================================
   Armaan - Overlay Injector Module
   Full HTML page listing with icons on right,
   Activate/Deactivate via MCP HTML overlay
   ============================================ */

let allPages = [];
let currentCategory = 'all';
let activeOverlayPageId = null;

// ==================== Load Pages ====================
async function loadOverlayPages() {
  try {
    const res = await fetch('/api/overlay/pages');
    const data = await res.json();
    allPages = data.pages || [];
    activeOverlayPageId = data.activeOverlay?.page_id || null;
    
    // Populate categories
    const cats = [...new Set(allPages.map(p => p.category))].sort();
    const catContainer = document.getElementById('overlayCategories');
    if (catContainer) {
      catContainer.innerHTML = `<button class="cat-pill active" onclick="filterOverlayCategory('all')">All</button>` +
        cats.map(c => `<button class="cat-pill" onclick="filterOverlayCategory('${c.toLowerCase()}')">${c}</button>`).join('');
    }
    
    renderOverlayPages();
  } catch (err) {
    console.error('Failed to load overlay pages:', err);
    const container = document.getElementById('overlayPagesList');
    if (container) container.innerHTML = '<div class="empty-state">Error loading pages. Is server running?</div>';
  }
}

// ==================== Render Pages ====================
function renderOverlayPages() {
  const container = document.getElementById('overlayPagesList');
  if (!container) return;
  
  const search = (document.getElementById('overlaySearch')?.value || '').toLowerCase();
  
  let filtered = allPages;
  if (search) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.page_id.toLowerCase().includes(search) ||
      (p.category || '').toLowerCase().includes(search)
    );
  }
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => (p.category || '').toLowerCase() === currentCategory);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No pages found</div>';
    return;
  }
  
  // Group by category
  const grouped = {};
  filtered.forEach(page => {
    const cat = page.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(page);
  });
  
  let html = '';
  for (const [cat, pages] of Object.entries(grouped)) {
    html += `<div class="category-separator">${cat} (${pages.length})</div>`;
    pages.forEach(page => {
      const isActive = activeOverlayPageId === page.page_id;
      const initials = page.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      
      html += `
        <div class="overlay-page-item ${isActive ? 'active-overlay' : ''}" data-id="${page.page_id}">
          <div class="overlay-page-info">
            <div class="overlay-page-name">${page.name}</div>
            <div class="overlay-page-path">${page.path}</div>
          </div>
          <div class="overlay-page-right">
            ${page.icon
              ? `<img src="${page.icon}" class="overlay-page-icon" alt="${page.name}" onerror="this.style.display='none'">`
              : `<div class="overlay-page-icon-fallback">${initials}</div>`
            }
            <div class="overlay-page-status">
              ${isActive 
                ? '<span class="overlay-status-dot active-dot"></span>' 
                : '<span class="overlay-status-dot inactive-dot"></span>'
              }
            </div>
            <button class="overlay-activate-btn ${isActive ? 'active' : ''}" 
                    onclick="${isActive ? `deactivateOverlay('${page.page_id}')` : `activateOverlay('${page.page_id}')`}"
                    title="${isActive ? 'Deactivate overlay' : 'Activate overlay'}">
              ${isActive 
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
              }
              <span>${isActive ? 'Active' : 'Show'}</span>
            </button>
          </div>
        </div>
      `;
    });
  }
  
  container.innerHTML = html;
}

// ==================== Filter ====================
function filterOverlayPages(value) {
  renderOverlayPages();
}

function filterOverlayCategory(category) {
  currentCategory = category;
  document.querySelectorAll('#overlayCategories .cat-pill').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`#overlayCategories .cat-pill[onclick*="'${category}'"]`);
  if (activeBtn) activeBtn.classList.add('active');
  renderOverlayPages();
}

// ==================== Overlay Actions via MCP ====================

async function activateOverlay(pageId) {
  activeOverlayPageId = pageId;
  renderOverlayPages();
  fetch(`/api/overlay/activate/${encodeURIComponent(pageId)}`, { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (!data.success) {
        activeOverlayPageId = null;
        renderOverlayPages();
      }
    })
    .catch(() => {
      activeOverlayPageId = null;
      renderOverlayPages();
    });
}

async function deactivateOverlay(pageId) {
  activeOverlayPageId = null;
  renderOverlayPages();
  fetch(`/api/overlay/deactivate/${encodeURIComponent(pageId)}`, { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (!data.success) {
        activeOverlayPageId = pageId;
        renderOverlayPages();
      }
    })
    .catch(() => {
      activeOverlayPageId = pageId;
      renderOverlayPages();
    });
}

async function deactivateAllOverlays() {
  isCycling = false;
  const btn = document.getElementById('cycleAllBtn');
  if (btn) { btn.innerHTML = '▶ Activate All'; btn.classList.remove('active'); }
  const status = document.getElementById('cycleStatus');
  if (status) status.textContent = '';
  activeOverlayPageId = null;
  renderOverlayPages();
  fetch('/api/overlay/deactivate-all', { method: 'POST' })
    .then(r => r.json())
    .catch(() => {});
}

let isCycling = false;
let cycleCheckTimer = null;

async function toggleCycleAll() {
  const btn = document.getElementById('cycleAllBtn');
  const status = document.getElementById('cycleStatus');
  if (!btn) return;

  if (isCycling) {
    await stopCycle();
  } else {
    await startCycle();
  }
}

async function startCycle() {
  const btn = document.getElementById('cycleAllBtn');
  showToast('Auto-cycling is not available', 'info');
  if (btn) btn.innerHTML = '▶ Activate All';
  isCycling = false;
}

async function stopCycle() {
  const btn = document.getElementById('cycleAllBtn');
  const status = document.getElementById('cycleStatus');
  isCycling = false;
  if (status) status.textContent = '';
  if (btn) { btn.innerHTML = '▶ Activate All'; btn.classList.remove('active'); }
  activeOverlayPageId = null;
  renderOverlayPages();
  if (cycleCheckTimer) { clearInterval(cycleCheckTimer); cycleCheckTimer = null; }
}

async function checkCycleStatus() {}

// ==================== Premium Injection Tab Support ====================

let legacyPages = [];
let previewPageId = null;
let previewActive = false;

async function loadPages() {
  try {
    const res = await fetch('/api/injection/pages');
    const data = await res.json();
    legacyPages = data.pages || [];
    renderLegacyPages();
  } catch (err) {
    console.error('Failed to load pages:', err);
  }
}

function renderLegacyPages() {
  const container = document.getElementById('injectListWrap');
  if (!container) {
    const oldContainer = document.getElementById('injectList');
    if (oldContainer) renderOldLegacyPages(oldContainer);
    return;
  }

  let filtered = legacyPages;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No pages</div>';
    return;
  }

  let html = '';
  filtered.forEach(page => {
    const active = page.active || false;
    const initials = page.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    html += `
      <div class="inject-list-line ${active ? 'active' : ''}" data-page="${page.page_id}">
        <div class="inject-line-left">
          ${page.icon
            ? `<img src="${page.icon}" class="inject-line-icon" alt="${page.name}" onerror="this.style.display='none'">`
            : `<div class="inject-line-fallback">${initials}</div>`
          }
          <span class="inject-line-name">${page.name}</span>
        </div>
        <div class="inject-line-actions">
          <button class="inject-act-btn" onclick="event.stopPropagation();injectActivate('${page.page_id}')">
            <span class="btn-text">Activate</span>
            <span class="btn-spinner" style="display:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span>
          </button>
          <button class="inject-act-btn deactivate" onclick="event.stopPropagation();injectDeactivate('${page.page_id}')">Deactivate</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function injectActivate(pageId) {
  const line = document.querySelector(`.inject-list-line[data-page="${pageId}"]`);
  const btn = line?.querySelector('.inject-act-btn');
  const text = btn?.querySelector('.btn-text');
  const spinner = btn?.querySelector('.btn-spinner');
  if (text) text.style.display = 'none';
  if (spinner) spinner.style.display = 'inline';
  if (btn) btn.classList.add('loading');

  const page = legacyPages.find(p => p.page_id === pageId);
  if (!page) return;
  page.active = true;
  if (line) line.classList.add('active');

  fetch(`/api/overlay/activate/${encodeURIComponent(pageId)}`, { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (text) text.style.display = 'inline';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.classList.remove('loading');
      if (!data || data.success === false) {
        page.active = false;
        if (line) line.classList.remove('active');
      }
    })
    .catch(() => {
      page.active = false;
      if (line) line.classList.remove('active');
      if (text) text.style.display = 'inline';
      if (spinner) spinner.style.display = 'none';
      if (btn) btn.classList.remove('loading');
    });
}

function injectDeactivate(pageId) {
  const page = legacyPages.find(p => p.page_id === pageId);
  if (!page) return;
  page.active = false;
  const line = document.querySelector(`.inject-list-line[data-page="${pageId}"]`);
  if (line) line.classList.remove('active');
  fetch(`/api/overlay/deactivate/${encodeURIComponent(pageId)}`, { method: 'POST' })
    .then(r => r.json())
    .catch(() => {});
}

function openPagePreview(pageId) {
  const page = legacyPages.find(p => p.page_id === pageId);
  if (!page) return;
  previewPageId = pageId;
  previewActive = page.active || false;
  
  const overlay = document.getElementById('pagePreview');
  const title = document.getElementById('pagePreviewTitle');
  const body = document.getElementById('pagePreviewBody');
  const toggle = document.getElementById('pagePreviewToggle');
  
  if (title) title.textContent = page.name;
  if (toggle) {
    toggle.className = 'page-preview-toggle' + (previewActive ? ' active' : '');
    toggle.innerHTML = previewActive
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Loaded on Device</span>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Load on Device</span>';
  }
  if (body) {
    body.innerHTML = '<div class="page-preview-loading"><div class="spinner-sm"></div> Loading page content...</div>';
    // Try loading the page in an iframe
    const previewPath = page.path || page.page_id;
    const previewUrl = `/pages/${previewPath}`;
    const iframe = document.createElement('iframe');
    iframe.onload = () => { body.innerHTML = ''; body.appendChild(iframe); };
    iframe.onerror = () => { body.innerHTML = '<div class="page-preview-loading">Preview not available</div>'; };
    iframe.src = previewUrl;
  }
  if (overlay) overlay.style.display = 'flex';
}

function closePagePreview(e) {
  if (e && e.target !== e.currentTarget) return;
  previewPageId = null;
  const overlay = document.getElementById('pagePreview');
  if (overlay) overlay.style.display = 'none';
}

async function togglePreviewPage() {
  if (!previewPageId) return;
  const page = legacyPages.find(p => p.page_id === previewPageId);
  if (!page) return;

  const wasActive = previewActive;
  const endpoint = wasActive ? 'deactivate' : 'activate';
  try {
    const res = await fetch(`/api/overlay/${endpoint}/${encodeURIComponent(previewPageId)}`, { method: 'POST' });
    const data = await res.json();
    if (data && data.success) {
      previewActive = !wasActive;
      page.active = data.active !== undefined ? data.active : previewActive;
      const toggle = document.getElementById('pagePreviewToggle');
      if (toggle) {
        toggle.className = 'page-preview-toggle' + (previewActive ? ' active' : '');
        toggle.innerHTML = previewActive
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Loaded on Device</span>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Load on Device</span>';
      }
      renderLegacyPages();
    }
  } catch (err) {
    // Silent fail
  }
}

async function legacyInjectPage(pageId) {
  try {
    const res = await fetch(`/api/injection/pages/${encodeURIComponent(pageId)}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_package: '' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Injected: ${pageId}`, 'success');
    } else {
      showToast(`Inject error: ${JSON.stringify(data)}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Overlay Mode Toggle ====================

let currentOverlayMode = 'data-uri';

async function loadOverlayMode() {
  try {
    const res = await fetch('/api/overlay/mode');
    const data = await res.json();
    currentOverlayMode = data.mode || 'data-uri';
    updateModeUI();
  } catch (err) {
    console.error('Failed to load overlay mode:', err);
  }
}

function updateModeUI() {
  document.querySelectorAll('.mode-option').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === currentOverlayMode);
  });
}

async function setOverlayMode(mode) {
  try {
    const res = await fetch('/api/overlay/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    if (data.success) {
      currentOverlayMode = data.mode;
      updateModeUI();
      const labels = { 'data-uri': 'Direct HTML (no network)', 'local': 'Local URL', 'public': 'Public URL' };
      showToast(`Overlay mode: ${labels[mode] || mode}`, 'success');
    } else {
      showToast(`Failed: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
  // Load legacy injection pages if the tab exists
  if (document.getElementById('injectList') || document.getElementById('injectListWrap')) {
    loadPages();
  }
  
  // Load overlay injector pages if the tab exists
  if (document.getElementById('overlayPagesList')) {
    loadOverlayPages();
    loadOverlayMode();
    setInterval(loadOverlayPages, 10000);
  }
});
