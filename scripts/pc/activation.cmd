@echo off

:: Use the parameter passed from CMD 1 (%1), or prompt if empty
set "PC=%~1"
if "%PC%"=="" set /p "PC=Enter PC name: "

if "%PC%"=="" (
    echo No PC name entered.
    pause
    exit /b 1
)

echo 1. office
echo 2. windows
set /p "CHOICE=Choose option (1 or 2): "

if "%CHOICE%"=="1" set "FILENAME=office.cmd"
if "%CHOICE%"=="2" set "FILENAME=windows.cmd"

if not defined FILENAME (
    echo [ERROR] Invalid choice: %CHOICE%
    pause
    exit /b 1
)

set "SRC=C:\Scripts\%FILENAME%"
set "DEST=\\%PC%\C$\Shortcuts"
set "LOCALDEST=C:\Shortcuts"

if not exist "%DEST%" mkdir "%DEST%"
if errorlevel 1 (
    echo [ERROR] Could not create %DEST%. Check admin-share access to %PC%.
    pause
    exit /b 1
)

copy /Y "%SRC%" "%DEST%\%FILENAME%"
if errorlevel 1 (
    echo [ERROR] Failed copying "%SRC%" to "%DEST%"
    pause
    exit /b 1
)

psexec \\%PC% -accepteula -h cmd /c "%LOCALDEST%\%FILENAME%"
if errorlevel 1 (
    echo [ERROR] %FILENAME% returned an error on %PC%.
    pause
    exit /b 1
)

del /f /q "%DEST%\%FILENAME%"
if errorlevel 1 (
    echo [WARN] Installed OK, but could not delete "%DEST%\%FILENAME%"
) else (
    echo Done. Installed on %PC% and cleaned up.
)
pause
endlocal
exit /b 0