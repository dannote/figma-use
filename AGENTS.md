# Development Guide

## Architecture

```
packages/
  proxy/    # Elysia WebSocket server (port 38451)
  cli/      # Citty-based CLI, 73 commands
  plugin/   # Figma plugin (esbuild, ES2015 target)
```

## Build & Test

```bash
bun install
bun run build           # Build all packages
bun test                # Run 73 integration tests (requires Figma open with plugin)
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

3. Add handler in `packages/plugin/src/main.ts`:
```typescript
case 'my-command': {
  const { id } = args as { id: string }
  const node = await figma.getNodeByIdAsync(id)
  return serializeNode(node)
}
```

4. Add test in `packages/cli/tests/commands.test.ts`

## Conventions

- Commands: kebab-case (`create-rectangle`, `set-fill-color`)
- Colors: hex format `#RGB`, `#RRGGBB`, `#RRGGBBAA`, or `var:VariableName` / `$VariableName`
- Output: human-readable by default, `--json` for machine parsing
- Inline styles: create commands accept `--fill`, `--stroke`, `--radius`, etc.

## Code Migrations

Use GritQL for AST-aware code transformations:

```bash
# Add import to files
grit apply '`import { defineCommand } from "citty"` => `import { defineCommand } from "citty"\nimport { colorArgToPayload } from "../../color-arg.ts"`' packages/cli/src/commands/create/*.ts

# Replace pattern in specific context
grit apply '`fill: args.fill` => `fill: colorArgToPayload(args.fill)`'

# More complex with conditions
grit apply '`$x: args.$y` where { $x <: or { `fill`, `stroke` } } => `$x: colorArgToPayload(args.$y)`'
```

GritQL is better than sed for:
- Import additions (deduplicates automatically)
- Refactors that need AST context
- Multi-file migrations with consistent formatting

## Plugin Build

Plugin uses esbuild (not Bun) because Figma requires ES2015. Build outputs to `packages/plugin/dist/`.

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
   # First: commit with changelog
   git add -A
   git diff --cached --name-only  # Review what's being committed!
   git commit -m "feat: description"
   
   # Then: bump version and release
   # Edit package.json version
   git add -A && git commit -m "v0.1.x"
   git tag v0.1.x
   git push && git push --tags
   npm publish --access public
   ```

4. **Never auto-commit unreviewed changes** — especially new commands/features

5. **npm publish requires passkey** — user must run `npm publish` manually (2FA via passkey, not OTP)
