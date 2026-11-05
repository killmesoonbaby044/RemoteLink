<#
    Returns every user under a given OU, including all sub-OUs (through the
    bottom), as a JSON array of {full_name, username}.

    Usage:
        .\search_users_by_ou_recursive.ps1 -OU "OU=Sales,DC=contoso,DC=com"
#>

param(
    [string]$OU
)

# Force UTF-8 for output, including output passed through the PowerShell pipeline.
$utf8 = [System.Text.UTF8Encoding]::new($false)

[Console]::InputEncoding  = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OU)) {
    "[]"
    return
}

Import-Module ActiveDirectory

try {
    $users = Get-ADUser `
        -SearchBase $OU `
        -SearchScope Subtree `
        -Filter * `
        -Properties Name `
        -ErrorAction Stop |
        Sort-Object Name |
        Select-Object @{Name = "full_name"; Expression = { $_.Name }},
                      @{Name = "username";  Expression = { $_.SamAccountName }}
} catch {
    [Console]::Error.WriteLine("Failed to query OU '$OU': $($_.Exception.Message)")
    "[]"
    return
}

# @() forces a JSON array even when there are 0 or 1 matches.
@($users) | ConvertTo-Json -Compress
