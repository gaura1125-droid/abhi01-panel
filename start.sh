#!/usr/bin/env bash
# =============================================================================
# Armaan — Application Launcher
# =============================================================================
# Starts the Armaan backend server with proper environment validation.
#
# Usage: chmod +x start.sh && ./start.sh
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

log()    { printf "${BLUE}[INFO]${NC} %s\n" "$*"; }
ok()     { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()   { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()    { printf "${RED}[ERROR]${NC} %s\n" "$*"; }
step()   { printf "\n${BOLD}${CYAN}==>${NC} ${BOLD}%s${NC}\n" "$*"; }

# ---- Project root detection -------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"

# ---- Configuration files ----------------------------------------------------
ENV_FILE="${PROJECT_ROOT}/.env"
ARMAND_JSON="${PROJECT_ROOT}/armand.json"
PACKAGE_JSON="${PROJECT_ROOT}/package.json"
SERVER_JS="${PROJECT_ROOT}/server.js"

# ---- Pre-flight checks ------------------------------------------------------
check_node() {
    step "Checking Node.js runtime"
    if ! command -v node >/dev/null 2>&1; then
        err "Node.js not found. Run ./install.sh first."
        return 1
    fi
    NODE_VERSION="$(node --version | sed 's/^v//')"
    NODE_MAJOR="${NODE_VERSION%%.*}"
    if [[ "${NODE_MAJOR}" -lt 18 ]]; then
        err "Node.js ${NODE_VERSION} is below required 18+"
        return 1
    fi
    ok "Node.js ${NODE_VERSION}"

    if ! command -v npm >/dev/null 2>&1; then
        err "npm not found"
        return 1
    fi
    ok "npm $(npm --version)"
}

check_project() {
    step "Validating project files"
    [[ -f "${PACKAGE_JSON}" ]] || { err "Missing package.json"; return 1; }
    [[ -f "${ARMAND_JSON}" ]] || { err "Missing armand.json"; return 1; }
    [[ -f "${SERVER_JS}" ]] || { err "Missing server.js"; return 1; }
    [[ -d "${PROJECT_ROOT}/backend" ]] || { err "Missing backend/"; return 1; }
    [[ -d "${PROJECT_ROOT}/login" ]] || { err "Missing login/"; return 1; }
    [[ -d "${PROJECT_ROOT}/dashboard" ]] || { err "Missing dashboard/"; return 1; }
    ok "Project structure OK"
}

check_env() {
    step "Checking environment configuration"
    if [[ -f "${ENV_FILE}" ]]; then
        # shellcheck source=/dev/null
        source "${ENV_FILE}"
        ok "Loaded ${ENV_FILE}"
    else
        warn "No .env file found (using defaults)"
    fi

    # Validate required directories
    mkdir -p "${PROJECT_ROOT}/storage"
    mkdir -p "${PROJECT_ROOT}/logs"
    mkdir -p "${PROJECT_ROOT}/factory/apk_builder/temp"
    mkdir -p "${PROJECT_ROOT}/factory/apk_builder/builds"
    ok "Runtime directories ready"
}

check_dependencies() {
    step "Verifying dependencies"
    if [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
        warn "node_modules not found — installing dependencies"
        cd "${PROJECT_ROOT}"
        if [[ -f "${PROJECT_ROOT}/package-lock.json" ]]; then
            npm ci --prefer-offline --no-audit --no-fund 2>&1 | tail -10
        else
            npm install --no-audit --no-fund 2>&1 | tail -10
        fi
        if [[ $? -ne 0 ]]; then
            err "Dependency installation failed"
            return 1
        fi
    fi
    ok "Dependencies available"
}

check_config() {
    step "Validating configuration"
    cd "${PROJECT_ROOT}"

    # Test config loading
    if ! node -e "require('./lib/config').loadConfig(); console.log('[Config] Valid')" 2>/dev/null; then
        err "Configuration validation failed (check armand.json)"
        return 1
    fi

    # Check session secret
    if [[ ! -f "${PROJECT_ROOT}/storage/session-secret.txt" ]]; then
        log "Generating session secret"
        node -e "const crypto=require('crypto');const fs=require('fs');fs.writeFileSync('${PROJECT_ROOT}/storage/session-secret.txt',crypto.randomBytes(64).toString('hex'),{mode:0o600});console.log('Generated')"
    fi

    ok "Configuration validated"
}

# ---- Start server -----------------------------------------------------------
start_server() {
    step "Starting Armaan backend"
    cd "${PROJECT_ROOT}"

    # Export environment for the server
    export NODE_ENV="${NODE_ENV:-production}"

    # Display startup banner
    echo
    printf "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${BOLD}${CYAN}║       Armaan Backend Server Starting                          ║${NC}\n"
    printf "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n"
    echo

    # Start the server (server.js handles both APK backend and dashboard)
    exec node server.js
}

# ---- Main -------------------------------------------------------------------
main() {
    printf "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${BOLD}${CYAN}║       Armaan — Application Launcher                           ║${NC}\n"
    printf "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n\n"

    check_node
    check_project
    check_env
    check_dependencies
    check_config
    start_server
}

main "$@"