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
bun test                # Run 184 integration tests

# Figma must be running with:
open -a Figma --args --remote-debugging-port=9222
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

1. **Review staged changes** before committing:
   ```bash
   git status
   git diff --cached
   ```

2. **Ensure CHANGELOG.md is updated** with all new features

3. **Commit and release separately**:
   ```bash
   git add -A
   git diff --cached --name-only  # Review!
   git commit -m "feat: description"
   
   # Bump version in package.json
   git add -A && git commit -m "v0.9.0"
   git tag v0.9.0
   git push && git push --tags
   npm publish
   ```

4. **npm publish requires passkey** — user must run manually
