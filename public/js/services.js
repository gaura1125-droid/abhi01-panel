/* ============================================
   Armaan - Services Module
   MCP Server Service Registry
   ============================================ */

let servicesData = null;

async function loadServices(forceRefresh = false) {
  const container = document.getElementById('servicesList');
  if (!container) return;
  
  container.innerHTML = '<div class="empty-state"><span class="spinner-sm"></span> Loading services...</div>';
  
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    servicesData = data;
    
    const services = data.services || [];
    const countEl = document.getElementById('servicesCount');
    const urlEl = document.getElementById('servicesUrl');
    
    if (countEl) countEl.textContent = `${services.length} services`;
    if (urlEl) {
      const baseUrl = (window.CONFIG && window.CONFIG.baseUrl) || data.localUrl || data.publicUrl || window.location.hostname;
      urlEl.textContent = baseUrl;
      if (data.publicUrl || (window.CONFIG && window.CONFIG.publicUrl)) {
        urlEl.innerHTML += ` <span class="services-public">🌐 ${data.publicUrl || window.CONFIG.publicUrl}</span>`;
      }
    }
    
    renderServices(services);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function renderServices(services) {
  const container = document.getElementById('servicesList');
  if (!container) return;
  
  if (!services || services.length === 0) {
    container.innerHTML = '<div class="empty-state">No services available</div>';
    return;
  }
  
  // Group by protocol
  const groups = {};
  for (const svc of services) {
    const protocol = svc.protocol || 'Unknown';
    if (!groups[protocol]) groups[protocol] = [];
    groups[protocol].push(svc);
  }
  
  // Sort protocols: gRPC first, then WebSocket, then HTTP, then others
  const protocolOrder = ['gRPC Protocol Buffers Binary', 'gRPC Protocol Buffers', 'WebSocket Binary', 'WebSocket Binary Protocol', 'HTTP JPEG Binary', 'HTTP Range Binary', 'HTTP JSON', 'MCP Streamable HTTP JSON-RPC'];
  
  let html = '';
  
  // Render known protocols in order
  for (const proto of protocolOrder) {
    if (groups[proto]) {
      html += renderProtocolGroup(proto, groups[proto]);
      delete groups[proto];
    }
  }
  
  // Render remaining protocols
  for (const [proto, svcs] of Object.entries(groups)) {
    html += renderProtocolGroup(proto, svcs);
  }
  
  container.innerHTML = html;
  
  // Apply status checks for reachable services
  checkServicesStatus(services);
}

function renderProtocolGroup(protocol, services) {
  // Simplified icon/label for each protocol
  let icon = '';
  let label = protocol;
  
  if (protocol.includes('gRPC')) { icon = '🔌'; label = 'gRPC Binary'; }
  else if (protocol.includes('WebSocket')) { icon = '🔗'; label = 'WebSocket'; }
  else if (protocol.includes('JPEG')) { icon = '📷'; label = 'Screenshot'; }
  else if (protocol.includes('HTTP JSON')) { icon = '🌐'; label = 'HTTP JSON'; }
  else if (protocol.includes('HTTP Range')) { icon = '📁'; label = 'File Transfer'; }
  else if (protocol.includes('MCP')) { icon = '⚡'; label = 'MCP Core'; }
  else { icon = '🔹'; label = protocol.slice(0, 20); }
  
  return `
    <div class="services-group">
      <div class="services-group-header">
        <span class="services-group-icon">${icon}</span>
        <span class="services-group-label">${label}</span>
        <span class="services-group-count">${services.length}</span>
      </div>
      <div class="services-group-list">
        ${services.map(svc => `
          <div class="services-item" data-endpoint="${svc.endpoint}">
            <div class="services-item-left">
              <div class="services-item-name">${svc.name}</div>
              <div class="services-item-endpoint">
                <code>${svc.endpoint}</code>
                <span class="services-item-protocol">${svc.protocol}</span>
              </div>
            </div>
            <div class="services-item-right">
              <span class="services-status-dot" id="svc-status-${svc.name.toLowerCase()}"></span>
              <button class="services-test-btn" onclick="testServiceEndpoint('${svc.name}', '${svc.endpoint}', '${svc.protocol.replace(/'/g, "\\'")}')" title="Test endpoint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function checkServicesStatus(services) {
  // Test HTTP services in parallel
  const checkable = services.filter(s => 
    (s.protocol.includes('HTTP') || s.protocol.includes('MCP')) && 
    !s.endpoint.includes('*') && 
    !s.endpoint.startsWith('/gesture')
  );
  
  await Promise.allSettled(checkable.map(async (svc) => {
    const dot = document.getElementById(`svc-status-${svc.name.toLowerCase()}`);
    if (!dot) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const baseUrl = (window.CONFIG && window.CONFIG.baseUrl) || '';
      if (baseUrl) await fetch(`${baseUrl}${svc.endpoint}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      dot.className = 'services-status-dot services-status-online';
    } catch (e) {
      dot.className = 'services-status-dot services-status-offline';
    }
  }));
}

async function testServiceEndpoint(name, endpoint, protocol) {
  showToast(`Testing: ${name} (${endpoint})`, 'info');
  
  try {
    const baseUrl = (window.CONFIG && window.CONFIG.baseUrl) || '';
    if (!baseUrl) { showToast(`❌ ${name}: No base URL configured`, 'error'); return; }
    const fullUrl = `${baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const contentType = res.headers.get('content-type') || '';
    const size = res.headers.get('content-length') || '?';
    
    if (contentType.includes('json')) {
      const data = await res.json();
      showToast(`✅ ${name}: ${res.status} (${JSON.stringify(data).slice(0, 100)}...)`, 'success');
    } else if (contentType.includes('jpeg') || contentType.includes('image')) {
      showToast(`✅ ${name}: ${res.status} (${size} bytes, ${contentType})`, 'success');
    } else {
      const text = await res.text().catch(() => '');
      showToast(`✅ ${name}: ${res.status} (${(text.length || size)} bytes)`, 'success');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      showToast(`❌ ${name}: Timeout (no response in 5s)`, 'error');
    } else {
      showToast(`❌ ${name}: ${err.message.slice(0, 60)}`, 'error');
    }
  }
}

// Auto-load on tab switch (called from app.js)
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('servicesList')) {
    setTimeout(loadServices, 500);
  }
});
