@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务器（样式与语言包需要 http 环境）...
start "" /min python serve.py
timeout /t 2 >nul
start "" msedge --app=http://127.0.0.1:8765/index.html
exit
