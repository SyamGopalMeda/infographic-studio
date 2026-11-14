# One-time setup for Infographic Studio (Windows). Easiest: double-click setup.bat
# Installs (only if missing): Node.js LTS, Claude Code CLI. Then project packages + headless Chromium.
param([switch]$WithExtras)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "1/5  Checking Node.js..." -ForegroundColor Cyan
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

Write-Host "2/5  Checking Claude Code..." -ForegroundColor Cyan
if (-not (Has claude)) {
  npm install -g @anthropic-ai/claude-code
  Refresh-Path
  if (-not (Has claude)) { throw "Claude Code install failed. See https://docs.claude.com/en/docs/claude-code/setup" }
}
Write-Host "     $(claude --version)"

Write-Host "3/5  Installing project packages (Playwright + ffmpeg)..." -ForegroundColor Cyan
if (Test-Path package-lock.json) { npm ci } else { npm install }
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "4/5  Downloading the headless browser used for recording..." -ForegroundColor Cyan
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "playwright install failed" }

Write-Host "5/5  Test build of the example..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force inbox, input, out | Out-Null
node scripts/make.mjs data/example.json --no-gif
if ($LASTEXITCODE -ne 0) { throw "example render failed" }

if ($WithExtras) {
  try {
    claude plugin marketplace add heygen-com/hyperframes
    claude plugin install hyperframes@hyperframes
  } catch { Write-Warning "Optional HyperFrames plugin not installed: $_" }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "IMPORTANT (first time on this laptop): open a terminal, run  claude  and sign in once." -ForegroundColor Yellow
Write-Host "Then:"
Write-Host "  - drag an image onto create.bat, or double-click it and type a scenario"
Write-Host "  - or run watch.bat and drop images / .txt scenarios into the inbox folder"
