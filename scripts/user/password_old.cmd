@echo off
setlocal enabledelayedexpansion
title AD User Search
chcp 65001 >nul

REM group that is not allowed to have its password reset via this script
set "RestrictedGroup=Domain overlords"
REM password that will be set for the selected user (avoid using a single quote ' in it)
set /a "n=%RANDOM% %% 9000 + 1000"
set "NewPassword=Qwerty%n%"


:search
set "query="
set /p "query=Enter name or login to search (or Q to quit): "
if /i "%query%"=="Q" goto :eof
if "%query%"=="" goto search

set "query=%query:'=''%"

set count=0
for /f "usebackq tokens=1,2 delims=|" %%a in (`powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-ADUser -Filter \"Name -like '*%query%*' -or SamAccountName -like '*%query%*'\" -Properties Name -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { $_.SamAccountName + '|' + $_.Name }" 2^>nul`) do (
    set /a count+=1
    set "sam!count!=%%a"
    set "full!count!=%%b"
)
chcp 65001 >nul

if %count%==0 (
    echo No users found matching "%query%".
    goto search
)

echo.
echo Found %count% result^(s^):
for /l %%i in (1,1,%count%) do echo %%i. !full%%i! [!sam%%i!]
echo.

:choose
set "choice="
set /p "choice=Enter number to select, S to search again, or Q to quit: "
if /i "%choice%"=="Q" goto :eof
if /i "%choice%"=="S" goto search
echo %choice%| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 (
    echo Invalid input.
    goto choose
)
if %choice% gtr %count% (
    echo Number out of range.
    goto choose
)
set "TargetUser=!sam%choice%!"
echo.
echo TargetUser set to: %TargetUser%

set "InGroup=NO"
for /f "usebackq delims=" %%r in (`powershell -NoProfile -Command "if (Get-ADPrincipalGroupMembership -Identity '%TargetUser%' -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq '%RestrictedGroup%' }) { 'YES' } else { 'NO' }" 2^>nul`) do set "InGroup=%%r"
chcp 65001 >nul

if /i "%InGroup%"=="YES" (
    echo ERROR: %TargetUser% is a member of "%RestrictedGroup%". Password change aborted.
    goto choose
)

powershell -NoProfile -Command "try { $sec = ConvertTo-SecureString '%NewPassword%' -AsPlainText -Force; Set-ADAccountPassword -Identity '%TargetUser%' -Reset -NewPassword $sec -ErrorAction Stop; Set-ADUser -Identity '%TargetUser%' -ChangePasswordAtLogon $true -ErrorAction Stop; Write-Host 'Password changed successfully.' -ForegroundColor Green; exit 0 } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
chcp 65001 >nul

if errorlevel 1 (
    echo Failed to change password for %TargetUser%.
) else (
    echo %TargetUser% must change password at next logon.
)


echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
echo ✨ %NewPassword% ✨
echo 💖 %NewPassword% 💖
