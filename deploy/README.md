# ABHI0.1 — 24/7 LIVE deploy (laptop band, phir bhi chalta rahe)

Target: panel + backend + APK download + device WS, sab ek free always-on host pe,
permanent URL, no laptop, no domain.

## Step 1 — free host banao (10 min, one time)

**Oracle Cloud Always Free** (recommended — 4 ARM CPU / 24 GB RAM, free forever, static public IP):

1. https://www.oracle.com/cloud/free/ → sign up (card lagta hai, koi charge nahi).
2. Create a VM: **Create a VM instance** → Image **Ubuntu 22.04 / 24.04**,
   Shape **VM.Standard.A1.Flex** (Always Free eligible), 1 OCPU / 6 GB RAM enough.
3. SSH key: portal se download karo (`Download private key`), note karo **public IP**.
4. Security list me ports open karo: **22, 3000, 22222, 3100** (TCP).

Koi bhi free/cheap Ubuntu VPS chalega — Vultr, DigitalOcean, Hetzner, Contabo.
Sirf Ubuntu 22.04+ chahiye.

## Step 2 — code upload karo (laptop se, ek baar)

```powershell
cd D:\abcd\eran\Armaan_Release
powershell -File deploy\pack.ps1        # -> deploy\abhi-live.zip (~40 MB)
scp -i <key.pem> deploy\abhi-live.zip ubuntu@<PUBLIC_IP>:~/
```

## Step 3 — one-shot install (VM pe)

```bash
unzip abhi-live.zip -d abhi && cd abhi
sudo bash deploy/install.sh <PUBLIC_IP>
```

install.sh kya karta hai:
- Node 22 LTS + build tools
- `npm ci --omit=dev`
- `armand.json` ko public IP pe retarget (`deploy/configure.js`)
- systemd services **abhi** (panel+backend) aur **abhi-apk** (download server), `Restart=always`
- ufw me 22/3000/22222/3100 open

Result:
```
PANEL  -> http://<PUBLIC_IP>:3000        (olivia / olivia@Bench2026)
APK    -> http://<PUBLIC_IP>:3100/ABHI0.1_test.apk
APK/WS -> http://<PUBLIC_IP>:22222
```

Reboot ke baad bhi khud start hote hain (`systemctl enable` already done).

## Step 4 — APK ko permanent endpoint pe daalo

IP milte hi laptop se ek command:

```powershell
powershell -File deploy\retarget-apk.ps1 -Ip <PUBLIC_IP>
```

ye `assets/config.json` ka `server_endpoint` / `cloudflare_wss_url` ko
`http://<IP>:22222` karke APK rebuild + sign karta hai
(manifest me `usesCleartextTraffic=true` already hai — http chalega).

Phir phone pe naya APK install: `http://<IP>:3100/ABHI0.1_test.apk`
— kabhi URL change nahi hoga, kabhi rebuild nahi karna, laptop band rahega.

## HD + smooth ke defaults (already applied)

- Stream bitrate default: **30 → 100 (Max · 10 Mbps)** — `dashboard/js/screen.js`
- **Start** button ab format dropdown se directly stream karta hai (default **H.264**),
  menu ke peeche nahi — `views/index.ejs`
- Resolution selector **720p HD (Max)** selected, quality menu me "device-native" note
- H.264 = WebCodecs binary path (low latency); WebP = polling snapshots (blurry, 1.5 FPS)

## Ops

```bash
sudo systemctl status abhi abhi-apk
tail -f /var/log/abhi.log
sudo systemctl restart abhi          # views/ejs badalne ke baad
```

APK update: naya build `factory/apk_builder/builds/ABHI0.1_test.apk` rakh do,
`sudo systemctl restart abhi-apk` — download link same rahega.

## Backup plan (agar VM na mile)

- Quick tunnel + laptop: abhi wala setup, URL rotation ke saath (rebuild chahiye).
- Telegram-lookup scheme: APK Telegram se naya URL padhta hai — rotation-proof,
  laptop on rehna chahiye. Bolo toh build kar dunga.
