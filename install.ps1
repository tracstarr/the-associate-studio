<#
.SYNOPSIS
    Installs (or uninstalls) The Associate Studio binary.

.DESCRIPTION
    Downloads the latest assocs.exe from GitHub Releases and places it in
    $HOME\local\bin, then adds that directory to the user PATH.

.PARAMETER Uninstall
    Remove assocs.exe and remove $HOME\local\bin from the user PATH.

.EXAMPLE
    irm https://raw.githubusercontent.com/tracstarr/the-associate-studio/main/install.ps1 | iex

.EXAMPLE  Uninstall
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/tracstarr/the-associate-studio/main/install.ps1))) -Uninstall
#>

param(
    [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo       = 'tracstarr/the-associate-studio'
$installDir = Join-Path $HOME 'local\bin'
$binaryName = 'assocs.exe'
$assetName  = 'assocs.exe'

# ── Helpers ────────────────────────────────────────────────────────────────────

function Add-ToPath([string]$Dir) {
    $current = [Environment]::GetEnvironmentVariable('Path', 'User') ?? ''
    $parts   = $current -split ';' | Where-Object { $_ -ne '' }
    if ($parts -notcontains $Dir) {
        $newPath = ($parts + $Dir) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Host "Added to user PATH: $Dir" -ForegroundColor Green
    } else {
        Write-Host "Already in user PATH: $Dir" -ForegroundColor DarkGray
    }
}

function Remove-FromPath([string]$Dir) {
    $current = [Environment]::GetEnvironmentVariable('Path', 'User') ?? ''
    $parts   = $current -split ';' | Where-Object { $_ -ne '' -and $_ -ne $Dir }
    [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
    Write-Host "Removed from user PATH: $Dir" -ForegroundColor Yellow
}

function Get-LatestRelease {
    $apiUrl  = "https://api.github.com/repos/$repo/releases/latest"
    $headers = @{ 'User-Agent' = 'assocs-installer/1.0' }
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $asset   = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
    if (-not $asset) {
        throw "Asset '$assetName' not found in latest release ($($release.tag_name)). Assets: $($release.assets.name -join ', ')"
    }
    return @{
        Version     = $release.tag_name
        DownloadUrl = $asset.browser_download_url
    }
}

# ── Uninstall ──────────────────────────────────────────────────────────────────

if ($Uninstall) {
    $target = Join-Path $installDir $binaryName
    if (Test-Path $target) {
        Remove-Item $target -Force
        Write-Host "Removed $target" -ForegroundColor Yellow
    } else {
        Write-Host "$target not found — nothing to remove." -ForegroundColor DarkGray
    }
    Remove-FromPath $installDir
    Write-Host "`nThe Associate Studio has been uninstalled." -ForegroundColor Cyan
    return
}

# ── Install / Update ──────────────────────────────────────────────────────────

Write-Host "Fetching latest release..." -ForegroundColor Cyan
$info = Get-LatestRelease
Write-Host "  Version : $($info.Version)" -ForegroundColor Green
Write-Host "  URL     : $($info.DownloadUrl)" -ForegroundColor Green

if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
    Write-Host "Created $installDir" -ForegroundColor Green
}

$dest = Join-Path $installDir $binaryName
Write-Host "`nDownloading $assetName..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $info.DownloadUrl -OutFile $dest -UseBasicParsing
Write-Host "Installed to $dest" -ForegroundColor Green

Add-ToPath $installDir

Write-Host @"

The Associate Studio $($info.Version) installed successfully.

  Run 'assocs' to start the IDE.
  (Restart your terminal if 'assocs' is not found yet.)
"@ -ForegroundColor Cyan
