# Zips the project for upload to the live host (node_modules rebuilt on the host).
# Usage: powershell -File deploy\pack.ps1
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "deploy\abhi-live.zip"
if (Test-Path $out) { Remove-Item $out -Force }

$exclude = @('node_modules', 'logs', '_ref', 'deploy\abhi-live.zip')
$tmp = Join-Path $env:TEMP ("abhi-pack-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
robocopy $root $tmp /E /XD node_modules logs _ref /XF abhi-live.zip /NFL /NDL /NJH /NJS /NP | Out-Null
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $out -Force
Remove-Item $tmp -Recurse -Force
"packed: $out ($([math]::Round((Get-Item $out).Length/1MB,1)) MB)"
