@echo off
setlocal enabledelayedexpansion
title AD User Search
chcp 65001 >nul

set "TargetUser=%~1"
if "%TargetUser%"=="" set /p "TargetUser=Enter username: "

REM group that is not allowed to have its password reset via this script
set "RestrictedGroup=Domain overlords"
REM password that will be set for the selected user (avoid using a single quote ' in it)
set /a "n=%RANDOM% %% 9000 + 1000"
set "NewPassword=Qwerty%n%"


set "InGroup=NO"
for /f "usebackq delims=" %%r in (`powershell -NoProfile -Command "if (Get-ADPrincipalGroupMembership -Identity '%TargetUser%' -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq '%RestrictedGroup%' }) { 'YES' } else { 'NO' }" 2^>nul`) do set "InGroup=%%r"
chcp 65001 >nul

if /i "%InGroup%"=="YES" (
    echo ERROR: %TargetUser% is a member of "%RestrictedGroup%". Password change aborted.
)

powershell -NoProfile -Command "try { $sec = ConvertTo-SecureString '%NewPassword%' -AsPlainText -Force; Set-ADAccountPassword -Identity '%TargetUser%' -Reset -NewPassword $sec -ErrorAction Stop; Set-ADUser -Identity '%TargetUser%' -ChangePasswordAtLogon $true -ErrorAction Stop; Write-Host 'Password changed successfully.' -ForegroundColor Green; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
chcp 65001 >nul

if errorlevel 1 (
    echo Failed to change password for %TargetUser%.
    pause
    exit /b 1
) else (
    echo %TargetUser% must change password at next logon.
)


echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
