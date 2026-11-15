@echo off
setlocal
set "HTML=%~dp0Windows11SetupSim.html"
set "PROFILE=%LOCALAPPDATA%\Windows11SetupSim"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
    start "" "%EDGE%" --app="file:///%HTML:\=/%" --user-data-dir="%PROFILE%" --window-size=1280,860 --no-first-run --no-default-browser-check
) else (
    start "" "%HTML%"
)
endlocal
