// Armaan Backend process entry point.
//
// Boots the modular backend layer (backend/app.js) which wires routes,
// services, the WebSocket server, and starts both the APK backend and
// dashboard servers. Kept intentionally thin for clarity.

function shutdown(signal) {
  console.error(`[Server] Received ${signal}, shutting down`);
  try {
    // Keep the detached Cloudflare tunnel alive so the next server process can
    // adopt the same public URL instead of rotating it for no reason.
    require('./backend/services/tunnel-manager').preserve();
  } catch (err) {
    console.error('[Server] Tunnel preserve failed:', err.message);
  }
  setTimeout(() => process.exit(0), 400);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('exit', (code) => console.error('[Server] Process exit with code:', code));

const { app, server, start, config } = require('./backend/app');

const displayHost = config.server.host === '0.0.0.0' ? 'localhost' : config.server.host;
console.log(`[Server] Loaded config. Backend: http://${displayHost}:${config.server.port}`);

start();
