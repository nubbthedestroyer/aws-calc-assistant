# setup.ps1 - AWS Calculator MCP Server Setup
# Tries Docker first, falls back to Node.js

$ErrorActionPreference = "Stop"

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

$root = $PSScriptRoot

# Try Docker first
if (Test-Command "docker") {
    try {
        docker info 2>&1 | Out-Null
        Write-Host "Docker found - building image..." -ForegroundColor Cyan
        docker build -t aws-calculator-mcp "$root"
        Write-Host "Docker image built successfully." -ForegroundColor Green

        $mcpConfig = @{
            mcpServers = @{
                "aws-calculator" = @{
                    command = "docker"
                    args    = @("run", "--rm", "-i", "aws-calculator-mcp")
                }
            }
        } | ConvertTo-Json -Depth 5

        $mcpConfig | Set-Content "$root\.kiro\settings\mcp.json" -Encoding UTF8
        Write-Host "Configured Kiro to use Docker." -ForegroundColor Green
        exit 0
    } catch {
        Write-Host "Docker is installed but not running. Falling back to Node.js..." -ForegroundColor Yellow
    }
} else {
    Write-Host "Docker not found. Falling back to Node.js..." -ForegroundColor Yellow
}

# Fall back to Node.js
if (-not (Test-Command "node")) {
    Write-Error "Neither Docker nor Node.js is available. Install one from https://www.docker.com or https://nodejs.org"
    exit 1
}

Write-Host "Node.js found - installing dependencies..." -ForegroundColor Cyan
Push-Location "$root\server"
npm install
Pop-Location
Write-Host "Dependencies installed." -ForegroundColor Green

$serverPath = "$root\server\index.js" -replace "\\", "/"

$mcpConfig = @{
    mcpServers = @{
        "aws-calculator" = @{
            command = "node"
            args    = @($serverPath)
        }
    }
} | ConvertTo-Json -Depth 5

$mcpConfig | Set-Content "$root\.kiro\settings\mcp.json" -Encoding UTF8
Write-Host "Configured Kiro to use Node.js." -ForegroundColor Green
