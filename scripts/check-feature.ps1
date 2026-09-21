$ErrorActionPreference = "Stop"

function Stop-WithError {
    param([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "HCMS Feature Check" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan

# Make sure we are inside a Git repository.
git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "This directory is not a Git repository."
}

# Show the current branch.
$CurrentBranch = git branch --show-current

if ([string]::IsNullOrWhiteSpace($CurrentBranch)) {
    Stop-WithError "Could not determine the current Git branch."
}

Write-Host ""
Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan

# This check is intended for feature/chore branches, not develop/main.
if ($CurrentBranch -eq "develop" -or $CurrentBranch -eq "main") {
    Stop-WithError "Run this check from a feature or chore branch, not '$CurrentBranch'."
}

# Show current working tree state.
Write-Host ""
Write-Host "Git status:" -ForegroundColor Cyan
git status --short --branch

# Check for whitespace errors in unstaged changes.
Write-Host ""
Write-Host "Checking unstaged changes..." -ForegroundColor Cyan
git diff --check

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "git diff --check failed."
}

# Check for whitespace errors in staged changes.
Write-Host ""
Write-Host "Checking staged changes..." -ForegroundColor Cyan
git diff --cached --check

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "git diff --cached --check failed."
}

# Make sure package.json exists before running npm.
if (-not (Test-Path ".\package.json")) {
    Stop-WithError "package.json was not found."
}

# Make sure dependencies are installed.
if (-not (Test-Path ".\node_modules")) {
    Stop-WithError "node_modules was not found. Run 'npm install' first."
}

# Run the project's automated test suite.
Write-Host ""
Write-Host "Running automated tests..." -ForegroundColor Cyan
Write-Host ""

npm test

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Automated tests failed."
}

Write-Host ""
Write-Host "Final Git status:" -ForegroundColor Cyan
git status --short --branch

Write-Host ""
Write-Host "CHECK PASSED" -ForegroundColor Green
Write-Host "No whitespace errors were detected and all automated tests passed." -ForegroundColor Green