<#
    Returns up to 16 users matching $Query (by Name or SamAccountName), as a
    JSON array of {SamAccountName, Name} on stdout. Replaces the old .cmd
    version that shelled out to powershell from cmd and hand-built a
    "Full Name[sam]|Full Name[sam]" string.
#>
param(
    [string]$Query
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Query)) {
    "[]"
    return
}

Import-Module ActiveDirectory

# Escape single quotes so a query like "o'brien" can't break the -Filter string.
$q = $Query -replace "'", "''"

$users = Get-ADUser -Filter "Name -like '*$q*' -or SamAccountName -like '*$q*'" `
            -Properties Name -ErrorAction SilentlyContinue |
    Sort-Object Name |
    Select-Object -First 16 -Property SamAccountName, Name

# @() forces a JSON array even when there are 0 or 1 matches.
@($users) | ConvertTo-Json -Compress
