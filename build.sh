#!/bin/bash
# Bundle the AWS Calculator MCP server into a single dependency-free file.
# Consumers only need Node.js >= 18 — no npm install required.
set -e
cd "$(dirname "$0")"

# Install dependencies (including esbuild) if needed
if [ ! -d server/node_modules ]; then
  echo "Installing dependencies..."
  cd server && npm install && cd ..
fi

# Bundle
mkdir -p dist
npx --prefix server esbuild server/index.js \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=esm \
  --outfile=dist/server.mjs

echo "Built dist/server.mjs ($(wc -c < dist/server.mjs | tr -d ' ') bytes)"
