# setup.ps1 - One-time setup script for new churches forking this template.
#
# Replaces "Emmanuel Gospel Centre" / "EGC" / "egc-church" placeholder text
# across HTML files, manifests, config files, and GitHub workflow files.
#
# Run from the repo root AFTER replacing firebase-config.js with your own.
# Safe to re-run: each replacement is idempotent.
#
# Usage:
#   ./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC"
#
# With optional Firebase deployment values (recommended):
#   ./setup.ps1 -ChurchName "Grace Community Church" -ShortName "GCC" `
#               -Domain "app.gracechurch.com" `
#               -ProjectId "grace-community-777" `
#               -StagingSite "grace-staging"
#
# Parameters:
#   -ChurchName   Full church name  (e.g. "Grace Community Church")
#   -ShortName    Short name / abbreviation  (e.g. "GCC")
#   -Domain       Your Firebase Hosting production URL  (e.g. "app.gracechurch.com")
#   -ProjectId    Your Firebase project ID  (e.g. "grace-community-777")
#                 Found in Firebase console > Project settings
#   -StagingSite  Your Firebase Hosting staging site name  (e.g. "grace-staging")
#                 The site name you created in Firebase Hosting for PR previews
#
# See SETUP.md for the full 10-step setup checklist.

param(
    [Parameter(Mandatory=$true)]
    [string]$ChurchName,

    [Parameter(Mandatory=$true)]
    [string]$ShortName,

    [string]$Domain     = "",
    [string]$ProjectId  = "",
    [string]$StagingSite = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -- Validate input ----------------------------------------------------------
if ($ChurchName.Trim() -eq "") { Write-Error "ChurchName cannot be empty."; exit 1 }
if ($ShortName.Trim()  -eq "") { Write-Error "ShortName cannot be empty.";  exit 1 }

# -- Nav logo lines ----------------------------------------------------------
# The nav logo shows a two-line text badge.
# Line 1: first word of the church name (uppercase).
# Line 2: remaining words (uppercase). Falls back to ShortName for single-word names.
$words    = $ChurchName.ToUpper() -split '\s+'
$NavLine1 = $words[0]
$NavLine2 = if ($words.Count -gt 1) { ($words[1..($words.Length - 1)] -join ' ') } else { $ShortName.ToUpper() }

# -- Cache name prefix (lowercase short name, no spaces) ---------------------
$CachePrefix = $ShortName.ToLower() -replace '\s+', '-'

$enc     = New-Object System.Text.UTF8Encoding($false)
$changed = 0

Write-Host ""
Write-Host "EGC Church Template Setup"
Write-Host "========================="
Write-Host "Church name  : $ChurchName"
Write-Host "Short name   : $ShortName"
Write-Host "Nav logo     : $NavLine1 / $NavLine2"
if ($Domain)      { Write-Host "Domain       : $Domain" }
if ($ProjectId)   { Write-Host "Project ID   : $ProjectId" }
if ($StagingSite) { Write-Host "Staging site : $StagingSite" }
Write-Host ""

# -- Helper: replace in a single file ----------------------------------------
function ReplaceInFile {
    param([string]$Path, [scriptblock]$Transforms)
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
    $text = $text -replace '"name"\s*:\s*"Emmanuel Gospel Centre"',               "`"name`": `"$ChurchName`""
    $text = $text -replace '"short_name"\s*:\s*"EGC"',                            "`"short_name`": `"$ShortName`""
    $text = $text -replace '"description"\s*:\s*"Emmanuel Gospel Centre church website"',
                            "`"description`": `"$ChurchName church website`""
    $text
}

# -- church-config.js --------------------------------------------------------
ReplaceInFile -Path "church-config.js" -Transforms {
    param($text)
    $text = $text.Replace("'Emmanuel Gospel Centre'", "'$ChurchName'")
    $text = $text -replace "shortName\s*:\s*'EGC'", "shortName: '$ShortName'"
    if ($Domain)    { $text = $text.Replace("'app.egc.church'", "'$Domain'") }
    $text
}

# -- js/main.js -- PWA install prompt ----------------------------------------
ReplaceInFile -Path "js/main.js" -Transforms {
    param($text)
    $text.Replace('Add EGC to your home screen', "Add $ShortName to your home screen")
}

# -- service-worker.js -- cache name prefix ----------------------------------
ReplaceInFile -Path "service-worker.js" -Transforms {
    param($text)
    # Reset cache version to v1 and use new church's short name prefix
    $text -replace "egc-cache-v\d+", "$CachePrefix-cache-v1"
}

# -- .firebaserc -- Firebase project ID and site names -----------------------
if ($ProjectId) {
    ReplaceInFile -Path ".firebaserc" -Transforms {
        param($text)
        $text = $text.Replace('"default": "egc-church"', "`"default`": `"$ProjectId`"")
        $text = $text.Replace('"egc-church": {',         "`"$ProjectId`": {")
        if ($StagingSite) {
            $text = $text.Replace('"egc-staging777"', "`"$StagingSite`"")
        }
        $text
    }
}

# -- GitHub workflow files -- project ID and staging site --------------------
if ($ProjectId) {
    ReplaceInFile -Path ".github/workflows/deploy.yml" -Transforms {
        param($text)
        $text.Replace('projectId: egc-church', "projectId: $ProjectId")
    }
    ReplaceInFile -Path ".github/workflows/preview.yml" -Transforms {
        param($text)
        $text = $text.Replace('projectId: egc-church', "projectId: $ProjectId")
        $text = $text.Replace('projects/egc-church/', "projects/$ProjectId/")
        if ($StagingSite) {
            $text = $text.Replace('sites/egc-staging777', "sites/$StagingSite")
        }
        $text
    }
}

# -- Summary -----------------------------------------------------------------
Write-Host ""
Write-Host "Done. $changed file(s) updated."
Write-Host ""

$manualSteps = @()
if (-not $Domain)      { $manualSteps += "Edit church-config.js -- set domain to your Firebase Hosting URL" }
if (-not $ProjectId)   { $manualSteps += "Update projectId in .github/workflows/deploy.yml and preview.yml" }
if (-not $StagingSite -and $ProjectId) {
    $manualSteps += "Update egc-staging777 in .github/workflows/preview.yml with your staging site name"
}
if (-not $ProjectId)   { $manualSteps += "Update .firebaserc with your Firebase project ID and site names" }
$manualSteps += "Replace firebase-config.js with your project's config (if not done already)"
$manualSteps += "Add FIREBASE_SERVICE_ACCOUNT and FIREBASE_TOKEN to GitHub repo secrets"
$manualSteps += "Run: firebase deploy"

Write-Host "Remaining manual steps:"
foreach ($step in $manualSteps) {
    Write-Host "  - $step"
}
Write-Host ""
Write-Host "See SETUP.md for the full checklist."
Write-Host ""
