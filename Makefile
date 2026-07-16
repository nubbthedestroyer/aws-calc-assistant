.PHONY: test build check-drift check-links verify all

all: build test

# Build the bundled MCP server
build:
	./build.sh

# Run unit tests
test:
	cd server && node --test index.test.js

# Verify that Claude Code skill symlink points to the correct steering file
# and contains identical content (catches broken symlinks or accidental copies)
check-drift:
	@echo "Checking instruction drift..."
	@if [ ! -L .claude/skills/aws-calculator/SKILL.md ]; then \
		echo "ERROR: .claude/skills/aws-calculator/SKILL.md is not a symlink"; \
		echo "  It should be a symlink to ../../../steering/aws-calculator-workflow.md"; \
		exit 1; \
	fi
	@TARGET=$$(readlink .claude/skills/aws-calculator/SKILL.md); \
	if [ "$$TARGET" != "../../../steering/aws-calculator-workflow.md" ]; then \
		echo "ERROR: Symlink points to '$$TARGET' instead of '../../../steering/aws-calculator-workflow.md'"; \
		exit 1; \
	fi
	@diff -q .claude/skills/aws-calculator/SKILL.md steering/aws-calculator-workflow.md > /dev/null 2>&1 || \
		(echo "ERROR: SKILL.md content differs from steering file (broken symlink?)"; exit 1)
	@echo "  ✓ Claude skill is a valid symlink to steering/aws-calculator-workflow.md"
	@echo "  ✓ Content is identical (no drift)"

# Verify the MCP server bundle starts and responds
check-server:
	@echo "Checking MCP server..."
	@RESPONSE=$$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/server.mjs 2>/dev/null); \
	if echo "$$RESPONSE" | grep -q "aws-calculator-assistant"; then \
		echo "  ✓ Server responds correctly"; \
	else \
		echo "ERROR: Server did not respond with expected name"; \
		echo "  Response: $$RESPONSE"; \
		exit 1; \
	fi

# Verify YAML frontmatter exists in steering files (needed for Claude skill discovery)
check-frontmatter:
	@echo "Checking YAML frontmatter..."
	@head -1 steering/aws-calculator-workflow.md | grep -q "^---$$" || \
		(echo "ERROR: steering/aws-calculator-workflow.md missing YAML frontmatter"; exit 1)
	@head -1 steering/map-estimate-best-practices.md | grep -q "^---$$" || \
		(echo "ERROR: steering/map-estimate-best-practices.md missing YAML frontmatter"; exit 1)
	@grep -q "^name:" steering/aws-calculator-workflow.md || \
		(echo "ERROR: steering/aws-calculator-workflow.md missing 'name' in frontmatter"; exit 1)
	@grep -q "^description:" steering/aws-calculator-workflow.md || \
		(echo "ERROR: steering/aws-calculator-workflow.md missing 'description' in frontmatter"; exit 1)
	@echo "  ✓ Both steering files have valid YAML frontmatter"

# Verify .mcp.json and mcp.json use the same command and args
check-mcp-config:
	@echo "Checking MCP configs..."
	@KIRO_CMD=$$(python3 -c "import json; c=json.load(open('mcp.json'))['mcpServers']['aws-calculator']; print(c['command'], *c['args'])"); \
	CLAUDE_CMD=$$(python3 -c "import json; c=json.load(open('.mcp.json'))['mcpServers']['aws-calculator']; print(c['command'], *c['args'])"); \
	if [ "$$KIRO_CMD" = "$$CLAUDE_CMD" ]; then \
		echo "  ✓ Both mcp.json and .mcp.json use: $$KIRO_CMD"; \
	else \
		echo "ERROR: MCP configs diverge - Kiro: $$KIRO_CMD, Claude: $$CLAUDE_CMD"; \
		exit 1; \
	fi

# Run all verification checks
verify: check-drift check-frontmatter check-mcp-config check-server
	@echo ""
	@echo "All checks passed. No drift detected."
