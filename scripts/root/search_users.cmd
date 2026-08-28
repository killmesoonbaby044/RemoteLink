@echo off
setlocal EnableDelayedExpansion

set "query=%~1"
set count=0
set "results="

if "%query%"=="" (
    echo SEARCH_RESULTS:
    exit /b
)

set "query=%query:'=''%"

for /f "usebackq tokens=1,2 delims=|" %%a in (`powershell -NoProfile -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-ADUser -Filter \"Name -like '*%query%*' -or SamAccountName -like '*%query%*'\" -Properties Name -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { $_.SamAccountName + '|' + $_.Name }" 2^>nul`) do (
    set /a count+=1

    if !count! LEQ 16 (
        set "sam=%%a"
        set "full=%%b"

        if defined results (
            set "results=!results!|!sam![!full!]"
        ) else (
            set "results=!sam![!full!]"
        )
    ) else (
        goto results_done
    )
)

:results_done

echo SEARCH_RESULTS: !results!

endlocal
