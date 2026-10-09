@echo off
chcp 65001 >nul
echo ========================================================
echo   全運具快遞媒合平台 - 推送至 GitHub 雲端倉庫
echo ========================================================
echo.
cd /d "%~dp0"
set PATH=C:\Users\MyUser\.gemini\antigravity\bin\git\cmd;C:\Users\MyUser\.gemini\antigravity\bin\git\ucrt64\bin;%PATH%

echo 正在推送至 https://github.com/rbs0928/courier-platform.git ...
echo 若瀏覽器彈出 GitHub 授權視窗，請點選「Authorize」授權登入。
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [成功] 專案代碼已順利同步至 GitHub 倉庫！
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo   [提示] 推送遇到驗證問題。
    echo   若您有 Personal Access Token (PAT)，亦可直接使用 Token 登入。
    echo ========================================================
)

echo.
pause
