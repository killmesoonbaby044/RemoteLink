<#
    Returns up to 16 computer names matching $Query, as a JSON array on stdout.
    Replaces the old dsquery-based .cmd version. No output other than the
    final JSON - errors are swallowed (SilentlyContinue) so a bad/empty
    query just yields "[]" rather than a stack trace on stdout.
#>
param(
    [string]$Query
)

chcp 65001 >nul
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Query)) {
    "[]"
    return
}

Import-Module ActiveDirectory

# Escape single quotes so a query like "o'brien" can't break the -Filter string.
$q = $Query -replace "'", "''"

$names = Get-ADComputer -Filter "Name -like '*$q*'" -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -First 16 -ExpandProperty Name

# @() forces a JSON array even when there are 0 or 1 matches.
@($names) | ConvertTo-Json -Compress
