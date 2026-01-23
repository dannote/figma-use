# Contributing

## Setup

```bash
git clone https://github.com/dannote/figma-use
cd figma-use
bun install
bun run build
```

## Development

```bash
bun run dev              # Run proxy in dev mode
bun test                 # Run tests (requires Figma with plugin)
```

### Running Tests

Tests require Figma desktop app with the plugin installed:

1. **Start Figma with debug port** (required for profiling/coverage):

   ```bash
   /Applications/Figma.app/Contents/MacOS/Figma --remote-debugging-port=9222
   ```

2. **Install the plugin**:

   ```bash
   ./bin/figma-use.js plugin --install
   ```

3. **Open any Figma file** and run the plugin (Plugins → Development → figma-use)

4. **Start the proxy** in another terminal:

   ```bash
   ./bin/figma-use.js proxy
   ```

5. **Run tests**:
   ```bash
   cd packages/cli && bun test
   ```

Each test file creates its own page, so tests can run in parallel without conflicts.

### Profiling Commands

With debug port enabled, you can profile any command:

```bash
./bin/figma-use.js profile "get components --limit 20"
```

## Adding a Command

1. Create handler in `packages/plugin/src/main.ts`
2. Create CLI command in `packages/cli/src/commands/`
3. Export from `packages/cli/src/commands/index.ts`
4. Add test in `packages/cli/tests/commands/`

See [AGENTS.md](AGENTS.md) for code examples.

## Pull Requests

- One feature per PR
- Add tests for new commands
- Run `bun test` before submitting
