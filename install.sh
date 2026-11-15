#!/usr/bin/env bash
# =============================================================================
# Armaan — Automated Environment Setup
# =============================================================================
# This script prepares the runtime environment for the Armaan backend.
# It detects the OS, installs Node.js dependencies, validates configuration,
# and creates necessary runtime directories.
#
# Usage: chmod +x install.sh && ./install.sh
# =============================================================================

set -euo pipefail

# ---- Colors & formatting ----------------------------------------------------
if [[ -t 1 ]]; then
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[1;33m'
    BLUE=$'\033[0;34m'
    CYAN=$'\033[0;36m'
    BOLD=$'\033[1m'
    NC=$'\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# ---- Logging helpers --------------------------------------------------------
log()    { printf "${BLUE}[INFO]${NC} %s\n" "$*"; }
ok()     { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()   { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()    { printf "${RED}[ERROR]${NC} %s\n" "$*"; }
step()   { printf "\n${BOLD}${CYAN}==>${NC} ${BOLD}%s${NC}\n" "$*"; }

# ---- Project root detection -------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"

# ---- Configuration ----------------------------------------------------------
REQUIRED_NODE_VERSION="18"
PACKAGE_LOCK="${PROJECT_ROOT}/package-lock.json"
PACKAGE_JSON="${PROJECT_ROOT}/package.json"
ARMAND_JSON="${PROJECT_ROOT}/armand.json"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"
STORAGE_DIR="${PROJECT_ROOT}/storage"
LOGS_DIR="${PROJECT_ROOT}/logs"

# ---- OS / Architecture detection --------------------------------------------
detect_os() {
    step "Detecting operating system"
    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        OS="${ID:-unknown}"
        OS_VERSION="${VERSION_ID:-unknown}"
        OS_PRETTY="${PRETTY_NAME:-$OS}"
    elif [[ "$(uname -s)" == "Darwin" ]]; then
        OS="macos"
        OS_VERSION="$(sw_vers -productVersion 2>/dev/null || echo 'unknown')"
        OS_PRETTY="macOS ${OS_VERSION}"
    elif [[ -n "${TERMUX_VERSION:-}" ]]; then
        OS="termux"
        OS_VERSION="${TERMUX_VERSION}"
        OS_PRETTY="Termux ${OS_VERSION}"
    else
        OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
        OS_VERSION="unknown"
        OS_PRETTY="${OS}"
    fi
    ARCH="$(uname -m)"
    log "OS: ${OS_PRETTY}"
    log "Architecture: ${ARCH}"
}

# ---- Node.js / npm detection ------------------------------------------------
check_node() {
    step "Checking Node.js and npm"
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION="$(node --version | sed 's/^v//')"
        NODE_MAJOR="${NODE_VERSION%%.*}"
        log "Found Node.js ${NODE_VERSION}"
        if [[ "${NODE_MAJOR}" -ge "${REQUIRED_NODE_VERSION}" ]]; then
            ok "Node.js version >= ${REQUIRED_NODE_VERSION} satisfied"
        else
            err "Node.js ${NODE_VERSION} is below required ${REQUIRED_NODE_VERSION}+"
            return 1
        fi
    else
        err "Node.js not found. Please install Node.js ${REQUIRED_NODE_VERSION}+"
        return 1
    fi

    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION="$(npm --version)"
        log "Found npm ${NPM_VERSION}"
        ok "npm available"
    else
        err "npm not found"
        return 1
    fi
}

# ---- Install Node.js on supported platforms ---------------------------------
install_node_if_needed() {
    if command -v node >/dev/null 2>&1; then
        return 0
    fi
    step "Attempting to install Node.js"
    case "${OS}" in
        ubuntu|debian|linuxmint|pop|elementary|zorin)
            log "Installing Node.js via apt (NodeSource)"
            curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora|rhel|centos|rocky|almalinux)
            log "Installing Node.js via dnf (NodeSource)"
            curl -fsSL https://rpm.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | sudo bash -
            sudo dnf install -y nodejs
            ;;
        arch|manjaro|endeavouros|garuda)
            log "Installing Node.js via pacman"
            sudo pacman -S --noconfirm nodejs npm
            ;;
        alpine)
            log "Installing Node.js via apk"
            sudo apk add --no-cache nodejs npm
            ;;
        termux)
            log "Installing Node.js via pkg"
            pkg install -y nodejs
            ;;
        macos)
            if command -v brew >/dev/null 2>&1; then
                log "Installing Node.js via Homebrew"
                brew install node@${REQUIRED_NODE_VERSION}
            else
                err "Homebrew not found. Please install Node.js manually from https://nodejs.org"
                return 1
            fi
            ;;
        *)
            warn "Automatic Node.js installation not supported on ${OS}"
            warn "Please install Node.js ${REQUIRED_NODE_VERSION}+ manually from https://nodejs.org"
            return 1
            ;;
    esac
    check_node
}

# ---- Validate project files -------------------------------------------------
validate_project() {
    step "Validating project structure"
    local missing=0

    [[ -f "${PACKAGE_JSON}" ]] || { err "Missing package.json"; missing=1; }
    [[ -f "${PACKAGE_LOCK}" ]] || { warn "package-lock.json not found (dependencies will be resolved from package.json)"; }
    [[ -f "${ARMAND_JSON}" ]] || { err "Missing armand.json (server configuration)"; missing=1; }
    [[ -f "${PROJECT_ROOT}/server.js" ]] || { err "Missing server.js"; missing=1; }
    [[ -d "${PROJECT_ROOT}/backend" ]] || { err "Missing backend/ directory"; missing=1; }
    [[ -d "${PROJECT_ROOT}/login" ]] || { err "Missing login/ directory"; missing=1; }
    [[ -d "${PROJECT_ROOT}/dashboard" ]] || { err "Missing dashboard/ directory"; missing=1; }

    if [[ ${missing} -eq 1 ]]; then
        err "Project validation failed. Ensure you are in the Armaan project root."
        return 1
    fi
    ok "Project structure validated"
}

# ---- Environment file setup -------------------------------------------------
setup_env() {
    step "Setting up environment configuration"
    if [[ -f "${ENV_FILE}" ]]; then
        log ".env already exists, preserving"
    elif [[ -f "${ENV_EXAMPLE}" ]]; then
        cp "${ENV_EXAMPLE}" "${ENV_FILE}"
        ok "Created .env from .env.example"
    else
        cat > "${ENV_FILE}" <<'EOF'
# Armaan Environment Configuration
# Generated by install.sh — edit as needed

# Server binding (default: loopback for security)
# DASHBOARD_HOST=127.0.0.1

# Optional: override ports from armand.json
# PORT=22222
# DASHBOARD_PORT=3000

# Admin secret token (optional, can also be set in armand.json / SQLite)
# ADMIN_SECRET_TOKEN=

# Telegram bot configuration (optional, also in login/config.json)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=

# Session secret (auto-generated if not set)
# SESSION_SECRET=

# Node environment
NODE_ENV=production
EOF
        ok "Created default .env"
    fi
}

# ---- Runtime directories ----------------------------------------------------
create_runtime_dirs() {
    step "Creating runtime directories"
    mkdir -p "${STORAGE_DIR}"
    mkdir -p "${LOGS_DIR}"
    mkdir -p "${PROJECT_ROOT}/factory/apk_builder/temp"
    mkdir -p "${PROJECT_ROOT}/factory/apk_builder/builds"
    ok "Runtime directories ready"
}

# ---- Node.js dependencies ---------------------------------------------------
install_dependencies() {
    step "Installing Node.js dependencies"
    cd "${PROJECT_ROOT}"

    # If node_modules exists and seems valid, skip reinstall
    if [[ -d "${PROJECT_ROOT}/node_modules" && -f "${PROJECT_ROOT}/node_modules/.package-lock.json" ]]; then
        log "Valid node_modules found, skipping reinstall (use 'npm ci' to force)"
        ok "Dependencies already installed"
        return 0
    fi

    if [[ -f "${PACKAGE_LOCK}" ]]; then
        log "Using package-lock.json for reproducible install"
        npm ci --prefer-offline --no-audit --no-fund 2>&1 | tail -20
    else
        log "No package-lock.json, using npm install"
        npm install --no-audit --no-fund 2>&1 | tail -20
    fi

    if [[ $? -eq 0 ]]; then
        ok "Dependencies installed"
    else
        err "npm install failed"
        return 1
    fi
}

# ---- Validate configuration -------------------------------------------------
validate_config() {
    step "Validating configuration"
    cd "${PROJECT_ROOT}"

    # Test that config loads without syntax errors
    if node -e "require('./lib/config').loadConfig(); console.log('[Config] armand.json is valid')" 2>&1; then
        ok "Configuration validated"
    else
        err "Configuration validation failed (check armand.json syntax)"
        return 1
    fi

    # Check for required files referenced in config
    local config
    config="$(cat "${ARMAND_JSON}")"

    # Validate login assets exist
    if [[ ! -f "${PROJECT_ROOT}/login/public/cyber.css" ]]; then
        warn "login/public/cyber.css not found — login UI may not render correctly"
    fi
    if [[ ! -f "${PROJECT_ROOT}/login/public/login-bg.mp4" ]]; then
        warn "login/public/login-bg.mp4 not found — login background video missing"
    fi
    if [[ ! -f "${PROJECT_ROOT}/login/public/otp-bg.mp4" ]]; then
        warn "login/public/otp-bg.mp4 not found — OTP background video missing"
    fi

    # Check session secret
    if [[ ! -f "${STORAGE_DIR}/session-secret.txt" ]]; then
        log "Generating session secret"
        node -e "const crypto=require('crypto');const fs=require('fs');fs.writeFileSync('${STORAGE_DIR}/session-secret.txt',crypto.randomBytes(64).toString('hex'),{mode:0o600});console.log('Generated')"
        ok "Session secret created"
    else
        log "Session secret already exists"
    fi

    # Check database
    if [[ ! -f "${STORAGE_DIR}/sessions.db" ]]; then
        log "Session database will be created on first run"
    fi
}

# ---- Android SDK setup ------------------------------------------------------
setup_android_sdk() {
    if [[ ! -d "${PROJECT_ROOT}/APK_clean" || ! -f "${PROJECT_ROOT}/APK_clean/gradlew" ]]; then
        return 0
    fi

    step "Checking Android SDK"

    # Check for local.properties
    local local_props="${PROJECT_ROOT}/APK_clean/local.properties"
    local sdk_dir=""
    if [[ -f "${local_props}" ]]; then
        sdk_dir="$(grep '^sdk.dir=' "${local_props}" | cut -d'=' -f2- | tr -d ' ')"
    fi

    # Common SDK locations
    local sdk_candidates=(
        "${sdk_dir}"
        "${ANDROID_HOME}"
        "${ANDROID_SDK_ROOT}"
        "/opt/android-sdk"
        "/usr/local/android-sdk"
        "${HOME}/Android/Sdk"
        "${HOME}/Library/Android/sdk"
    )

    local found_sdk=""
    for candidate in "${sdk_candidates[@]}"; do
        if [[ -n "${candidate}" && -d "${candidate}" && -f "${candidate}/platform-tools/adb" ]]; then
            found_sdk="${candidate}"
            break
        fi
    done

    if [[ -n "${found_sdk}" ]]; then
        export ANDROID_HOME="${found_sdk}"
        export ANDROID_SDK_ROOT="${found_sdk}"
        export PATH="${found_sdk}/platform-tools:${found_sdk}/tools:${found_sdk}/tools/bin:${PATH}"
        ok "Android SDK found at ${found_sdk}"

        # Verify required platform (android-34 for this project)
        if [[ -d "${found_sdk}/platforms/android-34" ]]; then
            ok "Android platform 34 (API 34) available"
        else
            warn "Android platform 34 not found — APK build may fail"
            warn "Run: sdkmanager 'platforms;android-34' 'build-tools;34.0.0'"
        fi
    else
        warn "Android SDK not found — APK builds will not work"
        warn "Install Android SDK and set ANDROID_HOME, or create APK_clean/local.properties with sdk.dir"
    fi

    # Check Gradle wrapper
    if [[ -x "${PROJECT_ROOT}/APK_clean/gradlew" ]]; then
        ok "Gradle wrapper present and executable"
    else
        warn "Gradle wrapper not executable — run: chmod +x APK_clean/gradlew"
    fi
}

# ---- APK build check (optional) --------------------------------------------
check_apk_build() {
    if [[ -d "${PROJECT_ROOT}/APK_clean" && -f "${PROJECT_ROOT}/APK_clean/gradlew" ]]; then
        step "APK project detected"
        log "APK_clean/ found — Gradle wrapper present"
        if command -v java >/dev/null 2>&1; then
            JAVA_VER="$(java -version 2>&1 | head -1)"
            log "Java available: ${JAVA_VER}"
        else
            warn "Java not found — APK builds will not work (install JDK 17+)"
        fi
    fi
}

# ---- Summary -----------------------------------------------------------------
print_summary() {
    step "Installation complete"
    echo
    printf "  Project root: ${BOLD}%s${NC}\n" "${PROJECT_ROOT}"
    printf "  Node.js:      ${BOLD}%s${NC}\n" "$(node --version)"
    printf "  npm:          ${BOLD}%s${NC}\n" "$(npm --version)"
    printf "  Config:       ${BOLD}%s${NC}\n" "${ARMAND_JSON}"
    printf "  Env file:     ${BOLD}%s${NC}\n" "${ENV_FILE}"
    echo
    printf "  Next steps:\n"
    printf "    ${CYAN}./start.sh${NC}        # Start the Armaan backend\n"
    printf "    ${CYAN}npm run dev${NC}       # Start with file watching (development)\n"
    echo
    printf "  Dashboard will be available at: ${BOLD}http://127.0.0.1:3000${NC}\n"
    printf "  APK backend will be available at: ${BOLD}http://127.0.0.1:22222${NC}\n"
    echo
}

# ---- Main -------------------------------------------------------------------
main() {
    printf "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${BOLD}${CYAN}║       Armaan — Automated Environment Setup                  ║${NC}\n"
    printf "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n\n"

    detect_os
    install_node_if_needed
    check_node
    validate_project
    setup_env
    create_runtime_dirs
    install_dependencies
    validate_config
    setup_android_sdk
    check_apk_build
    print_summary
}

main "$@"