# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/dannote/figma-use/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/dannote/figma-use/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/dannote/figma-use/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/dannote/figma-use/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/dannote/figma-use/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dannote/figma-use/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dannote/figma-use/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dannote/figma-use/releases/tag/v0.1.0
