# Deploy codigo Viaja en el Rojo (taxi) a OCI (sin sync de datos).
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-nube.ps1

param(
  [string]$SshKey = "A:\Descargas\ssh-key-2026-09-07.key",
  [string]$VmHost = "opc@163.192.146.143",
  [string]$RemoteDir = "~/taximetro",
  [string]$PublicHealthUrl = "https://taxi.163.192.146.143.sslip.io/api/health"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SshOpts = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes")
$tar = Join-Path $env:TEMP "taxi-deploy.tar"

Write-Host "== Deploy taxi / Viaja en el Rojo (codigo) ==" -ForegroundColor Cyan
Push-Location $Root
tar -cf $tar backend/src frontend/src docker-compose.cloud.yml Dockerfile Caddyfile
Pop-Location
scp @SshOpts $tar "${VmHost}:~/taxi-deploy.tar"

$remote = @"
set -e
cd $RemoteDir
tar -xf ~/taxi-deploy.tar
rm -f ~/taxi-deploy.tar
docker network inspect taximetro_default >/dev/null 2>&1 || docker network create taximetro_default
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
docker network connect taximetro_default productos-limpieza-caddy 2>/dev/null || true
for i in 1 2 3 4 5 6 7 8 9 10 12 15; do
  if docker exec taximetro-api wget -qO- http://127.0.0.1:8084/api/health 2>/dev/null | grep -q UP; then
    echo HEALTH_OK_CONTAINER
    exit 0
  fi
  sleep 5
done
echo HEALTH_TIMEOUT_CONTAINER
exit 1
"@
$remote = ($remote -replace "`r`n", "`n" -replace "`r", "`n")
$remote | ssh @SshOpts $VmHost "bash -s"
if ($LASTEXITCODE -ne 0) { throw "Health check en contenedor fallo" }

Write-Host "Comprobando $PublicHealthUrl ..." -ForegroundColor Cyan
for ($i = 1; $i -le 8; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $PublicHealthUrl -UseBasicParsing -TimeoutSec 15
    if ($r.Content -match "UP") {
      Write-Host "HEALTH_OK_PUBLIC" -ForegroundColor Green
      Write-Host "Listo." -ForegroundColor Green
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 5
  }
}
Write-Host "Aviso: contenedor OK pero no respondio la URL publica (Caddy/DNS)." -ForegroundColor Yellow
Write-Host "Listo (solo contenedor)." -ForegroundColor Green
