#!/bin/bash
# Bootloader unlock readiness checker (READ-ONLY)
# Uses rish (Shizuku shell). It does NOT unlock, flash, wipe or modify anything.

RISH="${RISH:-/root/rish}"
run() { "$RISH" -c "$1" 2>/dev/null; }

line() { printf '%s\n' "------------------------------------------------------------"; }

echo "============================================================"
echo " SAMSUNG BOOTLOADER UNLOCK — READINESS CHECK (READ-ONLY)"
echo "============================================================"
line

# One shell round-trip with explicit markers.
# (Separate calls through rish can interleave; markers keep values aligned.)
raw=$("$RISH" -c '
echo "M=$(getprop ro.product.model)"
echo "A=$(getprop ro.build.version.release)"
echo "B=$(getprop ro.boot.bootloader)"
echo "L=$(getprop ro.boot.flash.locked)"
echo "V=$(getprop ro.boot.vbmeta.device_state)"
echo "G=$(getprop ro.boot.verifiedbootstate)"
echo "W=$(getprop ro.boot.warranty_bit)"
echo "U=$(getprop ro.boot.ulcnt)"
echo "O=$(getprop sys.oem_unlock_allowed)"
echo "R=$(getprop ro.boot.bootreason)"
echo "BATT=$(dumpsys battery | awk "/level:/{print \$2; exit}")"
echo "KG=$(dumpsys knoxguard_service | grep vaultState | tail -1)"
echo "ACCT=$(dumpsys account | grep -c com.osp.app.signin)"
echo "NET=$(ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 && echo yes || echo no)"
' 2>/dev/null)
v() { printf '%s\n' "$raw" | sed -n "s/^$1=//p" | head -1; }
model=$(v M)
android=$(v A)
bl=$(v B)
locked=$(v L)
vbstate=$(v V)
vbmode=$(v G)
warranty=$(v W)
ulcnt=$(v U)
oem=$(v O)
bootreason=$(v R)

batt=$(v BATT)
kgline=$(v KG)
kg=$(printf '%s' "$kgline" | sed -n 's/.*vaultState *: *//p' | tr -d '[:space:]')
[ -z "$kg" ] && kg="unknown"
acct=$(v ACCT)
net=$(v NET)

echo "Model              : $model"
echo "Android            : $android"
echo "Bootloader         : $bl"
echo "Boot reason        : $bootreason"
echo "Battery            : ${batt:-unknown}%"
echo "Internet           : $net"
echo "Samsung account    : $([ "$acct" -gt 0 ] && echo yes || echo 'not detected')"
line
echo " ro.boot.flash.locked          : $locked"
echo " ro.boot.vbmeta.device_state   : $vbstate"
echo " ro.boot.verifiedbootstate     : $vbmode"
echo " ro.boot.warranty_bit          : $warranty"
echo " ro.boot.ulcnt                 : $ulcnt"
echo " sys.oem_unlock_allowed        : $oem"
echo " KnoxGuard vaultState          : $kg"
line

ready=1
[ "$locked" = "1" ] || { echo "[!] Bootloader already unlocked (flash.locked != 1)."; ready=0; }
[ "$oem" = "1" ] || { echo "[!] OEM unlocking not allowed (sys.oem_unlock_allowed != 1)."; ready=0; }
case "$kg" in
  Prenormal|PRENORMAL) echo "[!] KG STATE = Prenormal: unlock is blocked until it clears."; ready=0 ;;
  Checking|CHECKING)   echo "[~] KG STATE = Checking: server check pending; keep WiFi + Samsung account and retry." ;;
  unknown)             echo "[~] KG STATE could not be read from Android; check it in Download Mode." ;;
esac
[ "${batt:-0}" -ge 50 ] 2>/dev/null || echo "[!] Battery below 50% — charge before starting."
[ "$net" = "yes" ] || echo "[!] No internet — KG/Samsung account check may fail."

if [ "$ready" = "1" ]; then
  echo "[OK] Basic Android-side checks passed. Final check is in Download Mode."
else
  echo "[..] Fix the items marked [!] before unlocking."
fi
line

cat <<'EOF'
OFFICIAL UNLOCK FLOW (physical keys required):
 1. Full backup — unlock wipes internal storage and data.
 2. Developer Options -> OEM unlocking = ON.
 3. Power the phone fully OFF.
 4. Hold Volume Up + Volume Down together.
 5. Connect a USB-C DATA cable to a PC (direct port, no hub).
 6. Warning screen: Volume Up = continue, Volume Down = cancel.
 7. On the Download screen: long-press Volume Up 5-7 seconds.
 8. "Device unlock mode" warning -> Volume Up to confirm.
 9. Phone wipes and reboots. First boot may take 5-10 minutes.

CHECK ON THE DOWNLOAD MODE SCREEN:
  OEM LOCK: OFF (U)   -> unlock allowed
  OEM LOCK: ON        -> OEM toggle off / not applied
  KG STATE: Prenormal -> blocked; wait for server check (up to 7 days)
  KG STATE: Checking  -> check pending; WiFi + Samsung account needed
  FRP LOCK: ON        -> normal when a signed-in account exists

DO NOT:
 - flash patched/custom images while the bootloader is locked
 - flash firmware older than binary S5
 - use "one-click unlock" APKs/tools — they cannot unlock a Samsung bootloader
EOF
