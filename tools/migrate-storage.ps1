# tools/migrate-storage.ps1
# One-time migration: move IDE-owned files from ~/.claude/projects/{encoded}/
# to the new location ~/.claude/theassociate/projects/{encoded}/
# Originals are deleted after a successful copy (or if the destination already exists).
#
# Usage:
#   .\tools\migrate-storage.ps1           # dry run (shows what would happen)
#   .\tools\migrate-storage.ps1 -Apply    # actually move the files

param([switch]$Apply)

$claudeHome = "$env:USERPROFILE\.claude"
$srcBase    = "$claudeHome\projects"
$dstBase    = "$claudeHome\theassociate\projects"

if (-not (Test-Path $srcBase)) {
    Write-Host "Source not found: $srcBase" -ForegroundColor Yellow
    exit 0
}

$mode = if ($Apply) { "APPLY" } else { "DRY RUN" }
Write-Host ""
Write-Host "=== Storage Migration ($mode) ===" -ForegroundColor Cyan
Write-Host "  Source : $srcBase"
Write-Host "  Dest   : $dstBase"
Write-Host ""

$moved    = 0
$deleted  = 0
$projects = 0

function Move-FileToNew($srcPath, $dstPath, $label) {
    if (Test-Path $dstPath) {
        Write-Host "  DEL-SRC  $label (dest exists, removing original)" -ForegroundColor Yellow
        if ($Apply) { Remove-Item -Path $srcPath -Force }
        return "deleted"
    } else {
        Write-Host "  MOVE     $label" -ForegroundColor Green
        if ($Apply) {
            New-Item -ItemType Directory -Path (Split-Path $dstPath) -Force | Out-Null
            Copy-Item -Path $srcPath -Destination $dstPath
            Remove-Item -Path $srcPath -Force
        }
        return "moved"
    }
}

foreach ($projectDir in Get-ChildItem -Path $srcBase -Directory) {
    $encoded = $projectDir.Name
    $src     = $projectDir.FullName
    $dst     = "$dstBase\$encoded"
    $didWork = $false

    # ---- 1. ide-settings.json ----
    $settingsSrc = "$src\ide-settings.json"
    if (Test-Path $settingsSrc) {
        $result = Move-FileToNew $settingsSrc "$dst\ide-settings.json" "$encoded\ide-settings.json"
        if ($result -eq "moved")   { $moved++;   $didWork = $true }
        if ($result -eq "deleted") { $deleted++;  $didWork = $true }
    }

    # ---- 2. notes\ ----
    $notesSrc = "$src\notes"
    if (Test-Path $notesSrc) {
        foreach ($f in Get-ChildItem -Path $notesSrc -Filter "*.json" -File) {
            $result = Move-FileToNew $f.FullName "$dst\notes\$($f.Name)" "$encoded\notes\$($f.Name)"
            if ($result -eq "moved")   { $moved++;   $didWork = $true }
            if ($result -eq "deleted") { $deleted++;  $didWork = $true }
        }
    }

    # ---- 3. *-summary-*.md -> summaries\ ----
    foreach ($f in Get-ChildItem -Path $src -Filter "*-summary-*.md" -File) {
        $result = Move-FileToNew $f.FullName "$dst\summaries\$($f.Name)" "$encoded\summaries\$($f.Name)"
        if ($result -eq "moved")   { $moved++;   $didWork = $true }
        if ($result -eq "deleted") { $deleted++;  $didWork = $true }
    }

    if ($didWork) { $projects++ }
}

Write-Host ""
if ($Apply) {
    Write-Host "Done. Moved $moved file(s), removed $deleted duplicate original(s) across $projects project(s)." -ForegroundColor Cyan
} else {
    Write-Host "Dry run complete. Would move $moved file(s) and remove $deleted duplicate original(s) across $projects project(s)." -ForegroundColor Yellow
    Write-Host "Re-run with -Apply to execute." -ForegroundColor Yellow
}
Write-Host ""
