@echo off

set "PC=%~1"
if "%PC%"=="" set /p "PC=Enter PC name: "

powershell.exe -NoExit -NoProfile -Command "Enter-PSSession -ComputerName '%PC%'"