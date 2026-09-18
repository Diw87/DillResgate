@echo off
setlocal
cd /d "%~dp0"
set "dill_ps=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "dill_ps=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%dill_ps%" (
  echo Windows PowerShell nao foi encontrado neste computador.
  pause
  exit /b 1
)
"%dill_ps%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0src\Start.ps1" -Mode View
if errorlevel 1 pause
endlocal
