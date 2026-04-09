@echo off
chcp 65001 >nul
echo ==============================================
echo  一键更新代码 + 启动项目 + 开启 ngrok 穿透
echo ==============================================

echo.
echo [1/4] 关闭旧的 Node / ngrok 进程...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo [2/4] 拉取最新代码...
git pull

echo.
echo [3/4] 启动 npm run dev (端口 3000)...
start /B npm run dev

echo 等待项目启动 5 秒...
timeout /t 5 /nobreak >nul

echo.
echo [4/4] 启动 ngrok http 3000...
ngrok http 3000

echo.
echo 全部启动完成！
pause