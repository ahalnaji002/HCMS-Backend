$ErrorActionPreference = "Stop"

function Stop-WithError {
    param([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "HCMS Finish Feature" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Make sure we are inside a Git repository.
git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "This directory is not a Git repository."
}

# Working tree must be completely clean before switching branches.
$status = git status --porcelain

if ($status) {
    Write-Host ""
    Write-Host "Working tree is not clean:" -ForegroundColor Yellow
    git status --short

    Stop-WithError "Commit, stash, or discard the changes before finishing the feature."
}

# Capture the branch that we are about to finish.
$FeatureBranch = git branch --show-current

if ([string]::IsNullOrWhiteSpace($FeatureBranch)) {
    Stop-WithError "Could not determine the current Git branch."
}

if ($FeatureBranch -eq "develop" -or $FeatureBranch -eq "main") {
    Stop-WithError "Run this script from the feature/chore branch that was merged."
}

Write-Host ""
Write-Host "Branch to finish: $FeatureBranch" -ForegroundColor Cyan

# Refresh remote information.
Write-Host ""
Write-Host "Fetching origin..." -ForegroundColor Cyan

git fetch origin

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to fetch from origin."
}

# Move back to develop.
Write-Host ""
Write-Host "Switching to develop..." -ForegroundColor Cyan

git checkout develop

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to checkout develop."
}

# Bring local develop fully up to date without creating a merge commit.
Write-Host ""
Write-Host "Updating develop..." -ForegroundColor Cyan

git pull --ff-only origin develop

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to update develop."
}

# Verify that the feature branch is actually contained in develop.
Write-Host ""
Write-Host "Verifying merge..." -ForegroundColor Cyan

git merge-base --is-ancestor $FeatureBranch develop

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "The branch cannot be verified as merged into develop." -ForegroundColor Yellow
    Write-Host "The local branch will NOT be deleted." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Current branch: develop" -ForegroundColor Yellow
    exit 1
}

Write-Host "Merge verified." -ForegroundColor Green

# Delete only the local branch.
# -d adds another Git safety check and refuses deletion if Git considers it unmerged.
Write-Host ""
Write-Host "Deleting local branch: $FeatureBranch" -ForegroundColor Cyan

git branch -d $FeatureBranch

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Git refused to delete the local branch."
}

Write-Host ""
Write-Host "FEATURE FINISHED" -ForegroundColor Green
Write-Host "Local develop is updated." -ForegroundColor Green
Write-Host "Local branch '$FeatureBranch' was deleted safely." -ForegroundColor Green
Write-Host "Remote branches were not deleted." -ForegroundColor Green

Write-Host ""
git status --short --branch