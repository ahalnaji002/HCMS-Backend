param(
    [Parameter(Mandatory = $true)]
    [string]$FeatureName
)

$ErrorActionPreference = "Stop"

function Stop-WithError {
    param([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

# Make sure the script is being run inside a Git repository.
git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "This directory is not a Git repository."
}

# Do not switch branches if there are local changes.
$status = git status --porcelain

if ($status) {
    Write-Host ""
    Write-Host "Working tree is not clean:" -ForegroundColor Yellow
    git status --short

    Stop-WithError "Commit, stash, or discard the changes before starting a feature."
}

# Normalize the branch name.
$FeatureName = $FeatureName.Trim()

if ([string]::IsNullOrWhiteSpace($FeatureName)) {
    Stop-WithError "Feature name cannot be empty."
}

if ($FeatureName.StartsWith("feature/")) {
    $BranchName = $FeatureName
}
else {
    $BranchName = "feature/$FeatureName"
}

Write-Host ""
Write-Host "Starting feature: $BranchName" -ForegroundColor Cyan

# Make sure the branch does not already exist locally.
git show-ref --verify --quiet "refs/heads/$BranchName"

if ($LASTEXITCODE -eq 0) {
    Stop-WithError "Local branch '$BranchName' already exists."
}

# Refresh remote branch information first.
Write-Host ""
Write-Host "Fetching origin..." -ForegroundColor Cyan
git fetch origin

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to fetch from origin."
}

# Also reject an already-existing remote feature branch.
git show-ref --verify --quiet "refs/remotes/origin/$BranchName"

if ($LASTEXITCODE -eq 0) {
    Stop-WithError "Remote branch 'origin/$BranchName' already exists."
}

# Move to develop.
Write-Host ""
Write-Host "Switching to develop..." -ForegroundColor Cyan
git checkout develop

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to checkout develop."
}

# Update develop using fast-forward only.
Write-Host ""
Write-Host "Updating develop..." -ForegroundColor Cyan
git pull --ff-only origin develop

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to update develop."
}

# Create the new feature branch from the updated develop.
Write-Host ""
Write-Host "Creating $BranchName..." -ForegroundColor Cyan
git checkout -b $BranchName

if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Failed to create feature branch."
}

Write-Host ""
Write-Host "Feature branch ready." -ForegroundColor Green
Write-Host "Current branch: $BranchName" -ForegroundColor Green

git status --short --branch