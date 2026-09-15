<#
    Dumps raw data only (Name, DN, ParentDN) for every OU that directly contains
    at least one user, grouped into Root1 / Root2 / Extra.
    No prints other than the final JSON on stdout. All input is hardcoded below.
    Name normalization ("Users" -> parent name, etc.) is intentionally NOT done
    here — it's done on the Python side (see accompanying script).
#>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---- hardcoded input (edit these) ----
$RootOU1      = "OU=Администрация,DC=adm,DC=dsszzi"
$RootOU2      = "OU=Підрозділи ДСЗ,DC=adm,DC=dsszzi"
$ExtraGroupOU = "OU=REGIONAL,OU=Администрация,DC=adm,DC=dsszzi"   # belongs to Root1
# ---------------------------------------

$ErrorActionPreference = "Stop"
Import-Module ActiveDirectory

function Get-UserOUs {
    param([Parameter(Mandatory)][string]$SearchBase)

    $ous = @()
    $ous += Get-ADOrganizationalUnit -Identity $SearchBase
    $ous += Get-ADOrganizationalUnit -SearchBase $SearchBase -SearchScope Subtree -Filter *
    $ous = $ous | Sort-Object DistinguishedName -Unique

    foreach ($ou in $ous) {
        # Existence check only - ResultSetSize 1 avoids counting all users
        $hasUser = Get-ADUser -SearchBase $ou.DistinguishedName -SearchScope OneLevel `
                    -Filter * -ResultSetSize 1 -ErrorAction SilentlyContinue

        if ($hasUser) {
            [PSCustomObject]@{
                Name      = $ou.Name
                DN        = $ou.DistinguishedName
                ParentDN  = ($ou.DistinguishedName -split ',', 2)[1]
            }
        }
    }
}

# Extra is nested under Root1 -> exclude anything under Extra's subtree from Root1's
# list. Matching by DN ancestry (not by "does it have users") so it's correct
# regardless of whether a given nested OU under Extra happens to have users itself.
function Test-IsUnderOU {
    param([string]$Dn, [string]$AncestorDn)
    return ($Dn -eq $AncestorDn -or $Dn -like "*,$AncestorDn")
}

$root1 = Get-UserOUs -SearchBase $RootOU1 |
    Where-Object { -not (Test-IsUnderOU -Dn $_.DN -AncestorDn $ExtraGroupOU) }
$root2 = Get-UserOUs -SearchBase $RootOU2
$extra = Get-UserOUs -SearchBase $ExtraGroupOU

$result = [PSCustomObject]@{
    ADMINISTRATION = @($root1)
    SSSCIP_UNITS = @($root2)
    REGIONAL = @($extra)
}

# For manual testing: also save a copy of the JSON to disk.
# Leave blank ("") to skip file output entirely.
$TestOutputFile = ""

if ($TestOutputFile) {
    $result | ConvertTo-Json -Depth 5 -Compress | Tee-Object -FilePath $TestOutputFile
}
else {
    $result | ConvertTo-Json -Depth 5 -Compress
}