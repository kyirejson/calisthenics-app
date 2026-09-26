@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   正在启动 Uncover 街健 App Web 网页端服务...
echo   服务地址: http://localhost:8081
echo ========================================================
start "" http://localhost:8081
call npx expo start --web --port 8081
pause
