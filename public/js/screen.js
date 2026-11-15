/* ============================================
   Armaan - HW Workspace Module
   Compact toolbar + Screen/Camera/Mic workspaces
   ============================================ */

// ---- STATE ----
let isDragging = false;
let streamTimer = null;
let isStreaming = false;
let usePolling = false;
let videoWs = null;
let screenWidth = 1080;
let screenHeight = 2400;

let hwCurrentWs = 'screen';
let hwToolbarOpen = true;
let hwMoreOpen = false;
let hwScreenReadActive = false;

// Camera state machine: idle|connecting|live|stopping|stopped|error|permission_required|reconnecting
let hwCamState = 'idle';
let hwCamActive = false;
let hwCamFront = false;
let hwCamTimer = null;
let hwCamFrameCount = 0;
let hwCamLastFrameTs = 0;
let hwCamReconnectAttempts = 0;
const HW_CAM_MAX_RECONNECT = 3;

// Mic state machine: idle|connecting|live|stopping|stopped|error|permission_required|reconnecting
let hwMicState = 'idle';
let hwMicActive = false;
let hwMicMuted = false;
let hwMicTimer = null;
let hwMicAnimFrame = null;
let hwMicLevel = 0;
let hwMicLevelHistory = new Array(64).fill(0);

const HW_STATE_KEY = 'armaan_hw_state';

// ---- TOOLBAR ----
function hwToggleToolbar() {
    hwToolbarOpen = !hwToolbarOpen;
    const tb = document.getElementById('hwToolbar');
    if (tb) tb.classList.toggle('collapsed', !hwToolbarOpen);
    const icon = document.getElementById('hwTbToggleIcon');
    if (icon) icon.textContent = hwToolbarOpen ? 'chevron_left' : 'chevron_right';
    _saveHwState();
}

function hwSwitchWorkspace(ws) {
    if (ws === hwCurrentWs) return;
    hwCurrentWs = ws;

    document.querySelectorAll('.hw-ws').forEach(el => el.classList.remove('hw-ws-active'));
    document.querySelectorAll('.hw-tb-btn[data-ws]').forEach(b => b.classList.remove('hw-tb-active'));

    const wsEl = document.getElementById('hwWs' + ws.charAt(0).toUpperCase() + ws.slice(1));
    if (wsEl) wsEl.classList.add('hw-ws-active');

    const btn = document.querySelector('.hw-tb-btn[data-ws="' + ws + '"]');
    if (btn) btn.classList.add('hw-tb-active');

    if (ws === 'screen' && isStreaming) {
        startLiveScreen();
    }
    _saveHwState();
}

function hwToggleMore() {
    hwMoreOpen = !hwMoreOpen;
    const panel = document.getElementById('hwMorePanel');
    if (panel) panel.style.display = hwMoreOpen ? 'flex' : 'none';
}

function hwActionScreenshot() {
    hwTakeScreenshot();
}

async function hwTakeScreenshot() {
    try {
        const res = await fetch('/api/screen/capture', { cache: 'no-cache' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Screenshot failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenshot-' + Date.now() + '.jpg';
        a.click();
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') showToast('Screenshot saved', 'success');
    } catch (err) {
        if (typeof showToast === 'function') showToast('Screenshot: ' + err.message, 'error');
    }
}

// ---- SCREEN WORKSPACE ----
function getCanvasCoords(e, canvasId) {
    const canvas = document.getElementById(canvasId || 'hbcnCanvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = screenWidth / rect.width;
    const scaleY = screenHeight / rect.height;
    return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY)
    };
}

let _screenAutoRetryTimer = null;
let _screenRetryCount = 0;
const SCREEN_MAX_RETRIES = 999; // effectively unlimited

function startLiveScreen() {
    const canvas = document.getElementById('hbcnCanvas');
    const placeholder = document.getElementById('hbcnPlaceholder');
    if (!canvas) return;

    if (placeholder) placeholder.style.display = 'none';
    canvas.style.display = 'block';
    canvas.style.width = '';
    canvas.style.height = '';
    isStreaming = true;
    usePolling = true;
    _screenRetryCount = 0;

    _hwScreenStatus('connecting', 'Connecting...');
    initCanvasPointerEvents();
    // Send screen capture request to APK
    fetch('/api/control/screenshot', { method: 'POST' }).catch(() => {});
    startPollingFallback();
}

function tryVideoStream() {
    if (!isStreaming) return;
    usePolling = true;
    startPollingFallback();
}

function renderBinaryFrame(buffer) {
    try {
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        renderBlobOnCanvas(blob);
    } catch (e) {}
}

function fitCanvasToContainer(canvas, imgW, imgH) {
    const parent = canvas.parentElement;
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const maxW = pRect.width - 4;
    const maxH = pRect.height - 4;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    canvas.style.width = Math.round(imgW * scale) + 'px';
    canvas.style.height = Math.round(imgH * scale) + 'px';
}

function renderBlobOnCanvas(blob) {
    const canvas = document.getElementById('hbcnCanvas');
    if (!canvas) return;
    canvas._lastBlob = blob;
    const ctx = canvas.getContext('2d');

    _hwScreenStatus('live', 'Live');
    hbcnHideError();

    const imageUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        fitCanvasToContainer(canvas, img.width, img.height);
        canvas.style.cursor = (typeof hvncTouchEnabled !== 'undefined' ? hvncTouchEnabled : true) ? 'crosshair' : 'default';
        canvas.style.touchAction = 'none';
        URL.revokeObjectURL(imageUrl);
    };
    img.onerror = () => URL.revokeObjectURL(imageUrl);
    img.src = imageUrl;
}

function startPollingFallback() {
    if (!isStreaming) return;
    _hwScreenStatus('connecting', 'Connecting (fallback)...');
    pollScreenshot();
}

async function pollScreenshot() {
    if (!isStreaming) return;
    try {
        const response = await fetch('/api/screen/capture', { cache: 'no-cache', headers: { 'Accept': 'image/*' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        if (!blob || blob.size < 100) throw new Error('Empty response');
        renderBlobOnCanvas(blob);
        _hwScreenStatus('live', 'Live');
        hbcnHideError();
        _screenRetryCount = 0; // reset on success
    } catch (err) {
        _screenRetryCount++;
        if (isStreaming) {
            const label = `Retrying (${_screenRetryCount})...`;
            _hwScreenStatus('connecting', label);
            // Don't show blocking error — just keep retrying silently
            // Only show error overlay after many failures
            if (_screenRetryCount >= 5) {
                hbcnShowErrorSoft(err.message);
            }
        }
    }
    if (isStreaming && usePolling) {
        const delay = _screenRetryCount > 10 ? 3000 : _screenRetryCount > 3 ? 1500 : 800;
        streamTimer = setTimeout(pollScreenshot, delay);
    }
}

function hbcnShowErrorSoft(message) {
    // Show error but DON'T call stopLiveScreen — keep retrying
    const errorEl = document.getElementById('hbcnError');
    const errorText = document.getElementById('hbcnErrorText');
    if (errorEl && errorText) {
        errorText.textContent = message || 'Waiting for device...';
        errorEl.style.display = 'flex';
    }
    _hwScreenStatus('connecting', 'Reconnecting...');
}

async function sendTap(x, y) {
    try { await fetch('/api/screen/tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); } catch (e) {}
}
async function sendSwipe(x1, y1, x2, y2, duration) {
    try { await fetch('/api/screen/swipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x1, y1, x2, y2, duration }) }); } catch (e) {}
}
async function sendScroll(direction) {
    try { await fetch('/api/screen/scroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction, amount: 'medium' }) }); } catch (e) {}
}
async function sendLongPress(x, y) {
    try { await fetch('/api/screen/long-press', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y, duration: 1500 }) }); } catch (e) {}
}
async function sendDoubleTap(x, y) {
    try { await fetch('/api/screen/double-tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x, y }) }); } catch (e) {}
}

function hvncTouchGuard() {
    return typeof hvncTouchEnabled !== 'undefined' ? !hvncTouchEnabled : false;
}

function showTapFeedback(canvas, x, y) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = x / scaleX;
    const cy = y / scaleY;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(229, 57, 53, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(229, 57, 53, 0.6)';
    ctx.fill();
    setTimeout(() => { try { renderBlobOnCanvas(canvas._lastBlob); } catch(e) {} }, 200);
}

// ---- POINTER EVENTS ----
let pointerDown = false;
let pointerStart = { x: 0, y: 0 };
let lastTapTime = 0;
let pointerStartTime = 0;
const TAP_THRESHOLD = 15;
const DOUBLE_TAP_DELAY = 300;
const SWIPE_THRESHOLD = 15;

function initCanvasPointerEvents() {
    const canvas = document.getElementById('hbcnCanvas');
    if (!canvas || canvas._ptrInit) return;
    canvas._ptrInit = true;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';

    canvas.addEventListener('pointerdown', (e) => {
        if (hvncTouchGuard()) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const coords = getCanvasCoords(e);
        if (!coords) return;
        pointerDown = true;
        pointerStart = coords;
        pointerStartTime = Date.now();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!pointerDown || hvncTouchGuard()) return;
        e.preventDefault();
    });

    canvas.addEventListener('pointerup', (e) => {
        if (!pointerDown || hvncTouchGuard()) return;
        e.preventDefault();
        pointerDown = false;
        const coords = getCanvasCoords(e);
        if (!coords) return;
        const dx = coords.x - pointerStart.x;
        const dy = coords.y - pointerStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > SWIPE_THRESHOLD) {
            const duration = Math.min(800, Math.max(100, Date.now() - pointerStartTime));
            sendSwipe(pointerStart.x, pointerStart.y, coords.x, coords.y, duration);
        } else {
            const now = Date.now();
            if (lastTapTime > 0 && now - lastTapTime < DOUBLE_TAP_DELAY) {
                lastTapTime = 0;
                showTapFeedback(canvas, coords.x, coords.y);
                sendDoubleTap(coords.x, coords.y);
            } else {
                lastTapTime = now;
                showTapFeedback(canvas, coords.x, coords.y);
                sendTap(coords.x, coords.y);
            }
        }
    });

    canvas.addEventListener('pointercancel', () => { pointerDown = false; });
}

function stopLiveScreen() {
    isStreaming = false;
    usePolling = false;
    if (videoWs) { videoWs.close(); videoWs = null; }
    if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
    _hwScreenStatus('idle', 'Disconnected');
}

function _hwScreenStatus(status, label) {
    const dot = document.getElementById('hwScreenDot');
    const lbl = document.getElementById('hwScreenLabel');
    if (dot) {
        dot.className = 'hw-ws-dot';
        if (status === 'live') dot.classList.add('live');
        else if (status === 'connecting') dot.classList.add('connecting');
        else if (status === 'error') dot.classList.add('error');
    }
    if (lbl) lbl.textContent = label || status;
}

// ============================================
// CAMERA WORKSPACE
// State machine: idle -> connecting -> live -> stopping -> idle
//                                   -> error -> reconnecting -> connecting
// ============================================

function _hwCamSetState(state, label) {
    hwCamState = state;
    const dot = document.getElementById('hwCamDot');
    const lbl = document.getElementById('hwCamLabel');
    const statusEl = document.getElementById('hwCamStatus');

    if (dot) {
        dot.className = 'hw-ws-dot';
        if (state === 'live') dot.classList.add('live');
        else if (state === 'connecting' || state === 'reconnecting') dot.classList.add('connecting');
        else if (state === 'error') dot.classList.add('error');
    }
    if (lbl) lbl.textContent = label || state;

    // Update status indicator in workspace
    if (statusEl) {
        statusEl.className = 'hw-cam-status';
        if (state === 'live') {
            statusEl.classList.add('hw-cam-live');
            statusEl.innerHTML = '<span class="hw-cam-live-dot"></span>LIVE';
        } else if (state === 'connecting' || state === 'reconnecting') {
            statusEl.classList.add('hw-cam-connecting');
            statusEl.textContent = state === 'reconnecting' ? 'RECONNECTING...' : 'CONNECTING...';
        } else if (state === 'error') {
            statusEl.classList.add('hw-cam-error');
            statusEl.textContent = 'ERROR';
        } else if (state === 'permission_required') {
            statusEl.classList.add('hw-cam-permission');
            statusEl.textContent = 'PERMISSION NEEDED';
        } else {
            statusEl.textContent = '';
        }
    }

    // Update toolbar button visual state
    const camBtn = document.querySelector('.hw-tb-btn[data-ws="camera"]');
    if (camBtn) camBtn.classList.toggle('hw-tb-active', state === 'live' || state === 'connecting');

    // Update camera controls visibility
    _hwCamUpdateControls();
}

function _hwCamUpdateControls() {
    const isLive = hwCamState === 'live';
    const isConnecting = hwCamState === 'connecting' || hwCamState === 'reconnecting';
    const isIdle = hwCamState === 'idle' || hwCamState === 'stopped';
    const isError = hwCamState === 'error';

    const startBtn = document.getElementById('hwCamStartBtn');
    const stopBtn = document.getElementById('hwCamStopBtn');
    const snapBtn = document.getElementById('hwCamSnapBtn');
    const switchBtn = document.getElementById('hwCamSwitchBtn');
    const retryBtn = document.getElementById('hwCamRetryBtn');

    if (startBtn) startBtn.style.display = (isIdle || isError) ? 'flex' : 'none';
    if (stopBtn) stopBtn.style.display = isLive ? 'flex' : 'none';
    if (snapBtn) snapBtn.style.display = isLive ? 'flex' : 'none';
    if (switchBtn) switchBtn.style.display = (isLive || isIdle) ? 'flex' : 'none';
    if (retryBtn) retryBtn.style.display = isError ? 'flex' : 'none';
}

async function hwCamStart() {
    if (hwCamState === 'live' || hwCamState === 'connecting') return;

    hwCamFrameCount = 0;
    hwCamLastFrameTs = 0;
    hwCamReconnectAttempts = 0;
    _hwCamSetState('connecting', 'Connecting...');

    // Show loading in viewport
    const ph = document.getElementById('hwCamPlaceholder');
    const img = document.getElementById('hwCamFrame');
    const loadingEl = document.getElementById('hwCamLoading');
    if (ph) { ph.style.display = 'none'; ph.innerHTML = ''; }
    if (img) img.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await fetch('/api/apk/camera/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ camera_id: hwCamFront ? '1' : '0' })
        });
        if (!res.ok) throw new Error('Camera start request failed (HTTP ' + res.status + ')');
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Start polling for frames
        hwCamActive = true;
        _hwCamPollFrames();
    } catch (err) {
        _hwCamSetState('error', 'Error: ' + err.message);
        if (loadingEl) loadingEl.style.display = 'none';
        if (ph) {
            ph.style.display = 'flex';
            ph.innerHTML = '<span class="material-symbols-outlined" style="font-size:48px;opacity:0.3">error</span><p>' + err.message + '</p>';
        }
    }
}

function _hwCamPollFrames() {
    if (!hwCamActive || (hwCamState !== 'live' && hwCamState !== 'connecting' && hwCamState !== 'reconnecting')) return;

    hwCamTimer = setTimeout(async () => {
        if (!hwCamActive) return;
        try {
            const res = await fetch('/api/camera/live/frame?wait=1', { cache: 'no-cache' });
            if (res.ok) {
                const blob = await res.blob();
                if (blob.size > 100) {
                    const url = URL.createObjectURL(blob);
                    const imgEl = document.getElementById('hwCamFrame');
                    const ph = document.getElementById('hwCamPlaceholder');
                    const loadingEl = document.getElementById('hwCamLoading');

                    if (imgEl) {
                        imgEl.onload = () => {
                            URL.revokeObjectURL(url);
                            // Update frame counter
                            hwCamFrameCount++;
                            hwCamLastFrameTs = Date.now();
                            // Transition to live on first frame
                            if (hwCamState !== 'live') {
                                hwCamReconnectAttempts = 0;
                                _hwCamSetState('live', 'Live');
                                if (loadingEl) loadingEl.style.display = 'none';
                            }
                        };
                        imgEl.src = url;
                        imgEl.style.display = 'block';
                    }
                    if (ph) ph.style.display = 'none';
                    if (loadingEl) loadingEl.style.display = 'none';
                }
            } else if (res.status === 404) {
                // No frame available yet - keep polling if still connecting
                if (hwCamState === 'connecting') {
                    // Still waiting for first frame
                }
            }
        } catch (e) {
            // Network error - attempt reconnect
            if (hwCamActive && hwCamState === 'live') {
                _hwCamAttemptReconnect();
                return;
            }
        }
        if (hwCamActive) _hwCamPollFrames();
    }, 350);
}

function _hwCamAttemptReconnect() {
    if (hwCamReconnectAttempts >= HW_CAM_MAX_RECONNECT) {
        _hwCamSetState('error', 'Connection lost');
        hwCamActive = false;
        if (hwCamTimer) { clearTimeout(hwCamTimer); hwCamTimer = null; }
        return;
    }
    hwCamReconnectAttempts++;
    _hwCamSetState('reconnecting', 'Reconnecting (' + hwCamReconnectAttempts + '/' + HW_CAM_MAX_RECONNECT + ')...');

    // Re-request camera start
    fetch('/api/apk/camera/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_id: hwCamFront ? '1' : '0' })
    }).then(() => {
        if (hwCamActive) _hwCamPollFrames();
    }).catch(() => {
        if (hwCamActive) _hwCamAttemptReconnect();
    });
}

async function hwCamStop() {
    hwCamActive = false;
    _hwCamSetState('stopping', 'Stopping...');
    if (hwCamTimer) { clearTimeout(hwCamTimer); hwCamTimer = null; }

    try {
        await fetch('/api/apk/camera/stop', { method: 'POST' });
    } catch (e) {}

    _hwCamSetState('idle', 'Camera Off');

    // Reset viewport
    const img = document.getElementById('hwCamFrame');
    const ph = document.getElementById('hwCamPlaceholder');
    const loadingEl = document.getElementById('hwCamLoading');
    if (img) { img.style.display = 'none'; img.removeAttribute('src'); }
    if (loadingEl) loadingEl.style.display = 'none';
    if (ph) {
        ph.style.display = 'flex';
        ph.innerHTML = '<span class="material-symbols-outlined" style="font-size:48px;opacity:0.3">photo_camera</span><p>Tap Start to begin camera stream</p>';
    }
}

function hwCamSwitch() {
    hwCamFront = !hwCamFront;
    const label = document.getElementById('hwCamFacingLabel');
    if (label) label.textContent = hwCamFront ? 'Front' : 'Rear';
    if (hwCamActive) {
        hwCamStop().then(() => setTimeout(hwCamStart, 300));
    }
}

async function hwCamSnapshot() {
    if (hwCamState !== 'live') return;
    try {
        const res = await fetch('/api/camera/photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ camera_id: hwCamFront ? '1' : '0' })
        });
        if (res.ok) {
            if (typeof showToast === 'function') showToast('Snapshot requested', 'success');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Snapshot failed', 'error');
    }
}

function hwCamRetry() {
    hwCamStop().then(() => setTimeout(hwCamStart, 200));
}

// ============================================
// MICROPHONE WORKSPACE
// State machine: idle -> connecting -> live -> stopping -> idle
//                                   -> error -> reconnecting -> connecting
// ============================================

function _hwMicSetState(state, label) {
    hwMicState = state;
    const dot = document.getElementById('hwMicDot');
    const lbl = document.getElementById('hwMicLabel');
    const statusEl = document.getElementById('hwMicStatus');

    if (dot) {
        dot.className = 'hw-ws-dot';
        if (state === 'live') dot.classList.add('live');
        else if (state === 'connecting' || state === 'reconnecting') dot.classList.add('connecting');
        else if (state === 'error') dot.classList.add('error');
    }
    if (lbl) lbl.textContent = label || state;

    if (statusEl) {
        statusEl.className = 'hw-mic-status';
        if (state === 'live') {
            statusEl.classList.add('hw-mic-live');
            statusEl.innerHTML = '<span class="hw-mic-live-dot"></span>ACTIVE';
        } else if (state === 'connecting' || state === 'reconnecting') {
            statusEl.classList.add('hw-mic-connecting');
            statusEl.textContent = state === 'reconnecting' ? 'RECONNECTING...' : 'CONNECTING...';
        } else if (state === 'error') {
            statusEl.classList.add('hw-mic-error');
            statusEl.textContent = 'ERROR';
        } else if (state === 'permission_required') {
            statusEl.classList.add('hw-mic-permission');
            statusEl.textContent = 'PERMISSION NEEDED';
        } else {
            statusEl.textContent = '';
        }
    }

    // Update toolbar button visual state
    const micBtn = document.querySelector('.hw-tb-btn[data-ws="mic"]');
    if (micBtn) micBtn.classList.toggle('hw-tb-active', state === 'live' || state === 'connecting');

    _hwMicUpdateControls();
}

function _hwMicUpdateControls() {
    const isLive = hwMicState === 'live';
    const isIdle = hwMicState === 'idle' || hwMicState === 'stopped';
    const isError = hwMicState === 'error';

    const startBtn = document.getElementById('hwMicStartBtn');
    const stopBtn = document.getElementById('hwMicStopBtn');
    const muteBtn = document.getElementById('hwMicMuteBtn');

    if (startBtn) startBtn.style.display = (isIdle || isError) ? 'flex' : 'none';
    if (stopBtn) stopBtn.style.display = isLive ? 'flex' : 'none';
    if (muteBtn) muteBtn.style.display = isLive ? 'flex' : 'none';
}

async function hwMicStart() {
    if (hwMicState === 'live' || hwMicState === 'connecting') return;
    _hwMicSetState('connecting', 'Connecting...');

    try {
        const res = await fetch('/api/apk/mic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subc: 'ON', Arate: '16000', Asrc: '1' })
        });
        if (!res.ok) throw new Error('Mic start request failed (HTTP ' + res.status + ')');
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        hwMicActive = true;
        hwMicMuted = false;
        _hwMicSetState('live', 'Active');
        _hwMicStartWaveform();
    } catch (err) {
        _hwMicSetState('error', 'Error: ' + err.message);
    }
}

function _hwMicStartWaveform() {
    const canvas = document.getElementById('hwMicCanvas');
    const placeholder = document.getElementById('hwMicPlaceholder');
    const waveform = document.getElementById('hwMicWaveform');
    if (!canvas) return;
    if (placeholder) placeholder.style.display = 'none';
    if (waveform) waveform.style.display = 'block';

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(dpr, dpr);
    }
    resize();

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const barCount = 48;
    const barGap = 2;

    function drawLevel() {
        if (!hwMicActive) return;

        // Fetch real audio level from server
        fetch('/api/apk/mic/status', { cache: 'no-cache' })
            .then(r => r.json())
            .then(data => {
                const rawLevel = data.level || 0;
                hwMicLevel = hwMicMuted ? 0 : rawLevel;

                // Smooth level history for waveform persistence
                hwMicLevelHistory.push(hwMicLevel);
                if (hwMicLevelHistory.length > barCount) hwMicLevelHistory.shift();

                _hwMicDrawWaveform(ctx, w, h, barCount, barGap);
                if (hwMicActive) hwMicAnimFrame = requestAnimationFrame(drawLevel);
            })
            .catch(() => {
                if (hwMicActive) hwMicAnimFrame = requestAnimationFrame(drawLevel);
            });
    }
    drawLevel();
}

function _hwMicDrawWaveform(ctx, w, h, barCount, barGap) {
    ctx.clearRect(0, 0, w, h);

    const barW = (w - (barCount - 1) * barGap) / barCount;
    const centerY = h / 2;

    for (let i = 0; i < barCount; i++) {
        const level = (hwMicLevelHistory[i] || 0) / 100;
        const barH = Math.max(2, level * h * 0.8);
        const x = i * (barW + barGap);

        // Color: red when active, grey when muted
        const alpha = hwMicMuted ? 0.15 : (0.2 + level * 0.6);
        const color = hwMicMuted ? `rgba(100,100,100,${alpha})` : `rgba(229,57,53,${alpha})`;

        ctx.fillStyle = color;
        const radius = Math.min(barW / 2, 3);
        const bx = x;
        const by = centerY - barH / 2;
        const bw = barW;
        const bh = barH;

        // Rounded rect
        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bw - radius, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
        ctx.lineTo(bx + bw, by + bh - radius);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
        ctx.lineTo(bx + radius, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.fill();
    }

    // Center line
    ctx.strokeStyle = hwMicMuted ? 'rgba(100,100,100,0.1)' : 'rgba(229,57,53,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
}

async function hwMicStop() {
    hwMicActive = false;
    _hwMicSetState('stopping', 'Stopping...');
    if (hwMicAnimFrame) { cancelAnimationFrame(hwMicAnimFrame); hwMicAnimFrame = null; }

    try {
        await fetch('/api/apk/mic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subc: 'OFF' })
        });
    } catch (e) {}

    hwMicLevel = 0;
    hwMicLevelHistory.fill(0);
    _hwMicSetState('idle', 'Mic Off');

    const waveform = document.getElementById('hwMicWaveform');
    const placeholder = document.getElementById('hwMicPlaceholder');
    if (waveform) waveform.style.display = 'none';
    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = '<span class="material-symbols-outlined" style="font-size:48px;opacity:0.3">mic</span><p>Tap Start to begin microphone</p>';
    }
}

function hwMicMute() {
    hwMicMuted = !hwMicMuted;
    const btn = document.getElementById('hwMicMuteBtn');
    if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = hwMicMuted ? 'mic' : 'mic_off';
    }
    // Send mute/unmute to APK
    fetch('/api/apk/mic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subc: hwMicMuted ? 'pz' : 'co' })
    }).catch(() => {});
}

// ---- BLACK / BLANK SCREEN TOGGLE ----
let hwBlackScreenActive = false;
let hwBlankScreenActive = false;

async function _hwSendBlock(state, bstyle) {
    try {
        await fetch('/api/apk/screen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subc: 'block', blockstate: state, bstyle: bstyle || '' })
        });
    } catch (e) {}
}

function hwToggleBlackScreen() {
    hwBlackScreenActive = !hwBlackScreenActive;
    const btn = document.getElementById('hwBlackScreenBtn');
    if (btn) btn.classList.toggle('hw-tb-active', hwBlackScreenActive);
    const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;
    if (icon) icon.textContent = hwBlackScreenActive ? 'dark_mode' : 'brightness_high';

    const blackBase64 = btoa('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body></body></html>');
    if (hwBlackScreenActive) {
        if (hwBlankScreenActive) { hwBlankScreenActive = false; const b2 = document.getElementById('hwBlankScreenBtn'); if (b2) b2.classList.remove('hw-tb-active'); }
        _hwSendBlock('1', blackBase64);
    } else {
        _hwSendBlock('0', '');
    }
}

function hwToggleBlankScreen() {
    hwBlankScreenActive = !hwBlankScreenActive;
    const btn = document.getElementById('hwBlankScreenBtn');
    if (btn) btn.classList.toggle('hw-tb-active', hwBlankScreenActive);
    const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;
    if (icon) icon.textContent = hwBlankScreenActive ? 'visibility_off' : 'visibility';

    const blankBase64 = btoa('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#fff;overflow:hidden}</style></head><body></body></html>');
    if (hwBlankScreenActive) {
        if (hwBlackScreenActive) { hwBlackScreenActive = false; const b2 = document.getElementById('hwBlackScreenBtn'); if (b2) b2.classList.remove('hw-tb-active'); }
        _hwSendBlock('1', blankBase64);
    } else {
        _hwSendBlock('0', '');
    }
}

// ---- SESSIONS ----
async function loadApkSessions() {
    try {
        const res = await fetch('/api/apk/sessions', { cache: 'no-cache' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.sessions || [];
    } catch (e) {
        return [];
    }
}

// ---- SCREEN READER TOGGLE ----
async function hwToggleScreenRead() {
    const current = hwScreenReadActive;
    const btn = document.querySelector('.hw-tb-btn[data-ws="screenread"]');
    if (btn) btn.classList.add('hw-tb-active');

    async function send(payload) {
        const res = await fetch('/api/apk/screenread', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || ('HTTP ' + res.status));
        }
        const data = await res.json().catch(() => ({}));
        if (data && data.success === false) throw new Error(data.error || 'Server rejected command');
        return data;
    }

    const turningOn = !current;
    try {
        if (turningOn) {
            await send({ cas: '1', skidf: 'dash-' + Date.now() });
        } else {
            await send({ cas: '0' });
        }
        hwScreenReadActive = turningOn;
        if (typeof showToast === 'function') {
            showToast(turningOn ? 'Screen Reader ON' : 'Screen Reader OFF', turningOn ? 'success' : 'info');
        }
        if (typeof inspectorToggle === 'function') inspectorToggle();
    } catch (err) {
        hwScreenReadActive = current;
        if (typeof showToast === 'function') {
            showToast('Screen Reader: ' + (err.message || 'failed'), 'error');
        }
    } finally {
        if (btn) btn.classList.toggle('hw-tb-active', hwScreenReadActive);
    }

    hwSwitchWorkspace('screen');
}

// ---- SCREEN SKIN ACTIONS (HBNC more menu) ----
async function hwScreenPost(url, body, label) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || ('HTTP ' + res.status));
        }
        if (typeof showToast === 'function') showToast(label || 'Sent', 'success');
    } catch (err) {
        if (typeof showToast === 'function') showToast((label || 'Command') + ': ' + (err.message || 'failed'), 'error');
    }
}

function hwScreenSpeech() {
    hwScreenPost('/api/apk/screenread', { cas: '1', skidf: 'dash-' + Date.now() }, 'Speech triggered');
}

function hwScreenTTS() {
    hwScreenPost('/api/apk/screenread', { cas: '1', skidf: 'tts-' + Date.now() }, 'Text-to-Speech');
}

function hwScreenScrOn() {
    hwScreenPost('/api/control/lockscr', null, 'Screen On');
}

function hwScreenScrOff() {
    hwScreenPost('/api/control/unlockscr', null, 'Screen Off');
}

function hwScreenAudio() {
    hwScreenPost('/api/control/volume-up', null, 'Audio');
}

// ---- ERROR / RETRY ----
function hbcnShowError(message) {
    const errorEl = document.getElementById('hbcnError');
    const errorText = document.getElementById('hbcnErrorText');
    if (errorEl && errorText) {
        errorText.textContent = message || 'An error occurred';
        errorEl.style.display = 'flex';
    }
    _hwScreenStatus('error', 'Error');
    // Don't stop streaming on error - let retry logic handle it
}

function hbcnHideError() {
    const el = document.getElementById('hbcnError');
    if (el) el.style.display = 'none';
}

function hbcnUpdateConnStatus(status, label) {
    const dot = document.getElementById('hbcnConnDot');
    const lbl = document.getElementById('hbcnConnLabel');
    if (dot) {
        dot.className = 'hvnc-conn-dot ' + status;
    }
    if (lbl) lbl.textContent = label || status;
}

function hbcnRetry() {
    hbcnHideError();
    _screenRetryCount = 0;
    if (!isStreaming) {
        startLiveScreen();
    } else {
        if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
        pollScreenshot();
    }
}

// ---- PERSISTENCE ----
function _saveHwState() {
    try {
        localStorage.setItem(HW_STATE_KEY, JSON.stringify({
            toolbar: hwToolbarOpen,
            ws: hwCurrentWs
        }));
    } catch (e) {}
}

function _loadHwState() {
    try {
        const raw = localStorage.getItem(HW_STATE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { toolbar: true, ws: 'screen' };
}

// Highlight an HBNC screen-control as ACTIVE (green); clears all others.
function _hwClearActive() {
  document.querySelectorAll('.hw-tb-btn.hw-active, .hw-more-item.hw-active, .hw-ws-btn.hw-active').forEach(el => el.classList.remove('hw-active'));
}

function hwMarkActive(el) {
  if (!el) return;
  if (el.classList.contains('hw-active')) {
    el.classList.remove('hw-active');
    return;
  }
  _hwClearActive();
  el.classList.add('hw-active');
}

function _initHwState() {
    const state = _loadHwState();
    hwToolbarOpen = state.toolbar !== false;
    hwCurrentWs = state.ws || 'screen';

    const tb = document.getElementById('hwToolbar');
    if (tb) tb.classList.toggle('collapsed', !hwToolbarOpen);

    const icon = document.getElementById('hwTbToggleIcon');
    if (icon) icon.textContent = hwToolbarOpen ? 'chevron_left' : 'chevron_right';

    if (hwCurrentWs !== 'screen') {
        hwSwitchWorkspace(hwCurrentWs);
    }

    // Initialize control visibility
    _hwCamUpdateControls();
    _hwMicUpdateControls();

    // Clicking any HBNC control marks it active (green). Default look is red.
    const wiring = document.querySelectorAll('.hw-toolbar, .hw-more-panel, .hw-ws-header');
    wiring.forEach((root) => {
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('.hw-tb-btn, .hw-more-item, .hw-ws-btn');
        if (!btn) return;
        if (btn.classList.contains('hw-tb-toggle') || btn.closest('.hw-tb-spacer')) return;
        hwMarkActive(btn);
      });
    });
}

// ---- EXPOSE GLOBALS ----
window.startLiveScreen = startLiveScreen;
window.stopLiveScreen = stopLiveScreen;
window.sendTap = sendTap;
window.sendSwipe = sendSwipe;
window.sendLongPress = sendLongPress;
window.sendDoubleTap = sendDoubleTap;
window.hbcnUpdateConnStatus = hbcnUpdateConnStatus;
window.hbcnShowError = hbcnShowError;
window.hbcnShowErrorSoft = hbcnShowErrorSoft;
window.hbcnHideError = hbcnHideError;
window.initCanvasPointerEvents = initCanvasPointerEvents;
window.hwToggleToolbar = hwToggleToolbar;
window.hwSwitchWorkspace = hwSwitchWorkspace;
window.hwToggleMore = hwToggleMore;
window.hwActionScreenshot = hwActionScreenshot;
window.hwTakeScreenshot = hwTakeScreenshot;
window.hwCamStart = hwCamStart;
window.hwCamStop = hwCamStop;
window.hwCamSwitch = hwCamSwitch;
window.hwCamSnapshot = hwCamSnapshot;
window.hwCamRetry = hwCamRetry;
window.hwMicStart = hwMicStart;
window.hwMicStop = hwMicStop;
window.hwMicMute = hwMicMute;
window.hwToggleScreenRead = hwToggleScreenRead;
window.hwScreenSpeech = hwScreenSpeech;
window.hwScreenTTS = hwScreenTTS;
window.hwScreenScrOn = hwScreenScrOn;
window.hwScreenScrOff = hwScreenScrOff;
window.hwScreenAudio = hwScreenAudio;
window.hwToggleBlackScreen = hwToggleBlackScreen;
window.hwToggleBlankScreen = hwToggleBlankScreen;
window.loadApkSessions = loadApkSessions;
window.hbcnRetry = hbcnRetry;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initHwState);
} else {
    setTimeout(_initHwState, 0);
}
