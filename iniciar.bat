@echo off
echo Verificando porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Encerrando processo na porta 3000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)
echo Iniciando servidor Floria...
npm run dev
