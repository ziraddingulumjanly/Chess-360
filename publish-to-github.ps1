param()
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$remote = 'https://github.com/ziraddingulumjanly/Chess360.git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed. Install Git for Windows from https://git-scm.com/download/win and run this script again.'
}
if (-not (Test-Path -LiteralPath '.github/workflows/pages.yml')) {
    throw 'Cannot find .github/workflows/pages.yml. Extract the complete ZIP first.'
}
if (-not (Test-Path '.git')) {
    git init
    if ($LASTEXITCODE -ne 0) { throw 'git init failed' }
}
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($existing -ne $remote) {
        throw "This folder already points to a different origin: $existing. Refusing to overwrite that remote."
    }
} else {
    git remote add origin $remote
    if ($LASTEXITCODE -ne 0) { throw 'Failed to add the GitHub remote.' }
}
git branch -M main
if ($LASTEXITCODE -ne 0) { throw 'Failed to select main branch.' }
git add --all
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }
$pending = git status --porcelain
if ($pending) {
    git commit -m 'feat(chess): publish Chess 360 with puzzles and GitHub Pages'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed. Configure git user.name and user.email, then retry.' }
}
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed. Check browser login / Git credentials and retry.' }
Write-Host ''
Write-Host 'The project has been pushed to GitHub.' -ForegroundColor Green
Write-Host 'Next: https://github.com/ziraddingulumjanly/Chess360/settings/pages'
Write-Host 'Select Build and deployment > Source: GitHub Actions.'
Write-Host 'Watch the deploy at https://github.com/ziraddingulumjanly/Chess360/actions'
Write-Host 'Expected address: https://ziraddingulumjanly.github.io/Chess360/'
