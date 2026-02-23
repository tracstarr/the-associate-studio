<#
.SYNOPSIS
    Local production build for The Associate Studio (Tauri v2).

.DESCRIPTION
    Sets up MSYS2 MinGW + cargo PATH, checks prerequisites, runs
    `npm run tauri build`, and copies the output binary to dist-release\assocs.exe.

.EXAMPLE
    .\build.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Paths ──────────────────────────────────────────────────────────────────────
$ProjectRoot   = $PSScriptRoot
$MinGWBin      = 'C:\msys64\mingw64\bin'
$CargoBin      = Join-Path $HOME '.cargo\bin'
$SrcBinary     = Join-Path $ProjectRoot 'src-tauri\target\release\the-associate-studio.exe'
$DistDir       = Join-Path $ProjectRoot 'dist-release'
$DistBinary    = Join-Path $DistDir 'assocs.exe'
$NsisGlob      = Join-Path $ProjectRoot 'src-tauri\target\release\bundle\nsis\*-setup.exe'

# ── Prerequisite checks ────────────────────────────────────────────────────────
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command 'npm' -ErrorAction SilentlyContinue)) {
    Write-Error "npm not found. Install Node.js from https://nodejs.org"
}

$cargoExe = Join-Path $CargoBin 'cargo.exe'
if (-not (Test-Path $cargoExe)) {
    if (-not (Get-Command 'cargo' -ErrorAction SilentlyContinue)) {
        Write-Error "cargo not found. Install Rust from https://rustup.rs"
    }
}

$gccExe = Join-Path $MinGWBin 'gcc.exe'
if (-not (Test-Path $gccExe)) {
    Write-Error "MinGW gcc not found at $gccExe. Install MSYS2 + mingw-w64-x86_64-gcc."
}

Write-Host "  npm  : $(npm --version)" -ForegroundColor Green
Write-Host "  cargo: $(& $cargoExe --version 2>&1)" -ForegroundColor Green
Write-Host "  gcc  : $((& "$gccExe" --version 2>&1)[0])" -ForegroundColor Green

# ── PATH setup ─────────────────────────────────────────────────────────────────
Write-Host "`nConfiguring build environment..." -ForegroundColor Cyan
$env:Path              = "$MinGWBin;$CargoBin;$env:Path"
$env:PKG_CONFIG_PATH   = 'C:\msys64\mingw64\lib\pkgconfig'

# ── Install frontend dependencies ──────────────────────────────────────────────
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Cyan
Set-Location $ProjectRoot
# Use npm install rather than npm ci — ci does a full clean that fails when native .node
# files are locked by a running dev server.  install is safe and idempotent.
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed (exit $LASTEXITCODE)" }

# ── Tauri build ────────────────────────────────────────────────────────────────
Write-Host "`nRunning Tauri production build..." -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) { Write-Error "npm run tauri build failed (exit $LASTEXITCODE)" }

# ── Copy output ────────────────────────────────────────────────────────────────
if (-not (Test-Path $SrcBinary)) {
    Write-Error "Expected binary not found: $SrcBinary"
}

if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

Copy-Item $SrcBinary $DistBinary -Force
Write-Host "`nBinary  : $DistBinary" -ForegroundColor Green

# Print NSIS installer path if it was produced
$nsisFiles = Get-Item $NsisGlob -ErrorAction SilentlyContinue
if ($nsisFiles) {
    foreach ($f in $nsisFiles) {
        Write-Host "Installer: $($f.FullName)" -ForegroundColor Green
    }
}

Write-Host "`nBuild complete." -ForegroundColor Cyan
