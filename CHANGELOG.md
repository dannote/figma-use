# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.6] - 2026-01-18

### Added

- `comment list|add|delete` — manage file comments
- `version list` — view file version history  
- `file info` — get file key and name
- `me` — get current user info
- `font list` — list available fonts with optional family filter
- `plugin list` — list installed development plugins
- `plugin` is now a subcommand group: `plugin install|uninstall|list|path`

## [0.5.4] - 2026-01-18

### Added

- **MCP server** — proxy exposes `/mcp` endpoint with 80+ auto-generated tools
  - JSON-RPC over HTTP (no SDK dependency)
  - Tools generated from CLI command definitions via TypeScript AST
  - String args coerced to numbers using Zod
  - `figma-use mcp` command shows client configuration
- MCP schema validation tests against official JSON schema
- MCP integration tests

## [0.5.3] - 2026-01-18

### Added

- **`set font-range`** — style text ranges (bold, color, size for specific characters)
  ```bash
  figma-use set font-range <id> --start 0 --end 5 --style Bold --color "#FF0000"
  ```
- **`node to-component`** — convert frames to components
  ```bash
  figma-use node to-component <id>
  figma-use node to-component "1:2 1:3 1:4"  # Multiple
  ```
- SKILL.md: added SVG import, font-range, grouping and auto-layout examples

## [0.5.2] - 2026-01-18

### Fixed

- Multiplayer connection works with Figma's updated protocol (sessionID now from plugin API)
- Proxy properly handles file switches (closes stale connections)
- `figma-use status` now shows full connection diagnostics (proxy, plugin, DevTools, file)

## [0.5.1] - 2026-01-18

### Added

- Package exports for `@dannote/figma-use/render` and `@dannote/figma-use/components`

### Fixed

- SKILL.md now starts with connection check instructions
- Simplified SKILL.md for better AI agent comprehension

## [0.5.0] - 2026-01-18

### Added

- **`render --examples`** — full API reference for JSX rendering
- Main CLI help now mentions JSX rendering and points to `render --examples`
- **`defineComponent` for reusable components**
  ```tsx
  const Button = defineComponent('Button',
    <Frame style={{ padding: 12, backgroundColor: '#3B82F6' }}>
      <Text style={{ color: '#FFF' }}>Click me</Text>
    </Frame>
  )
  // First usage creates Component, subsequent create Instances
  <Button />
  <Button />
  ```

- **`defineComponentSet` for component variants**
  ```tsx
  const Button = defineComponentSet('Button', {
    variant: ['Primary', 'Secondary'] as const,
    size: ['Small', 'Large'] as const,
  }, ({ variant, size }) => (
    <Frame style={{ 
      padding: size === 'Large' ? 16 : 8,
      backgroundColor: variant === 'Primary' ? '#3B82F6' : '#E5E7EB' 
    }}>
      <Text>{variant} {size}</Text>
    </Frame>
  ))
  // Creates ComponentSet with all variant combinations
  <Button variant="Primary" size="Large" />
  ```

- Proper auto-sizing support (`hug contents`) for frames with `flexDirection`
- ComponentSet creates real Figma ComponentSet with `isStateGroup=true`

### Fixed

- Auto-layout sizing mode now correctly set to FIXED when explicit dimensions provided
- TEXT nodes render with correct height (lineHeight encoding fix)
- Alignment fields use correct names (stackPrimaryAlignItems, not stackJustify)

### Technical Notes

ComponentSet instances are created via Plugin API instead of multiplayer because
Figma reassigns GUIDs on receive, breaking symbolData.symbolID references within
the same batch. See `component-set.tsx` for detailed explanation.

## [0.4.0] - 2026-01-18

### Added

- **`defineVars` API for Figma variables** — bind colors to variables by name
  ```tsx
  const colors = defineVars({
    primary: { name: 'Colors/Gray/50', value: '#F8FAFC' },
    accent: { name: 'Colors/Blue/500', value: '#3B82F6' },
  })
  <Frame style={{ backgroundColor: colors.primary }} />
  ```
- Variable binding for `backgroundColor`, `borderColor`, and text `color`
- Variables resolved by name at render time (no more magic IDs)
- `defineVars` support in stdin snippets
- Explicit fallback values in `defineVars` for proper color display

### Fixed

- Auto-layout now works correctly via `trigger-layout` post-render
- Nested auto-layout frames trigger recursively
- Variable binding encoding matches Figma's exact wire format

### Changed

- Marked React render and variable bindings as **experimental** in docs

## [0.3.1] - 2026-01-18

### Added

- **Variable binding via multiplayer protocol** — bind fill colors to Figma variables without plugin API
  - `encodePaintWithVariableBinding()` — encode Paint with color variable binding
  - `encodeNodeChangeWithVariables()` — encode NodeChange with variable-bound paints  
  - `parseVariableId()` — parse "VariableID:sessionID:localID" strings
- New exports: `VariableBinding`, `encodePaintWithVariableBinding`, `encodeNodeChangeWithVariables`, `parseVariableId`
- `bind-fill-variable` plugin command — bind fill color to variable
- `bind-stroke-variable` plugin command — bind stroke color to variable

### Fixed

- Message field mapping: nodeChanges is field 4, reconnectSequenceNumber is field 25
- Paint variable binding format now matches Figma's exact wire format

### Technical

- Discovered Figma's variable binding wire format via WebSocket traffic analysis
- Created capture/diff tools for binary protocol analysis (`scripts/capture.ts`, `scripts/diff-hex.ts`)
- 142 tests passing

## [0.3.0] - 2025-01-17

### Added

- **`render` command** — render React/TSX components directly to Figma
  - From file: `figma-use render ./Card.figma.tsx`
  - From stdin: `echo '<Frame style={{...}} />' | figma-use render --stdin`
  - With props: `--props '{"title": "Hello"}'`
  - Into parent: `--parent "1:23"`
  - Dry run: `--dryRun` outputs NodeChanges JSON
- **Multiplayer WebSocket connection pooling** in proxy
  - First render: ~4s (establishes connection)
  - Subsequent renders: ~0.4s (10x faster!)
  - Connections auto-close after 5min idle
- **React components** — `Frame`, `Text`, `Rectangle`, `Ellipse`, `Line`, `Star`, `Polygon`, `Vector`, `Component`, `Instance`, `Group`, `Page`, `View`
- **JSX intrinsic elements** — PascalCase in JSX, lowercase in output
- **culori integration** — robust color parsing (hex, rgb(), hsl(), named colors)
- `/render` endpoint in proxy for direct NodeChanges submission
- `/status` endpoint now shows multiplayer connection pool

### Changed

- Proxy now holds persistent WebSocket connections to Figma multiplayer
- Architecture diagram updated to show dual communication paths
- 143 tests passing

### Fixed

- TypeScript strict mode errors in tests
- NodeChanges validation before sending (must have guid)

## [0.2.1] - 2025-01-17

### Added

- **`profile` command** — performance profiling via Chrome DevTools Protocol
  - Profile any command: `figma-use profile "get components --limit 20"`
  - Shows time breakdown (Figma WASM vs JS vs GC)
  - Lists top functions by CPU time
  - Requires Figma with `--remote-debugging-port=9222`
- `get components --name` — filter components by name
- `get components --limit` — limit results (default 50)
- `get components --page` — filter by page
- `find --type` now works without `--name`

### Changed

- `get components` uses early-exit recursion for better performance on large files
- `node tree --depth` now affects node count check (won't block with high depth limit)

### Fixed

- Variant components no longer crash when accessing `componentPropertyDefinitions`
- 86 tests passing

## [0.2.0] - 2025-01-17

### Added

- **Subcommand structure** — commands reorganized into logical groups:
  - `node get|tree|children|move|resize|rename|clone|delete`
  - `create rect|ellipse|line|polygon|star|frame|text|component|instance|section|page`
  - `set fill|stroke|radius|opacity|rotation|visible|text|font|effect|layout|blend|constraints|image`
  - `get pages|components|styles`
  - `export node|selection|screenshot`
  - `selection get|set`
  - `page list|set`
  - `viewport get|set|zoom-to-fit`
  - `variable list|get|create|set|delete|bind`
  - `collection list|get|create|delete`
  - `style list|create-paint|create-text|create-effect`
  - `boolean union|subtract|intersect|exclude`
  - `group create|ungroup|flatten`
  - `find`, `import`, `eval`, `status`, `proxy`, `plugin`
- **Variables support** — full CRUD for Figma variables and collections
- **`node tree` command** — formatted hierarchy view with properties inline
- **Export size guards** — prevents oversized exports (max 4096px, 16MP)
- **Tree node limit** — `node tree` limits to 500 nodes by default
- `--force` flag to override size/node limits
- `--timeout` flag for heavy operations (export, screenshot, eval)

### Changed

- **BREAKING**: Command syntax changed from flat to nested (e.g., `create-rectangle` → `create rect`)
- Renamed args: `--parentId` → `--parent`, `--itemSpacing` → `--gap`, `--layoutMode` → `--layout`
- Tests reorganized into separate files by command group (80 tests)

### Fixed

- TypeScript strict mode compliance
- Figma API compatibility (BlurEffect, ExportSettings)

## [0.1.5] - 2025-01-17

### Added

- CHANGELOG.md
- SKILL.md included in npm package
- `--timeout` flag documentation

## [0.1.4] - 2025-01-17

### Added

- CONTRIBUTING.md with setup and PR guidelines

### Changed

- Updated package description and keywords

## [0.1.3] - 2025-01-17

### Added

- AGENTS.md for contributors
- Git tags for all versions

## [0.1.2] - 2025-01-17

### Added

- `eval` command to execute arbitrary JavaScript in Figma plugin context
- `figma-use plugin` auto-installs plugin to Figma settings.json
- `--force` flag for plugin install while Figma is running
- `--uninstall` flag to remove plugin
- Architecture diagram in README
- Comparison table: official Figma MCP (read-only) vs figma-use (full control)

### Changed

- All `proxy` and `plugin` commands now use citty for consistency
- README examples show inline styling (one command does fill + stroke + radius)

## [0.1.1] - 2025-01-17

### Added

- Human-readable CLI output by default (agent-browser style)
- `--json` flag for machine parsing on all commands
- 69 integration tests

### Changed

- Renamed from figma-bridge to @dannote/figma-use

## [0.1.0] - 2025-01-17

### Added

- Initial release
- 60+ CLI commands for Figma control
- WebSocket proxy server (Elysia)
- Figma plugin with all command handlers
- Create commands: rectangle, ellipse, line, polygon, star, vector, frame, section, text, component, instance
- Style commands: fill, stroke, corner radius, opacity, effects, blend mode
- Layout commands: auto-layout, constraints, min/max
- Transform commands: move, resize, rotate, set parent
- Query commands: get node, children, selection, pages, components, styles
- Export commands: PNG/SVG/PDF export, screenshot
- Inline styling: `--fill`, `--stroke`, `--radius` etc. on create commands

[unreleased]: https://github.com/dannote/figma-use/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/dannote/figma-use/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/dannote/figma-use/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/dannote/figma-use/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/dannote/figma-use/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/dannote/figma-use/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/dannote/figma-use/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dannote/figma-use/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dannote/figma-use/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dannote/figma-use/releases/tag/v0.1.0
