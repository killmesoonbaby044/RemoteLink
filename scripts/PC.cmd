@echo off
setlocal enabledelayedexpansion

:search
set "query="
set /p "query=Enter computer name to search (or Q to quit): "
if /i "%query%"=="Q" goto :eof

set count=0
for /f "tokens=2 delims==," %%a in ('dsquery computer -name "*%query%*" 2^>nul') do (
    set /a count+=1
    set "pc!count!=%%a"
)

if %count%==0 (
    echo No computers found matching "%query%".
    goto search
)

echo.
echo Found %count% result^(s^):
for /l %%i in (1,1,%count%) do echo %%i. !pc%%i!
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

set "PC=!pc%choice%!"
echo.
echo PC set to: %PC%
echo.

:cmdlist
echo.
echo.
echo.
set cmdcount=0
for /f "delims=" %%f in ('dir /b /a-d "C:\COMMANDS\pc" 2^>nul') do (
    set /a cmdcount+=1
    set "cmd!cmdcount!=%%f"
)

if %cmdcount%==0 (
    echo No files found in C:\COMMANDS\pc.
    goto :eof
)

echo Available commands:
for /l %%i in (1,1,%cmdcount%) do echo %%i. !cmd%%i!
echo.

:choosecmd
set "cchoice="
set /p "cchoice=Enter number to run, or Q to quit: "

if /i "%cchoice%"=="Q" goto :eof

echo %cchoice%| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 (
    echo Invalid input.
    goto choosecmd
)
if %cchoice% gtr %cmdcount% (
    echo Number out of range.
    goto choosecmd
)

set "SELECTEDCMD=!cmd%cchoice%!"
echo.
echo Running: "C:\apps\RemoteLink\scripts\pc\%SELECTEDCMD%" %PC%
call "C:\apps\RemoteLink\scripts\pc\%SELECTEDCMD%" %PC%

goto :cmdlist
