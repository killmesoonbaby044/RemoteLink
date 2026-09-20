# Import AD module
Import-Module ActiveDirectory

# <<< CHANGE THESE >>>
$OUPath = Read-Host "Enter OU"      # Where to create users
$Domain = "adm.dsszzi"                     # For UPN

# One common password for all users

$Password = ConvertTo-SecureString "Qwerty12" -AsPlainText -Force
Write-Host "`nEnter data in format: LastName FirstName MiddleName" -ForegroundColor Cyan
Write-Host "Example: Ivanov Ivan Ivanovych`n"

# Main loop
while ($true) {
    $input = Read-Host "Full name (or press Enter to quit)"
    if ([string]::IsNullOrWhiteSpace($input)) { break }

    # Split input: LastName = first word, FirstName + MiddleName = the rest
    $parts = $input -split ' ', 2
    $LastName    = $parts[0]
    $FirstName   = $parts[1]

    # Full display name exactly as entered
    $DisplayName = $input.Trim()

    # Ask for logon name (samAccountName)
    $Sam = Read-Host "Enter logon name (alias) for $DisplayName"

    $UPN = "$Sam@$Domain"

    try {
        New-ADUser -Name            $DisplayName `
                   -GivenName       $FirstName.Split()[0] `
                   -Surname         $LastName `
                   -DisplayName     $DisplayName `
                   -SamAccountName  $Sam `
                   -UserPrincipalName $UPN `
                   -Path            $OUPath `
                   -AccountPassword $Password `
                   -Enabled         $true `
                   -ChangePasswordAtLogon $true   # <<< Forces password change at first logon

        Write-Host "SUCCESS: $DisplayName ($Sam) created - password must be changed at next logon" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to create $Sam : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll done. Goodbye!" -ForegroundColor Cyan