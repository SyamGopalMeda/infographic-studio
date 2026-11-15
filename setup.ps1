# One-time setup for Infographic Studio (Windows). Easiest: double-click setup.bat
# Installs (only if missing): Node.js LTS, Claude Code CLI. Then project packages (Playwright, ffmpeg,
# PptxGenJS), headless Chromium, and the HyperFrames video plugin for Claude Code.
# Use -NoHyperFrames to skip the plugin.
param([switch]$NoHyperFrames)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "1/7  Checking Node.js..." -ForegroundColor Cyan
if (-not (Has node)) {
  if (Has winget) {
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
  }
  if (-not (Has node)) { throw "Node.js is not installed. Install the LTS version from https://nodejs.org, then run setup.bat again." }
}
$major = [int]((node -v).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw "Node.js 18 or newer is needed (found $(node -v)). Update from https://nodejs.org" }
Write-Host "     Node $(node -v)"

Write-Host "2/7  Checking Claude Code..." -ForegroundColor Cyan
if (-not (Has claude)) {
  npm install -g @anthropic-ai/claude-code
  Refresh-Path
  if (-not (Has claude)) { throw "Claude Code install failed. See https://docs.claude.com/en/docs/claude-code/setup" }
}
Write-Host "     $(claude --version)"

Write-Host "3/7  Installing project packages (Playwright, ffmpeg, PptxGenJS)..." -ForegroundColor Cyan
if (Test-Path package-lock.json) { npm ci } else { npm install }
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "4/7  Downloading the headless browser used for recording..." -ForegroundColor Cyan
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "playwright install failed" }

Write-Host "5/7  Test builds (infographic video + PowerPoint deck)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force inbox, inbox\deck, input, out | Out-Null
node scripts/make.mjs data/example.json --no-gif
if ($LASTEXITCODE -ne 0) { throw "example infographic render failed" }
node scripts/deck.mjs decks/example-deck.json
if ($LASTEXITCODE -ne 0) { throw "example deck build failed" }

Write-Host "6/7  Installing Infographic Studio as a Claude Code plugin (works in every folder)..." -ForegroundColor Cyan
$ErrorActionPreference = 'Continue'
claude plugin marketplace add "$PSScriptRoot"
if ($LASTEXITCODE -ne 0) { claude plugin marketplace update tech-drona }
claude plugin install infographic-studio@tech-drona
if ($LASTEXITCODE -ne 0) { claude plugin update infographic-studio@tech-drona }
# Pre-install the plugin copy's packages so the first use from another folder is fast.
$installed = Join-Path $env:USERPROFILE '.claude\plugins\installed_plugins.json'
if (Test-Path $installed) {
  $info = Get-Content $installed -Raw | ConvertFrom-Json
  $entry = $info.plugins.'infographic-studio@tech-drona' | Select-Object -First 1
  if ($entry -and (Test-Path (Join-Path $entry.installPath 'scripts\studio.mjs'))) {
    node (Join-Path $entry.installPath 'scripts\studio.mjs') check
  } else { Write-Warning "Plugin install not found. Retry: claude plugin install infographic-studio@tech-drona" }
}
$ErrorActionPreference = 'Stop'

Write-Host "7/7  HyperFrames video plugin for Claude Code..." -ForegroundColor Cyan
if ($NoHyperFrames) {
  Write-Host "     skipped (-NoHyperFrames)"
} else {
  # Not required by the studio itself; it gives Claude extra skills for advanced videos.
  $ErrorActionPreference = 'Continue'
  claude plugin marketplace add heygen-com/hyperframes
  claude plugin install hyperframes@hyperframes
  if ($LASTEXITCODE -ne 0) { Write-Warning "HyperFrames plugin not installed (optional). Retry later with: claude plugin install hyperframes@hyperframes" }
  $ErrorActionPreference = 'Stop'
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "IMPORTANT (first time on this laptop): open a terminal, run  claude  and sign in once." -ForegroundColor Yellow
Write-Host "Then:"
Write-Host "  - create.bat : drag an image onto it, or double-click and type a scenario -> animated infographic"
Write-Host "  - deck.bat   : same, but makes a PowerPoint presentation"
Write-Host "  - watch.bat  : drop files into inbox\ (infographic) or inbox\deck\ (presentation)"
Write-Host "  - In ANY folder: run  claude  and ask for an infographic or a presentation,"
Write-Host "    or type  /infographic-studio:animated-infographic  or  /infographic-studio:presentation"
