@echo off
setlocal EnableDelayedExpansion

set "query=%~1"
set count=0
set "results="

if "%query%"=="" (
    echo SEARCH_RESULTS:
    exit /b
)

for /f "tokens=2 delims==," %%a in ('
    dsquery computer -name "*%query%*" 2^>nul
') do (
    set /a count+=1

    if !count! LEQ 16 (
        set "pc=%%a"

        if defined results (
            set "results=!results!|!pc!"
        ) else (
            set "results=!pc!"
        )
    ) else (
        goto results_done
    )
)

:results_done

echo SEARCH_RESULTS: !results!

endlocal