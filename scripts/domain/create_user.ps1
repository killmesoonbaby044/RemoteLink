<#
    Creates a single AD user with an auto-generated password
    ("Qwerty" + 4 digits, same scheme as password.ps1) and forces a
    password change at next logon.

    Replaces the old interactive loop version — this one takes structured
    parameters (one user per call) and prints a single JSON object on
    stdout instead of Write-Host text, so it can be consumed the same way
    as the other scripts.

    Output on success:
        {"success":true,"username":"ivanov","full_name":"Ivanov Ivan Ivanovych","password":"Qwerty1234","error":null}
    Output on failure:
        {"success":false,"username":"ivanov","full_name":"Ivanov Ivan Ivanovych","password":null,"error":"..."}
#>

param(
    [Parameter(Mandatory = $true)][string]$FullName,   # "LastName FirstName [MiddleName]"
    [Parameter(Mandatory = $true)][string]$Sam,
    [Parameter(Mandatory = $true)][string]$OUPath,
    [string]$Domain = "adm.dsszzi",
    [string]$PdcServer = "DC01.adm.dsszzi"
)

$pdc = if ($PdcServer) { $PdcServer } else { (Get-ADDomain).PDCEmulator }
# Force UTF-8 for output, including output passed through the PowerShell pipeline.
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding  = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$ErrorActionPreference = "Stop"

Import-Module ActiveDirectory

# Split input: LastName = first word, FirstName = everything else.
$DisplayName = $FullName.Trim()
$parts       = $DisplayName -split '\s+' | Where-Object { $_ -ne '' }

$LastName  = $parts[0]
$FirstName = ($parts[1..($parts.Count - 1)]) -join ' '

$UPN = "$Sam@$Domain"

# Generate the password (same scheme as password.ps1: "Qwerty" + 4 digits).
$n = Get-Random -Minimum 1000 -Maximum 10000
$NewPassword = "Qwerty$n"
$securePassword = ConvertTo-SecureString $NewPassword -AsPlainText -Force

$result = [ordered]@{
    success   = $false
    username  = $Sam
    full_name = $DisplayName
    password  = $null
    error     = $null
}

try {
    New-ADUser `
        -Name $DisplayName `
        -GivenName $FirstName `
        -Surname $LastName `
        -DisplayName $DisplayName `
        -SamAccountName $Sam `
        -UserPrincipalName $UPN `
        -Path $OUPath `
        -AccountPassword $securePassword `
        -Enabled $true `
        -ChangePasswordAtLogon $true `
        -Server $pdc `
        -ErrorAction Stop

    $result.success  = $true
    $result.password = $NewPassword
} catch {
    $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Compress