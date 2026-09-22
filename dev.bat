@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  Taxi Huamantla - modo desarrollo
echo  API local (H2) + Angular
echo ========================================
echo.
echo  Este proyecto (puertos FIJOS):
echo    Front  http://127.0.0.1:4203/
echo    API    http://127.0.0.1:8084/
echo.
echo  Otros (si estan corriendo):
echo    Mesa Lista .... 4200 / 8080
echo    Control gastos  4201 / 8081
echo    Prod. limpieza  4202 / 8083
echo.

where mvn >nul 2>&1
if errorlevel 1 (
  echo Falta Maven ^(mvn^) en el PATH.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Falta Node/npm en el PATH.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Instalando dependencias de Angular...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo Fallo npm install.
    pause
    exit /b 1
  )
  popd
)

echo Liberando puertos 8084 / 4203 si hay Java/Node viejo...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; foreach($port in 8084,4203){ foreach($c in @(Get-NetTCPConnection -LocalPort $port -State Listen)){ $p=Get-Process -Id $c.OwningProcess -EA SilentlyContinue; if($p -and $p.ProcessName -match 'java|node'){ Write-Host ('  Cerrando ' + $p.ProcessName + ' PID ' + $p.Id); Stop-Process -Id $p.Id -Force } } }"

echo.
echo Arrancando API (Spring Boot :8084) en otra ventana...
start "taxi-api" cmd /k "cd /d ""%~dp0backend"" && mvn spring-boot:run"

echo Arrancando Angular (ng serve :4203) en otra ventana...
start "taxi-front" cmd /k "cd /d ""%~dp0frontend"" && npm start"

echo Esperando front en 4203 y abriendo navegador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:4203/'; for($i=1;$i -le 90;$i++){ try { $r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process $url; Write-Host '  Listo.'; exit 0 } } catch {}; Start-Sleep 2 }; Start-Process $url; Write-Host '  Se abrio el navegador (puede seguir compilando).'"

echo.
echo Edita frontend\src y guarda: el navegador se actualiza solo.
echo Cambios de Java: reinicia la ventana de la API.
echo.
pause
