# Armaan launcher — cloudflared quick tunnel + node server in one shot.
# Quick tunnels rotate on every run, so this script grabs the fresh URL and
# writes it into armand.json before booting the server (config is read once at boot).
param(
    [string]$DashboardPort = "3000",
    [string]$ApkPort = "22222"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$cfBin = Join-Path $root "node_modules\cloudflared\bin\cloudflared.exe"
if (!(Test-Path $cfBin)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $cfBin) | Out-Null
    Write-Host "[*] downloading cloudflared..."
    curl.exe -L --retry 3 -o $cfBin "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    if (!(Test-Path $cfBin)) { throw "cloudflared download failed" }
}

Write-Host "[*] stopping old processes..."
Get-Process cloudflared, node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*nodejs*" -or $_.ProcessName -eq "cloudflared" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[*] starting quick tunnel -> 127.0.0.1:$ApkPort"
$tunnelLog = Join-Path $root "logs\tunnel.log"
Start-Process -FilePath $cfBin -ArgumentList "tunnel","--url","http://127.0.0.1:$ApkPort","--no-autoupdate" `
    -RedirectStandardOutput $tunnelLog -RedirectStandardError "$tunnelLog.err" -WindowStyle Hidden

# cloudflared writes its INF banner (incl. the URL) to stderr
$tunnelErrLog = "$tunnelLog.err"
$url = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    foreach ($f in @($tunnelErrLog, $tunnelLog)) {
        if (Test-Path $f) {
            $hit = Select-String -Path $f -Pattern "https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($hit) { $url = ($hit.Matches[0].Value); break }
        }
    }
    if ($url) { break }
}
if (!$url) { throw "tunnel URL not found in $tunnelLog" }
Write-Host "[+] tunnel: $url"
# plain-text pointer so the URL is always findable without digging through logs
[System.IO.File]::WriteAllText((Join-Path $root "..\TUNNEL_URL.txt"), $url + "`r`n" + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $root "TUNNEL_URL.txt"), $url + "`r`n" + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + "`r`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[*] writing url into armand.json"
$cfgPath = Join-Path $root "armand.json"
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.connection.public_url = $url
$cfg.server.publicUrl = $url
$cfg.cloudflare.url = $url
$cfg.cloudflare.status = "running"
$cfg.cloudflare.updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
# no BOM — node JSON.parse chokes on a leading UTF-8 BOM
$json = $cfg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($cfgPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[*] starting server (dashboard :$DashboardPort | apk :$ApkPort)"
$env:NODE_ENV = "production"
node server.js
