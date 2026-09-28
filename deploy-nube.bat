@echo off
setlocal
cd /d "%~dp0"
title Deploy nube - Viaja en el Rojo
set "NOPAUSE=%~1"
echo.
echo ========================================
echo  Viaja en el Rojo (taxi)  -  deploy
echo  Solo CODIGO  (sin sync de datos)
echo  Rama de deploy: prod
echo ========================================
echo.

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if /i not "%BRANCH%"=="prod" (
  echo Estas en rama "%BRANCH%", se necesita "prod".
  choice /C SN /M "Hacer checkout a prod y continuar"
  if errorlevel 2 goto :end
  git checkout prod
  if errorlevel 1 (
    echo ERROR: no se pudo cambiar a prod.
    goto :fail
  )
)

echo Desplegando desde rama prod...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-nube.ps1"
if errorlevel 1 goto :fail

echo.
echo OK - Viaja en el Rojo en la nube.
goto :end

:fail
echo.
echo FALLO el deploy.
if /i not "%NOPAUSE%"=="/nopause" pause
exit /b 1

:end
if /i not "%NOPAUSE%"=="/nopause" (
  echo.
  pause
)
endlocal
exit /b 0
