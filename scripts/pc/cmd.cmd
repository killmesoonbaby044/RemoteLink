@echo off
chcp 65001 >nul

set "PC=%~1"
if "%PC%"=="" set /p "PC=Enter PC name: "

psexec \\%PC% cmd.exe /c "chcp 65001 >nul & cmd.exe"