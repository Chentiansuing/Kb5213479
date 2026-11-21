@echo off
chcp 65001 >nul
cd /d "%~dp0"
set W11SIM_NO_BROWSER=1
echo 正在启动本地服务器（样式、语言包与 Temp 文件接口需要 http 环境）...
start "" /min python serve.py
timeout /t 2 >nul
start "" msedge --app=http://127.0.0.1:8765/index.html
exit
