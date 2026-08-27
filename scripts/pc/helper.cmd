@echo off

:: Use the parameter passed from CMD 1 (%1), or prompt if empty
set "PC=%~1"
if "%PC%"=="" set /p "PC=Enter PC name: "

msra.exe /offerra %PC%

pause