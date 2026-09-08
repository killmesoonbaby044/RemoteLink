@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "query=%~1"
set count=0
set "results="

if "%query%"=="" (
    echo SEARCH_RESULTS:
    exit /b
)

set "query=%query:'=''%"

for /f "usebackq tokens=1,2 delims=|" %%a in (`powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-ADUser -Filter \"Name -like '*%query%*' -or SamAccountName -like '*%query%*'\" -Properties Name -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 16 | ForEach-Object { $_.SamAccountName + '|' + $_.Name }" 2^>nul`) do (
    set "sam=%%a"
    set "full=%%b"

    if defined results (
        set "results=!results!|!full![!sam!]"
    ) else (
        set "results=!full![!sam!]"
    )
)

echo SEARCH_RESULTS: !results!

endlocal