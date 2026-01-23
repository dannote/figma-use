# Development Guide

## Architecture

```
packages/
  cli/      # Citty-based CLI, 100+ commands
  plugin/   # RPC handlers (built on-demand by CLI via esbuild)
```

CLI communicates directly with Figma via Chrome DevTools Protocol (CDP). No proxy server, no manual plugin installation.

## Build & Test

```bash
bun install
bun run build           # Build CLI bundle
bun test                # Run integration tests

# Figma must be running with:
open -a Figma --args --remote-debugging-port=9222
```

## Feature Completion Checklist

When implementing a new feature, ensure ALL of these are done before committing:

### 1. Implementation

- [ ] CLI command in `packages/cli/src/commands/`
- [ ] RPC handler in `packages/plugin/src/rpc.ts` (if needed)
- [ ] Export from `packages/cli/src/commands/index.ts`

### 2. Tests

- [ ] Add test file in `packages/cli/tests/commands/`
- [ ] Test happy path and edge cases
- [ ] Run `bun test` to verify all tests pass

### 3. Documentation

- [ ] **CHANGELOG.md** — add entry under `## [Unreleased]` or new version section
- [ ] **README.md** — update if it's a user-facing feature
- [ ] **SKILL.md** — update if it changes how agents should use the tool
- [ ] **REFERENCE.md** — update command reference if adding/changing commands

### 4. Review Before Commit

```bash
bun test                        # All tests pass?
bun run build                   # Build succeeds?
git diff                        # Review all changes
git diff --cached               # Review staged changes
```

## Adding Commands

1. Create `packages/cli/src/commands/my-command.ts`:

```typescript
import { defineCommand } from 'citty'
import { sendCommand } from '../client.ts'
import { printResult } from '../output.ts'

export default defineCommand({
  meta: { description: 'My command' },
  args: {
    id: { type: 'string', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const result = await sendCommand('my-command', { id: args.id })
    printResult(result, args.json)
  }
})
```

2. Export from `packages/cli/src/commands/index.ts`

3. Add handler in `packages/plugin/src/rpc.ts`:

```typescript
case 'my-command': {
  const { id } = args as { id: string }
  const node = await figma.getNodeByIdAsync(id)
  return serializeNode(node)
}
```

4. Add test in `packages/cli/tests/commands/`

## How CDP Works

1. CLI connects to `localhost:9222` (Figma's debug port)
2. First call builds `packages/plugin/src/rpc.ts` with esbuild and injects it
3. Commands execute via `Runtime.evaluate` with full Plugin API access
4. WebSocket closes after each command to allow process exit

## Conventions

- Commands: kebab-case (`create-rectangle`, `set-fill-color`)
- Colors: hex format `#RGB`, `#RRGGBB`, `#RRGGBBAA`, or `var:VariableName` / `$VariableName`
- Output: human-readable by default, `--json` for machine parsing
- Inline styles: create commands accept `--fill`, `--stroke`, `--radius`, etc.
- Terminal colors: use `picocolors` (`import pc from 'picocolors'`), never hardcode ANSI escapes

## No Inline Eval

**Never use `sendCommand('eval', { code: '...' })` in CLI commands.**

Instead, create a proper command in `packages/plugin/src/rpc.ts`:

```typescript
// ❌ Bad: inline eval
await sendCommand('eval', {
  code: `
    const node = await figma.getNodeByIdAsync('${id}')
    figma.createComponentFromNode(node)
  `
})

// ✅ Good: dedicated command
await sendCommand('convert-to-component', { id })
```

## Release

⚠️ **NEVER commit and release in one step!**

### Pre-release Checklist

- [ ] All tests pass (`bun test`)
- [ ] Build succeeds (`bun run build`)
- [ ] CHANGELOG.md updated with all changes
- [ ] README.md updated if needed
- [ ] SKILL.md updated if agent-facing changes

### Release Steps

```bash
# 1. Review and commit changes
git add -A
git diff --cached --name-only  # Review file list
git diff --cached              # Review actual changes
git commit -m "feat: description"

# 2. Version bump (separate commit)
# Edit package.json version
git add -A && git commit -m "v0.X.Y"
git tag v0.X.Y

# 3. Push
git push && git push --tags

# 4. Create GitHub release
gh release create v0.X.Y --title "v0.X.Y — Short Description" --notes "## Changes
- Feature 1
- Feature 2"

# 5. Publish (requires passkey - user must run)
npm publish
```

### Commit Message Conventions

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes nor adds
- `test:` — adding tests
- `chore:` — maintenance tasks

## Testing Storybook Export

After running `export storybook`, verify all stories render correctly:

### Quick Check (single story)

```bash
bunx agent-browser open "http://localhost:6006/iframe.html?viewMode=story&id=button--primary"
bunx agent-browser eval "document.getElementById('storybook-root').innerHTML"
bunx agent-browser close
```

### Full Test (all stories)

```bash
# Start Storybook first
cd <storybook-project> && npm run storybook &

# Test all stories
PASS=0; FAIL=0
for f in stories/*.stories.tsx; do
  # Extract component name (lowercase, spaces to dashes)
  title=$(grep "title:" "$f" | sed "s/.*title: ['\"]//;s/['\"].*//" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  [ -z "$title" ] && title=$(basename "$f" .stories.tsx | tr '[:upper:]' '[:lower:]')

  # Extract story names and convert to kebab-case
  for story in $(grep -o "export const [A-Za-z]*:" "$f" | sed 's/export const //;s/://'); do
    id="${title}--$(echo "$story" | sed 's/\([A-Z]\)/-\1/g;s/^-//' | tr '[:upper:]' '[:lower:]')"

    bunx agent-browser open "http://localhost:6006/iframe.html?viewMode=story&id=${id}" 2>/dev/null
    result=$(bunx agent-browser eval "
      const root = document.getElementById('storybook-root');
      const error = document.getElementById('error-message');
      error?.textContent ? 'ERROR: ' + error.textContent : (root?.innerHTML?.length > 10 ? 'OK' : 'EMPTY')
    " 2>&1)

    [[ "$result" == *"OK"* ]] && { echo "✓ $id"; ((PASS++)); } || { echo "✗ $id: $result"; ((FAIL++)); }
  done
done
echo "=== $PASS passed, $FAIL failed ==="
bunx agent-browser close
```

### Common Issues

- **"Can't find variable: React"** — missing `import React from 'react'` in generated `.tsx`
- **Story not found** — title has spaces (use dashes in ID: `Objects Table Row` → `objects-table-row`)
- **EMPTY render** — component returns null or has runtime error
