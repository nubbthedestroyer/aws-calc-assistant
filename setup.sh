#!/bin/bash
# AWS Calculator MCP Server Setup
# Tries Docker first, falls back to Node.js

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Try Docker first
if command -v docker &>/dev/null; then
  if docker info &>/dev/null 2>&1; then
    echo "Docker found — building image..."
    docker build -t aws-calculator-mcp "$ROOT"
    echo "Docker image built."

    cat > "$ROOT/.kiro/settings/mcp.json" <<'EOF'
{
  "mcpServers": {
    "aws-calculator": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "aws-calculator-mcp"]
    }
  }
}
EOF
    echo "Configured Kiro to use Docker."
    exit 0
  else
    echo "Docker installed but not running. Falling back to Node.js..."
  fi
else
  echo "Docker not found. Falling back to Node.js..."
fi

# Fall back to Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Neither Docker nor Node.js is available."
  echo "Install one from https://www.docker.com or https://nodejs.org"
  exit 1
fi

echo "Node.js found — installing dependencies..."
cd "$ROOT/server" && npm install
echo "Dependencies installed."

SERVER_PATH="$ROOT/server/index.js"

cat > "$ROOT/.kiro/settings/mcp.json" <<EOF
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["$SERVER_PATH"]
    }
  }
}
EOF
echo "Configured Kiro to use Node.js."
echo ""
echo "Done! Open this folder in Kiro and the aws-calculator agent will be available."
