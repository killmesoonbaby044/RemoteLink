@echo off
setlocal enabledelayedexpansion
:root
echo --------------------
echo 1.CHANGE PASSWORD 2.CREATE USER or Q to quit
echo .
set /p "enter=CHOOSE YOUR HERO: "
if /i "%enter%"=="1" (
    echo Running: "C:\apps\RemoteLink\scripts\users\password.cmd"
	call "C:\apps\RemoteLink\scripts\users\password.cmd"
	goto :root
)
if /i "%enter%"=="2" (
    echo Running: "C:\apps\RemoteLink\scripts\users\create_new.cmd"
	call "C:\apps\RemoteLink\scripts\users\create_new.cmd"
	goto :root
)
if /i "%enter%"=="Q" goto :eof

goto :root
