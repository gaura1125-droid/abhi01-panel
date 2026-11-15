# Armaan — Admin Dashboard & Device Control Platform

> **Protected Source Release** — WebSocket-based remote administration for Android devices with real-time screen streaming, injection, and fleet management.

---

## 📦 Overview

Armaan is a full-stack device administration platform consisting of:

- **Backend** — Node.js/Express server with WebSocket support for real-time device communication
- **Dashboard** — Admin web interface for device management, screen streaming, file access, and app control
- **APK** — Android client (WebView-based) for device enrollment and remote control
- **Auth System** — Two-factor OTP authentication via Telegram with trusted-device support
- **License System** — Tenant-based licensing with super-admin console

---

## 🚀 Quick Start

```bash
# 1. Extract the release
unzip Armaan_Obfuscated_Release.zip
cd Armaan_Obfuscated_Release

# 2. Make scripts executable
chmod +x install.sh start.sh

# 3. Run automated setup
./install.sh

# 4. Start the server
./start.sh
```

The installer will:
- Detect your OS (Ubuntu, Debian, Fedora, Arch, Alpine, Termux, macOS)
- Install Node.js 18+ if missing
- Install npm dependencies from `package-lock.json`
- Validate `armand.json` configuration
- Generate session secrets
- Create runtime directories
- Detect Android SDK for APK builds

---

## 🌐 Access Points

After starting:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | `http://127.0.0.1:3000` | Admin web interface |
| **APK Backend** | `http://127.0.0.1:22222` | Device WebSocket/API endpoint |
| **Login** | `http://127.0.0.1:3000/login` | OTP authentication |
| **Admin Console** | `http://127.0.0.1:3000/admin` | Super-admin panel (requires secret token) |

> **Security Note**: By default, the dashboard binds to `127.0.0.1` (loopback only).  
> Set `DASHBOARD_HOST=0.0.0.0` in `.env` to allow LAN access.

---

## ⚙️ Configuration

### `armand.json` (Primary Config)
```json
{
  "connection": {
    "public_url": "https://your-domain.trycloudflare.com",
    "dashboard_port": 3000,
    "apk_port": 22222
  },
  "server": {
    "host": "0.0.0.0",
    "port": 22222,
    "baseUrl": "http://127.0.0.1:22222",
    "publicUrl": "https://your-domain.trycloudflare.com",
    "overlay_base_url": "http://127.0.0.1:3000"
  },
  "features": {
    "cloudflare_tunnel": true,
    "screenshot_only": false,
    "live_screen": true,
    "screen_control": true
  }
}
```

### `.env` (Runtime Overrides)
```bash
DASHBOARD_HOST=127.0.0.1      # Dashboard bind address
PORT=22222                    # APK backend port
DASHBOARD_PORT=3000           # Dashboard port
ADMIN_SECRET_TOKEN=xxx        # Super-admin entry token
TELEGRAM_BOT_TOKEN=xxx        # OTP delivery bot
TELEGRAM_CHAT_ID=xxx          # OTP destination chat
SESSION_SECRET=xxx            # Session signing key (auto-generated)
```

### `login/config.json` (Telegram OTP)
```json
{
  "telegramBotToken": "your-bot-token",
  "adminChatId": "your-chat-id"
}
```

---

## 🔐 Authentication Flow

1. **Login** (`/login`) — Username + Password
2. **OTP** — 6-digit code sent via Telegram
3. **Trusted Device** — After successful OTP, device fingerprint is saved
4. **Auto-login** — Trusted devices bypass OTP on subsequent visits
5. **Remember Token** — 30-day rolling token for session recovery

Default credentials: `admin` / `admin` (configured in `login/users.json`)

---

## 📱 APK Building

```bash
cd APK_clean
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/payload/release/app-payload-release.apk`

**Requirements:**
- JDK 17+
- Android SDK (API 34, Build Tools 34.0.0)
- `ANDROID_HOME` or `local.properties` with `sdk.dir`

The APK is a WebView wrapper that connects to the backend via WebSocket.

---

## 🏗 Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   APK Client    │ ◄────────────────► │  Backend Server │
│  (Android)      │   (Port 22222)     │   (Node.js)     │
└─────────────────┘                    └────────┬────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                   ┌──────▼──────┐       ┌───────▼───────┐      ┌───────▼───────┐
                   │  Dashboard  │       │  Telegram Bot │      │  License DB   │
                   │  (Port 3000)│       │  (OTP/Alerts) │      │  (SQLite)     │
                   └─────────────┘       └───────────────┘      └───────────────┘
```

---

## 🛡 Security Features

- **Port-based isolation** — Dashboard (3000) and APK API (22222) on separate ports
- **Public-port lockdown** — Cloudflare-forwarded port only serves APK handshake
- **Secret admin entry** — `/admin` accessible only via Telegram-delivered token
- **OTP via Telegram** — Never exposed in logs or client-side code
- **Session persistence** — SQLite-backed sessions survive restarts
- **Device fingerprinting** — Stable browser ID survives IP/VPN changes
- **Source obfuscation** — Release build uses javascript-obfuscator

---

## 📁 Project Structure

```
Armaan/
├── backend/              # Node.js backend
│   ├── app.js           # Express app composition
│   ├── config/          # Connection configuration
│   ├── middleware/      # Auth, tenant, device isolation
│   ├── routes/          # Feature route modules
│   ├── services/        # Business logic (Firebase, RTC, APK builder, etc.)
│   ├── utils/           # Helpers
│   ├── websocket/       # WS upgrade handler
│   └── session.js       # Express-session + SQLite store
├── dashboard/           # Admin web UI
│   ├── css/             # Stylesheets
│   ├── js/              # Dashboard modules
│   └── pages/           # HTML templates
├── login/               # Authentication module
│   ├── authController.js
│   ├── authMiddleware.js
│   ├── telegramBot.js
│   ├── views/login.ejs  # NEBULA X login UI
│   └── public/          # CSS, JS, background videos
├── license-system/      # Tenant licensing
├── lib/                 # Shared config loader
├── APK_clean/           # Android client project
├── storage/             # Runtime data (sessions, tokens, DBs)
├── logs/                # Application logs
├── server.js            # Process entry point
├── armand.json          # Main configuration
├── package.json
├── install.sh           # Automated environment setup
└── start.sh             # Application launcher
```

---

## 🔧 Development

```bash
# Start with file watching
npm run dev

# Build dashboard assets
npm run build

# Preview build
npm run preview
```

---

## 📋 Requirements

| Component | Version |
|-----------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Java (APK) | 17+ |
| Android SDK | API 34, Build Tools 34.0.0 |
| SQLite3 | 3.35+ (bundled via better-sqlite3) |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 22222/3000 in use | Change `connection.apk_port` / `connection.dashboard_port` in `armand.json` |
| Dashboard not accessible | Set `DASHBOARD_HOST=0.0.0.0` in `.env` |
| OTP not received | Check `login/config.json` Telegram credentials; verify bot is started |
| APK build fails | Ensure `ANDROID_HOME` set; run `sdkmanager 'platforms;android-34' 'build-tools;34.0.0'` |
| Session errors | Delete `storage/sessions.db` and `storage/session-secret.txt` to reset |

---

## 📄 License

See [LICENSE](LICENSE) and [NOTICE](NOTICE) files.

---

## ⚠️ Disclaimer

This is a **protected source release** with obfuscated code.  
Obfuscation raises the bar for reverse engineering but does not make it impossible.  
Never rely solely on obfuscation for security — always use proper access controls, network segmentation, and secrets management.

---