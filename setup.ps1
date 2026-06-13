# setup.ps1 - One-time setup script for new churches forking this template.
#
# Replaces "Emmanuel Gospel Centre" / "EGC" placeholder text across all HTML
# files, manifest.json, and church-config.js with the new church's name.
#
# Run from the repo root AFTER replacing firebase-config.js with your own.
# Safe to re-run: each replacement is idempotent.
#
# Usage:
#   ./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC"
#   ./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC" -Domain "app.gracechurch.com"
#
# See SETUP.md for the full 10-step setup checklist.

param(
    [Parameter(Mandatory=$true)]
    [string]$ChurchName,

    [Parameter(Mandatory=$true)]
    [string]$ShortName,

    [string]$Domain = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Validate input ----------------------------------------------------------
if ($ChurchName.Trim() -eq "") {
    Write-Error "ChurchName cannot be empty."
    exit 1
}
if ($ShortName.Trim() -eq "") {
    Write-Error "ShortName cannot be empty."
    exit 1
}

# -- Nav logo lines ----------------------------------------------------------
# The nav logo shows a two-line text badge.
# Line 1: first word of the church name (uppercase).
# Line 2: remaining words (uppercase). Falls back to ShortName for single-word names.
$words = $ChurchName.ToUpper() -split '\s+'
$NavLine1 = $words[0]
if ($words.Count -gt 1) {
    $NavLine2 = ($words[1..($words.Length - 1)] -join ' ')
} else {
    $NavLine2 = $ShortName.ToUpper()
}

$enc     = New-Object System.Text.UTF8Encoding($false)
$changed = 0

Write-Host ""
Write-Host "EGC Church Template Setup"
Write-Host "========================="
Write-Host "Church name : $ChurchName"
Write-Host "Short name  : $ShortName"
Write-Host "Nav logo    : $NavLine1 / $NavLine2"
if ($Domain) { Write-Host "Domain      : $Domain" }
Write-Host ""

# -- Helper: replace in a single file ----------------------------------------
function ReplaceInFile {
    param(
        [string]$Path,
        [scriptblock]$Transforms
    )
    $abs      = (Resolve-Path $Path).Path
    $original = [System.IO.File]::ReadAllText($abs, $enc)
    $updated  = & $Transforms $original
    if ($updated -ne $original) {
        [System.IO.File]::WriteAllText($abs, $updated, $enc)
        Write-Host "  Updated : $Path"
        $script:changed++
    }
}

# -- HTML files --------------------------------------------------------------
$htmlFiles = Get-ChildItem -Path "." -Recurse -Filter "*.html" |
    Where-Object { $_.FullName -notmatch [regex]::Escape('\node_modules\') }

foreach ($f in $htmlFiles) {
    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1)
    ReplaceInFile -Path $f.FullName -Transforms {
        param($text)
        # Homepage title combines both forms -- replace specific pattern first
        $text = $text.Replace('Emmanuel Gospel Centre | EGC Church', $ChurchName)
        # Full name in all other titles and body text
        $text = $text.Replace('Emmanuel Gospel Centre', $ChurchName)
        # Admin page title suffix
        $text = $text.Replace('EGC Admin', "$ShortName Admin")
        # Nav logo two-line badge (nav.html, admin-nav.html, members-nav.html)
        $text = $text.Replace('>EMMANUEL<', ">$NavLine1<")
        $text = $text.Replace('>GOSPEL CENTRE<', ">$NavLine2<")
        $text
    }
}

# -- manifest.json -----------------------------------------------------------
ReplaceInFile -Path "manifest.json" -Transforms {
    param($text)
    $text = $text -replace '"name"\s*:\s*"Emmanuel Gospel Centre"', "`"name`": `"$ChurchName`""
    $text = $text -replace '"short_name"\s*:\s*"EGC"',             "`"short_name`": `"$ShortName`""
    $text = $text -replace '"description"\s*:\s*"Emmanuel Gospel Centre church website"',
                            "`"description`": `"$ChurchName church website`""
    $text
}

# -- church-config.js --------------------------------------------------------
ReplaceInFile -Path "church-config.js" -Transforms {
    param($text)
    $text = $text.Replace("'Emmanuel Gospel Centre'", "'$ChurchName'")
    $text = $text -replace "shortName\s*:\s*'EGC'", "shortName: '$ShortName'"
    if ($Domain) {
        $text = $text.Replace("'app.egc.church'", "'$Domain'")
    }
    $text
}

# -- js/main.js -- PWA install prompt ----------------------------------------
ReplaceInFile -Path "js/main.js" -Transforms {
    param($text)
    $text.Replace('Add EGC to your home screen', "Add $ShortName to your home screen")
}

# -- Summary -----------------------------------------------------------------
Write-Host ""
Write-Host "Done. $changed file(s) updated."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit church-config.js -- set timezone if not already done"
if (-not $Domain) {
    Write-Host "  2. Edit church-config.js -- set domain to your Firebase Hosting URL"
} else {
    Write-Host "  2. Domain already set to $Domain"
}
Write-Host "  3. Run: firebase deploy"
Write-Host "  4. Open /admin/settings to finish branding and feature setup"
Write-Host ""
Write-Host "See SETUP.md for the full checklist."
Write-Host ""
