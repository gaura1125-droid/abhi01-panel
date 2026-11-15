# Rebuild the APK pointed at the live host's public IP.
# Usage: powershell -File deploy\retarget-apk.ps1 -Ip 129.153.10.4
param(
  [Parameter(Mandatory = $true)][string]$Ip,
  [string]$EndpointPort = "22222"
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$apkroot = Join-Path $root "factory\apk_builder"
$decode = Join-Path $apkroot "temp\88b94257d88e"
$cfgPath = Join-Path $decode "assets\config.json"
$endpoint = "http://${Ip}:${EndpointPort}"

# 1. config
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.cloudflare_wss_url = $endpoint
$cfg.server_endpoint = $endpoint
$cfg.connection_mode = "tunnel"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 5), $enc)
"[cfg] endpoint -> $endpoint"

# 2. build
$outdir = Join-Path $apkroot ("builds\abhi_" + (Get-Date -Format yyyyMMdd_HHmmss))
New-Item -ItemType Directory -Force -Path $outdir | Out-Null
& java -jar (Join-Path $apkroot "tools\apktool.jar") b $decode -o (Join-Path $outdir "built.apk") 2>&1 |
  Select-Object -Last 2 | Write-Host
if (-not (Test-Path (Join-Path $outdir "built.apk"))) { throw "apktool build failed" }

# 3. sign
& java -jar (Join-Path $apkroot "tools\apksigner.jar") sign `
  --ks (Join-Path $apkroot "release.keystore") --ks-key-alias armaan `
  --ks-pass pass:armaan123 --key-pass pass:armaan123 `
  --out (Join-Path $outdir "signed.apk") (Join-Path $outdir "built.apk") 2>&1 | Out-Null
& java -jar (Join-Path $apkroot "tools\apksigner.jar") verify (Join-Path $outdir "signed.apk") 2>&1 | Out-Null

# 4. deliverable + download-server copy
$final = Join-Path $apkroot "builds\ABHI0.1_test.apk"
Copy-Item (Join-Path $outdir "signed.apk") $final -Force
"APK  -> $final ($((Get-Item $final).Length) bytes)"
"DL   -> http://${Ip}:3100/ABHI0.1_test.apk"
