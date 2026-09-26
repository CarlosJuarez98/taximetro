# Backup H2 nube (volumen Docker) → ZIP local en _backups/.
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup-h2.ps1

param(
  [string]$SshKey = "A:\Descargas\ssh-key-2026-09-07.key",
  [string]$VmHost = "opc@163.192.146.143",
  [string]$RemoteDir = "~/taximetro",
  [string]$VolumeName = "taximetro-h2-data"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LocalBackups = Join-Path $Root "_backups"
New-Item -ItemType Directory -Force -Path $LocalBackups | Out-Null
$SshOpts = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteZip = "~/taximetro/_backups/h2-$stamp.tar.gz"

$remote = @"
set -e
mkdir -p ~/taximetro/_backups
docker run --rm -v ${VolumeName}:/data -v ~/taximetro/_backups:/out alpine \
  tar -czf /out/h2-$stamp.tar.gz -C /data .
ls -la ~/taximetro/_backups/h2-$stamp.tar.gz
"@
$remote = ($remote -replace "`r`n", "`n" -replace "`r", "`n")
$remote | ssh @SshOpts $VmHost "bash -s"
if ($LASTEXITCODE -ne 0) { throw "Backup H2 remoto fallo" }

$localFile = Join-Path $LocalBackups "h2-$stamp.tar.gz"
scp @SshOpts "${VmHost}:$remoteZip" $localFile
Write-Host "Backup en $localFile" -ForegroundColor Green
