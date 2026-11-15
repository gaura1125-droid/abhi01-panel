let inspectorActive = false;
let inspectorWs = null;
let inspectorTree = null;
let inspectorDevW = 720;
let inspectorDevH = 1604;
let inspectorScale = 1;
let inspectorOffsetX = 0;
let inspectorOffsetY = 0;
let inspectorHideScreen = false;
let inspectorSelectedNode = null;
let inspectorHoveredNode = null;

function inspectorConnect() {
  if (inspectorWs) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws/accessibility`;
  inspectorWs = new WebSocket(url);

  inspectorWs.onopen = () => {
    console.log('[Inspector] WS connected');
  };

  inspectorWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'tree') {
        inspectorTree = msg.data;
        inspectorDevW = inspectorTree.screen.width || 720;
        inspectorDevH = inspectorTree.screen.height || 1604;
        inspectorRenderOverlay();
      } else if (msg.type === 'connected') {
        console.log('[Inspector] Handshake:', msg.clientId);
      }
    } catch (err) {
      console.error('[Inspector] Parse error:', err);
    }
  };

  inspectorWs.onclose = () => {
    console.log('[Inspector] WS disconnected');
    inspectorWs = null;
    if (inspectorActive) {
      setTimeout(inspectorConnect, 1000);
    }
  };

  inspectorWs.onerror = (err) => {
    console.error('[Inspector] WS error:', err);
  };
}

function inspectorDisconnect() {
  if (inspectorWs) {
    inspectorWs.close();
    inspectorWs = null;
  }
}

function inspectorCalcScale(area) {
  if (!area) return;
  const areaW = area.clientWidth - 16;
  const areaH = area.clientHeight - 16;
  const sx = areaW / inspectorDevW;
  const sy = areaH / inspectorDevH;
  inspectorScale = Math.min(sx, sy, 2.5);
  inspectorOffsetX = (areaW - inspectorDevW * inspectorScale) / 2;
  inspectorOffsetY = (areaH - inspectorDevH * inspectorScale) / 2;
}

function inspectorDevToScreen(devX, devY) {
  return {
    x: devX * inspectorScale + inspectorOffsetX,
    y: devY * inspectorScale + inspectorOffsetY
  };
}

function inspectorRenderOverlay() {
  const container = document.getElementById('inspectorOverlay');
  if (!container || !inspectorTree) return;

  const { nodes } = inspectorTree;
  if (!nodes || nodes.length === 0) return;

  const area = document.getElementById('hbcnScreenArea');
  inspectorCalcScale(area);

  // Clear and rebuild
  container.innerHTML = '';
  container.style.display = 'block';

  // Update device info header
  const infoEl = document.getElementById('inspectorInfo');
  if (infoEl) {
    const focused = inspectorTree.windows.find(w => w.focused);
    infoEl.textContent = `${inspectorDevW}x${inspectorDevH} | ${nodes.length} nodes | ${nodes.filter(n=>n.clickable).length} clickable${focused ? ' | ' + focused.packageName : ''}`;
  }

  // Create inner scaled container
  const inner = document.createElement('div');
  inner.className = 'inspector-inner';
  inner.style.width = Math.round(inspectorDevW * inspectorScale) + 'px';
  inner.style.height = Math.round(inspectorDevH * inspectorScale) + 'px';
  inner.style.left = inspectorOffsetX + 'px';
  inner.style.top = inspectorOffsetY + 'px';

  // Draw each node as a bounding box
  for (const node of nodes) {
    if (!node.bounds) continue;
    if (!node.onscreen) continue;
    const { left, top, right, bottom } = node.bounds;
    if (right - left < 4 || bottom - top < 4) continue;

    const sx = inspectorScale;
    const el = document.createElement('div');
    el.className = 'inspector-node-box';
    el.dataset.nodeId = node.node_id;

    el.style.left = Math.round(left * sx) + 'px';
    el.style.top = Math.round(top * sx) + 'px';
    el.style.width = Math.max(Math.round((right - left) * sx), 4) + 'px';
    el.style.height = Math.max(Math.round((bottom - top) * sx), 4) + 'px';

    // Color by type
    if (node.clickable) el.classList.add('inspector-clickable');
    if (node.type === 'Text' || node.type === 'Input') el.classList.add('inspector-text');
    if (node.type === 'Input') el.classList.add('inspector-input');
    if (node.type === 'Image') el.classList.add('inspector-image');
    if (node.type === 'Button') el.classList.add('inspector-button');
    if (node.type === 'Toggle') el.classList.add('inspector-toggle');
    if (node.type === 'Container') el.classList.add('inspector-container');

    if (!node.clickable && node.type === 'Container') {
      el.style.display = 'none';
    }

    // Label
    const label = document.createElement('span');
    label.className = 'inspector-node-label';
    const displayText = node.text || node.contentDescription || node.type;
    label.textContent = displayText.length > 40 ? displayText.slice(0, 40) + '…' : displayText;
    el.appendChild(label);

    // Hover tooltip
    el.addEventListener('mouseenter', () => {
      inspectorHoveredNode = node;
      inspectorUpdateTooltip(node, el);
    });
    el.addEventListener('mouseleave', () => {
      inspectorHoveredNode = null;
      inspectorHideTooltip();
    });

    // Click to tap
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      inspectorSelectNode(node, el);
      const cx = Math.round((node.bounds.left + node.bounds.right) / 2);
      const cy = Math.round((node.bounds.top + node.bounds.bottom) / 2);
      try {
        await fetch('/api/screen/tap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: cx, y: cy })
        });
        // Flash feedback
        el.classList.add('inspector-node-tapped');
        setTimeout(() => el.classList.remove('inspector-node-tapped'), 400);
      } catch (err) {
        console.error('[Inspector] Tap error:', err);
      }
    });

    inner.appendChild(el);
  }

  container.appendChild(inner);
}

function inspectorSelectNode(node, el) {
  // Deselect previous
  document.querySelectorAll('.inspector-node-box.selected').forEach(el => el.classList.remove('selected'));

  inspectorSelectedNode = node;
  if (el) el.classList.add('selected');

  // Show properties panel
  const panel = document.getElementById('inspectorNodePanel');
  if (!panel) return;
  if (!node) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="inspector-panel-header">
      <span>${node.type}</span>
      <button class="inspector-panel-close" onclick="inspectorSelectNode(null)">&times;</button>
    </div>
    <div class="inspector-panel-body">
      ${node.text ? `<div class="inspector-prop"><span class="inspector-prop-key">text</span><span class="inspector-prop-val">${escHtml(node.text)}</span></div>` : ''}
      ${node.contentDescription ? `<div class="inspector-prop"><span class="inspector-prop-key">desc</span><span class="inspector-prop-val">${escHtml(node.contentDescription)}</span></div>` : ''}
      ${node.className ? `<div class="inspector-prop"><span class="inspector-prop-key">class</span><span class="inspector-prop-val">${escHtml(node.className.split('.').pop())}</span></div>` : ''}
      ${node.resourceId ? `<div class="inspector-prop"><span class="inspector-prop-key">id</span><span class="inspector-prop-val">${escHtml(node.resourceId)}</span></div>` : ''}
      ${node.bounds ? `<div class="inspector-prop"><span class="inspector-prop-key">bounds</span><span class="inspector-prop-val">[${node.bounds.left},${node.bounds.top},${node.bounds.right},${node.bounds.bottom}]</span></div>` : ''}
      <div class="inspector-prop"><span class="inspector-prop-key">flags</span><span class="inspector-prop-val">${[
        node.clickable && 'clickable',
        node.enabled && 'enabled',
        node.focusable && 'focusable',
        node.scrollable && 'scrollable',
        node.editable && 'editable',
        node.onscreen && 'onscreen'
      ].filter(Boolean).join(', ') || 'none'}</span></div>
      ${node.node_id ? `<div class="inspector-prop"><span class="inspector-prop-key">node_id</span><span class="inspector-prop-val" style="font-size:9px">${escHtml(node.node_id)}</span></div>` : ''}
    </div>
  `;
}

function inspectorUpdateTooltip(node, el) {
  const tooltip = document.getElementById('inspectorTooltip');
  if (!tooltip) return;
  const rect = el.getBoundingClientRect();
  const area = document.getElementById('hbcnScreenArea');
  const areaRect = area ? area.getBoundingClientRect() : { left: 0, top: 0 };

  tooltip.style.display = 'block';
  tooltip.style.left = (rect.left - areaRect.left + rect.width + 4) + 'px';
  tooltip.style.top = (rect.top - areaRect.top) + 'px';
  tooltip.innerHTML = `
    <div class="inspector-tip-type">${node.type}</div>
    ${node.text ? `<div class="inspector-tip-text">${escHtml(node.text.length > 50 ? node.text.slice(0,50)+'…' : node.text)}</div>` : ''}
    ${node.contentDescription ? `<div class="inspector-tip-desc">${escHtml(node.contentDescription.length > 50 ? node.contentDescription.slice(0,50)+'…' : node.contentDescription)}</div>` : ''}
    <div class="inspector-tip-bounds">[${node.bounds.left},${node.bounds.top}] ${node.bounds.width}x${node.bounds.height}</div>
    <div class="inspector-tip-flags">${node.clickable ? 'clickable ' : ''}${node.enabled ? 'enabled' : ''}</div>
  `;
}

function inspectorHideTooltip() {
  const tooltip = document.getElementById('inspectorTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

// === Public API for app.js ===

function inspectorToggle() {
  inspectorActive = !inspectorActive;
  const btn = document.querySelector('[data-action="inspector"]');
  if (btn) btn.classList.toggle('active', inspectorActive);

  // Update FAB toggle state
  const fabToggle = document.getElementById('hvncFabToggle');
  if (fabToggle) {
    fabToggle.textContent = inspectorActive ? 'ON' : 'OFF';
    fabToggle.className = 'hvnc-fab-toggle ' + (inspectorActive ? 'on' : 'off');
  }

  const container = document.getElementById('inspectorOverlay');
  const controls = document.getElementById('inspectorControls');
  const panel = document.getElementById('inspectorNodePanel');
  const tooltip = document.getElementById('inspectorTooltip');
  const info = document.getElementById('inspectorInfo');

  const canvas = document.getElementById('hbcnCanvas');

  if (!inspectorActive) {
    inspectorDisconnect();
    if (container) { container.style.display = 'none'; container.innerHTML = ''; }
    if (controls) controls.style.display = 'none';
    if (panel) panel.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    if (info) info.style.display = 'none';
    inspectorHideScreen = false;
    const hideBtn = document.getElementById('inspectorHideScreenBtn');
    if (hideBtn) hideBtn.classList.remove('active');
    if (canvas) {
      canvas.classList.remove('inspector-hidden');
      canvas.style.filter = 'none';
      canvas.style.display = 'block';
    }
    showToast('Inspector off', 'info');
    return;
  }

  inspectorHideScreen = false;
  const hideBtn = document.getElementById('inspectorHideScreenBtn');
  if (hideBtn) hideBtn.classList.remove('active');
  if (canvas) {
    canvas.classList.remove('inspector-hidden');
    canvas.style.filter = 'none';
    canvas.style.display = 'block';
  }

  if (container) container.style.display = 'block';
  if (controls) controls.style.display = 'flex';
  if (info) info.style.display = 'block';

  showToast('Inspector connecting...', 'info');
  inspectorConnect();
}

function inspectorToggleHideScreen() {
  inspectorHideScreen = !inspectorHideScreen;
  const btn = document.getElementById('inspectorHideScreenBtn');
  if (btn) btn.classList.toggle('active', inspectorHideScreen);

  const canvas = document.getElementById('hbcnCanvas');
  if (canvas) {
    if (inspectorHideScreen) {
      canvas.classList.add('inspector-hidden');
    } else {
      canvas.classList.remove('inspector-hidden');
      canvas.style.filter = 'none';
      canvas.style.display = 'block';
    }
  }
}

// Initialize inspector DOM elements when HVNC opens
function inspectorInitDOM() {
  const area = document.getElementById('hbcnScreenArea');
  if (!area) return;
  if (document.getElementById('inspectorOverlay')) return;

  // Overlay container for boxes
  const overlay = document.createElement('div');
  overlay.id = 'inspectorOverlay';
  overlay.className = 'inspector-overlay';
  overlay.style.display = 'none';
  area.appendChild(overlay);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'inspectorTooltip';
  tooltip.className = 'inspector-tooltip';
  tooltip.style.display = 'none';
  area.appendChild(tooltip);

  // Info bar
  const info = document.createElement('div');
  info.id = 'inspectorInfo';
  info.className = 'inspector-info';
  info.style.display = 'none';
  area.appendChild(info);

  // Node properties panel
  const panel = document.createElement('div');
  panel.id = 'inspectorNodePanel';
  panel.className = 'inspector-node-panel';
  panel.style.display = 'none';
  area.appendChild(panel);

  // Controls
  const controls = document.createElement('div');
  controls.id = 'inspectorControls';
  controls.className = 'inspector-controls';
  controls.style.display = 'none';
  controls.innerHTML = `
    <button class="inspector-ctrl-btn" onclick="inspectorToggleHideScreen()" id="inspectorHideScreenBtn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      Hide Screen
    </button>
    <button class="inspector-ctrl-btn" onclick="inspectorToggle()" title="Close Inspector">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Close
    </button>
  `;
  area.appendChild(controls);
}
