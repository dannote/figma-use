# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.0] - 2026-01-23

### Added

- **Extended styling props** — comprehensive property support for export and render
  - **Corner smoothing** — iOS squircle corners (`cornerSmoothing={0.6}` → CSS `corner-shape: squircle`)
  - **Individual corner radii** — `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`
  - **Effects** — drop shadows (`shadow="0px 4px 8px rgba(0,0,0,0.25)"`) and blur (`blur={10}`)
  - **Constraints** — `minW`, `maxW`, `minH`, `maxH`
  - **Blend modes** — `blendMode="multiply"` etc.
  - **Rotation** — `rotate={45}`
  - **Overflow** — `overflow="hidden"` (clipsContent)
  - **Stroke align** — `strokeAlign="inside"` / `"outside"`
  - **Individual stroke weights** — `strokeTop`, `strokeBottom`, `strokeLeft`, `strokeRight`
  - **Flex wrap** — `wrap={true}` for auto-layout
  - **Absolute positioning** — `position="absolute"`
  - **Flex grow** — `grow={1}`
  - **Stretch** — `stretch={true}` (layoutAlign: STRETCH)

- **Improved human-readable output** — `node get` now shows:
  - Corner radii with smoothing percentage
  - Effects (shadows, blur)
  - Rotation, blend mode, overflow
  - Layout constraints (min/max width/height)

- **Smart sizing in export JSX** — respect auto-layout sizing modes
  - `HUG` → no width/height (content-sized)
  - `FILL` → `w="fill"` / `h="fill"`
  - `FIXED` → `w={200}` / `h={100}`

- **Semantic HTML in export** — automatically convert to semantic HTML elements

  ```bash
  figma-use export jsx 1:23              # Input → <input>, Button → <button>
  figma-use export storybook             # Same for storybook
  figma-use export jsx --no-semantic-html # Disable conversion
  ```

  Detection based on component names: `Input/*`, `Button/*`, `Checkbox/*`, etc.

- **`node replace-with`** — replace node with another node or JSX from stdin

  ```bash
  figma-use node replace-with <id> --target <component-id>  # Creates instance
  echo '<Frame .../>' | figma-use node replace-with <id> --stdin
  ```

- **`analyze snapshot`** — extract accessibility tree from Figma designs
  ```bash
  figma-use analyze snapshot              # Full page
  figma-use analyze snapshot <id> -i      # Interactive elements only
  figma-use analyze snapshot --depth 6    # Limit depth
  ```
  Detects roles from component names and structure: button, checkbox, radio, switch, slider, textbox, combobox, tab, link, table, list, separator, dialog, etc.

- **`comment watch`** — wait for new comments (for agent automation)
  ```bash
  figma-use comment watch                 # Wait indefinitely
  figma-use comment watch --timeout 60    # Exit after 60s if no comment
  figma-use comment watch --json          # JSON output with target_node
  ```
  Returns comment text, author, and `target_node` (exact element under the comment pin).

- **`comment resolve`** — mark comment as resolved
  ```bash
  figma-use comment resolve <comment-id>
  ```

### Removed

- **culori dependency** — unused color parsing library
  If target is a component, creates an instance. Otherwise clones the node.

- **`node ancestors`** — get parent chain from node to page root

  ```bash
  figma-use node ancestors <id>           # Up to 10 ancestors
  figma-use node ancestors <id> --depth 5 # Limit depth
  ```

- **`node bindings`** — get variable bindings for fills and strokes

  ```bash
  figma-use node bindings <id>            # Show bound variables
  ```

- **`page bounds`** — get bounding box of all objects on current page

  ```bash
  figma-use page bounds                   # Returns minX, maxX, suggestedX, etc.
  ```

  Useful for finding free space to place new components.

- **`variable find`** — search variables by name pattern

  ```bash
  figma-use variable find "Text/Neutral"  # Substring match
  figma-use variable find "Color" --type COLOR --limit 10
  ```

- **`<instance>` in render** — create component instances in JSX render

  ```tsx
  <frame>
    <instance component="59763:10626" />
  </frame>
  ```

- **`analyze` commands** — design analysis tools for discovery and audit

  **`analyze clusters`** — find repeated patterns (potential components)

  ```bash
  figma-use analyze clusters                # Find all clusters
  figma-use analyze clusters --limit 10     # Show top 10
  figma-use analyze clusters --min-count 5  # Min 5 instances
  ```

  Uses fuzzy matching with size buckets. Shows confidence score.

  **`analyze colors`** — color palette usage

  ```bash
  figma-use analyze colors                  # Colors by frequency
  figma-use analyze colors --show-similar   # Find similar colors to merge
  ```

  Shows variable names (`$Colors/Neutral/200`). Same hex with different variables shown separately.

  **`analyze typography`** — font usage map

  ```bash
  figma-use analyze typography              # All font combinations
  figma-use analyze typography --group-by size   # Group by size
  figma-use analyze typography --group-by family # Group by family
  ```

  **`analyze spacing`** — gap and padding values

  ```bash
  figma-use analyze spacing                 # All spacing values
  figma-use analyze spacing --grid 8        # Warn if not divisible by 8
  ```

- **V8 compile cache** — 25% faster startup on repeated runs (Node.js 22+)

- **`lint` command** (experimental) — design linter with 17 rules for consistency, accessibility, and best practices

  ```bash
  figma-use lint                          # Recommended preset
  figma-use lint --page "Components"      # Lint specific page by name
  figma-use lint --preset strict          # Stricter rules
  figma-use lint --preset accessibility   # A11y rules only
  figma-use lint --rule color-contrast    # Specific rule
  figma-use lint -v                       # Verbose with suggestions
  figma-use lint --json                   # JSON output for CI
  figma-use lint --list-rules             # Show all available rules
  ```

  **Rules by category:**

  | Category      | Rules                                                                                      |
  | ------------- | ------------------------------------------------------------------------------------------ |
  | Design Tokens | `no-hardcoded-colors`, `consistent-spacing`, `consistent-radius`, `effect-style-required`  |
  | Layout        | `prefer-auto-layout`, `pixel-perfect`                                                      |
  | Typography    | `text-style-required`, `min-text-size`, `no-mixed-styles`                                  |
  | Accessibility | `color-contrast`, `touch-target-size`                                                      |
  | Structure     | `no-default-names`, `no-hidden-layers`, `no-deeply-nested`, `no-empty-frames`, `no-groups` |
  | Components    | `no-detached-instances`                                                                    |

  **Presets:** `recommended`, `strict`, `accessibility`, `design-system`

- New `packages/linter/` — standalone linting engine with ESLint-inspired architecture
  - `defineRule()` helper for creating custom rules
  - Configurable severity per rule (error/warning/info/off)
  - Auto-fix support for fixable rules
  - Console and JSON reporters

- **`set text-resize` command** — control text auto-resize mode

  ```bash
  figma-use set text-resize <id> height          # Wrap text to width
  figma-use set text-resize <id> width-and-height # Auto-size both dimensions
  figma-use set text-resize <id> none            # Fixed size
  figma-use set text-resize <id> truncate        # Truncate with ellipsis
  ```

- **TEXT component properties in Storybook export** — editable text props

  ```tsx
  // Figma component with TEXT property "label" becomes:
  export function Button({ label, variant }: ButtonProps) {
    return (
      <Frame>
        <Text>{label}</Text>
      </Frame>
    )
  }

  // Stories get editable args:
  export const Primary: StoryObj<typeof Button> = {
    args: { label: 'Click me', variant: 'Primary' }
  }
  ```

- **`textAutoResize` in node tree** — shows text resize mode for TEXT nodes

- **`init` command** — create `.figma-use.json` config file

  ```bash
  figma-use init                    # Create with defaults
  figma-use init --force            # Overwrite existing
  figma-use init --preset strict    # Use strict lint preset
  ```

- **`.figma-use.json` config file** — unified configuration for lint, storybook export, and formatting
  ```json
  {
    "lint": { "preset": "recommended" },
    "storybook": {
      "page": "Components",
      "out": "./stories",
      "matchIcons": true,
      "preferIcons": ["lucide", "tabler"],
      "iconThreshold": 0.85,
      "framework": "react"
    },
    "format": {
      "pretty": true,
      "semi": false,
      "singleQuote": true
    }
  }
  ```
  CLI arguments override config values. Config is auto-loaded from current directory or parents.

### Changed

- **Improved ComponentSet export** — now combines VARIANT and TEXT properties
  - VARIANT props control which JSX variant to render
  - TEXT props become editable string props in the component
  - Stories include args for both variant selection and text editing

### Fixed

- **TypeScript module not found** — moved `typescript` from devDependencies to dependencies, fixing `ERR_MODULE_NOT_FOUND` error when running via `npx figma-use` or `bunx figma-use` ([#2](https://github.com/dannote/figma-use/issues/2))

- **JSX export improvements**
  - Include white color (`#FFFFFF`) in icon exports
  - Skip hidden nodes (`visible: false`) in JSX generation
  - Increase icon aspect ratio tolerance from 1.5 to 2 (for lock icons etc)

## [0.10.1] - 2026-01-21

### Fixed

- Show install hint when `oxfmt` is missing for `--pretty` flag

  ```
  oxfmt is required for --pretty. Install it:

    npm install -D oxfmt
  ```

## [0.10.0] - 2026-01-21

### Added

- **`export jsx` command** — export Figma nodes as JSX components

  ```bash
  figma-use export jsx <node-id>           # Minified output
  figma-use export jsx <node-id> --pretty  # Formatted with oxfmt
  ```

  Features:
  - Generates TypeScript AST (not string concatenation)
  - Recognizes Iconify icons by name pattern → `<Icon name="lucide:save" />`
  - Exports vectors as inline SVG → `<SVG src="..." />`
  - Format options: `--semi`, `--single-quote`, `--tabs`, `--tab-width`, `--trailing-comma`

- **`diff jsx` command** — compare nodes as formatted JSX

  ```bash
  figma-use diff jsx <from-id> <to-id>
  ```

  Shows colorized unified diff of JSX representations.

- **`<Icon>` element in JSX** — render Iconify icons

  ```tsx
  <Icon name="lucide:heart" size={24} color="#EF4444" />
  ```

  150k+ icons from Iconify, loaded on demand.

- **`<Section>` element** — create Figma sections (distinct from frames)

### Changed

- **Switched from Prettier to oxfmt** for code formatting
  - Faster Rust-based formatter
  - Import sorting with customizable groups
  - Optional dependency (graceful fallback if not installed)

- **`FormatOptions` type** now re-exported from `oxfmt`

### Internal

- Consolidated `FigmaNode` interface into `types.ts`
- Replaced raw ANSI escape codes with `picocolors`
- Added comprehensive tests for `export jsx` and `diff jsx`

## [0.9.2] - 2026-01-21

### Added

- **`<Image>` element** — load images from URL in JSX

  ```tsx
  <Image src="https://example.com/photo.jpg" w={200} h={150} />
  ```

- **Import support in stdin** — use familiar module syntax

  ```tsx
  import { Frame, Text, defineComponent } from 'figma-use/render'

  export default () => (
    <Frame>
      <Text>Hello</Text>
    </Frame>
  )
  ```

## [0.9.1] - 2026-01-21

### Fixed

- Add missing `svgpath` and `fontoxpath` dependencies for RPC bundle

## [0.9.0] - 2026-01-21

### Changed

- **BREAKING: Direct CDP communication** — no more proxy server or plugin required!

  ```bash
  # Old way (removed)
  figma-use proxy &
  # Open Figma → Plugins → Development → Figma Use

  # New way
  open -a Figma --args --remote-debugging-port=9222
  figma-use status  # Ready!
  ```

- **Simplified architecture** — CLI talks directly to Figma via Chrome DevTools Protocol
  - Removed `packages/proxy/` (WebSocket server)
  - Removed `packages/cli/src/multiplayer/` (Kiwi protocol)
  - Removed Figma plugin installation requirement
  - RPC code built on-demand with esbuild (no more 374KB embedded bundle)

- **CLI bundle size reduced** — 1.85MB → 1.1MB (-41%)

- **Runtime-agnostic** — CLI now works with both Node.js and Bun

- **Package renamed** — `@dannote/figma-use` → `figma-use`

  ```bash
  npx figma-use status
  bunx figma-use status
  ```

- **Faster startup** — no WebSocket handshake, no plugin initialization

- **New JSX renderer** — uses Figma Widget API (`createNodeFromJSXAsync`) instead of custom reconciler
  - Simpler architecture: components return TreeNode, processed on Figma side
  - Custom JSX runtime for `.figma.tsx` files (`@jsxImportSource`)
  - All style shorthands processed in `rpc.ts`

### Added

- **`node delete` and `node clone` support multiple IDs** — operate on several nodes at once

  ```bash
  figma-use node delete 1:23 1:24 1:25
  figma-use node clone 1:23 1:24 1:25
  ```

- **Grid layout support** — CSS Grid for 2D layouts in both CLI and JSX
  ```bash
  figma-use set layout <id> --mode GRID --cols "100px 1fr 100px" --rows "auto" --gap 16
  ```
  In JSX:
  ```tsx
  <Frame style={{ display: 'grid', cols: '1fr 1fr 1fr', rows: 'auto auto', gap: 16 }}>
    <Frame style={{ bg: '#FF6B6B' }} />
    <Frame style={{ bg: '#4ECDC4' }} />
    ...
  </Frame>
  ```
  Supports `px`, `fr`, and `auto`/`hug` in template syntax. Separate gaps with `colGap` and `rowGap`.

### Changed (MCP)

- **MCP server is now standalone** — `figma-use mcp serve` instead of running with proxy
  ```bash
  figma-use mcp serve              # Start on port 38451
  figma-use mcp serve --port 8080  # Custom port
  ```

### Removed

- `figma-use proxy` command (no longer needed)
- `figma-use plugin install/uninstall` commands (no plugin required)
- Multi-file support via proxy (use multiple Figma windows instead)
- `file list/select` commands (use multiple Figma windows instead)

## [0.8.0] - 2026-01-20

### Added

- **`query` command** — XPath selectors for finding nodes (powered by fontoxpath)

  ```bash
  figma-use query "//FRAME"                              # All frames
  figma-use query "//FRAME[@width < 300]"                # Frames narrower than 300px
  figma-use query "//COMPONENT[starts-with(@name, 'Button')]"  # Name starts with
  figma-use query "//FRAME[contains(@name, 'Card')]"     # Name contains
  figma-use query "//SECTION/FRAME"                      # Direct children
  figma-use query "//SECTION//TEXT"                      # All descendants
  figma-use query "//*[@cornerRadius > 0]"               # Any node with radius
  ```

  Full XPath 3.1 support: axes, predicates, functions, arithmetic

- **Multi-file support** — proxy now supports multiple simultaneous plugin connections
  - Each plugin instance registers with fileKey and fileName
  - `file list` — show all connected files
  - `file select <name>` — switch active file (partial match supported)
  - `status` shows all connected files with active marker
- **Connector commands** — work with connector lines
  - `connector list` — list connectors on current page
  - `connector get <id>` — get connector details (endpoints, stroke, line type)
  - `connector set <id>` — update connector properties (stroke, weight, line type, caps)
  - `connector create` — create connector (FigJam only, Figma API limitation)

- **`figma_render` MCP tool** — render JSX via MCP protocol

- **MCP.md** — documentation for Model Context Protocol integration

### Changed

- Extracted `transformJsxSnippet` to separate module for reuse

### Fixed

- `@dannote/figma-use/render` — missing `color.ts` in published package
- Proxy connection cleanup on plugin disconnect

## [0.7.1] - 2026-01-19

### Changed

- SKILL.md rewritten — structure like README, compact best practices
- `render --examples` updated — added Icon, shorthands, `--x`/`--y` examples
- README: added visual diff example with images

## [0.7.0] - 2026-01-19

### Changed

- README rewritten — focused on concepts, moved command list to REFERENCE.md
- Added REFERENCE.md with full list of 100+ commands

### Added

- **`page current`** — show current page name and ID

  ```bash
  figma-use page current         # Page 1 (0:1)
  figma-use page current --json  # {"id": "0:1", "name": "Page 1"}
  ```

- **`create icon`** — add icons from Iconify (150k+ icons from 100+ sets)

  ```bash
  figma-use create icon mdi:home
  figma-use create icon lucide:star --size 48 --color "#FFD700"
  figma-use create icon heroicons:bell-solid --component  # as Figma component
  ```

  Supports: mdi, lucide, heroicons, tabler, fa-solid, fa-regular, ri, ph, carbon, fluent, ion, bi, and more.

- **Variable references in CLI color options** — use `var:Name` or `$Name` syntax:

  ```bash
  figma-use create rect --x 0 --y 0 --width 100 --height 100 --fill 'var:Colors/Primary'
  figma-use create icon mdi:home --color '$Brand/Accent'
  ```

- **`<Icon>` primitive for JSX render** — 150k+ Iconify icons:

  ```jsx
  <Frame style={{ flexDirection: 'row', gap: 8 }}>
    <Icon icon="mdi:home" size={24} color="#3B82F6" />
    <Icon icon="lucide:star" size={32} color="#F59E0B" />
  </Frame>
  ```

  Icons are auto-preloaded before render.

- **Tailwind-like style shorthands** for JSX render:
  - Size: `w`, `h` → `width`, `height`
  - Colors: `bg` → `backgroundColor`, `rounded` → `borderRadius`
  - Padding: `p`, `pt`, `pr`, `pb`, `pl`, `px`, `py`
  - Layout: `flex` (`"row"` | `"col"`), `justify`, `items`
  - Text: `size`, `font`, `weight` → `fontSize`, `fontFamily`, `fontWeight`

  ```jsx
  // Before (178 chars)
  <Frame style={{paddingLeft: 16, paddingRight: 16, backgroundColor: "#3B82F6", borderRadius: 6, flexDirection: "row"}}>

  // After (73 chars)
  <Frame style={{px: 16, bg: "#3B82F6", rounded: 6, flex: "row"}}>
  ```

- **`render --x` and `--y` options** — position rendered root at specific coordinates

### Changed

- README rewritten — focused on concepts, moved command list to REFERENCE.md
- Added REFERENCE.md with full list of 100+ commands
- CLI arguments now use kebab-case: `--stroke-weight`, `--font-size`, `--min-width`, etc.

### Fixed

- Icon child ordering in render
- White fill removed from imported SVG icons
- Test isolation and multiplayer test reliability
- TypeScript types in .figma.tsx fixtures
- ComponentSet global registry to avoid module duplication

## [0.6.3] - 2026-01-19

### Added

- **`diff visual`** — create visual diff between two nodes as PNG
  ```bash
  figma-use diff visual --from <id1> --to <id2> --output diff.png
  ```
  Red pixels show differences. Options: `--scale`, `--threshold`

### Changed

- `set rotation` now uses `--angle` flag instead of positional argument (fixes negative values like `--angle -15`)

## [0.6.2] - 2026-01-19

### Added

- `bun run format` — format code with oxfmt
- `bun run lint` — lint code with oxlint

## [0.6.1] - 2026-01-19

### Added

- **`diff` commands** (experimental) — incremental updates via unified diff patches
  - `diff create --from <id> --to <id>` — compare two node trees and generate patch
  - `diff apply` — apply a patch to Figma nodes (validates old values!)
  - `diff show` — show diff between current state and new properties

  ```bash
  # Compare two frames (e.g., before/after, A/B variants)
  figma-use diff create --from 123:456 --to 789:012

  # Apply patch (validates old values match)
  figma-use diff apply --stdin < patch.diff

  # Dry run
  figma-use diff apply --stdin --dry-run < patch.diff
  ```

- Uses `diff` library for unified diff parsing and validation

### Fixed

- `--timeout` now applies to single commands (e.g., `eval`) via proxy `/command`
- CLI now works after global install ([#1](https://github.com/dannote/figma-use/issues/1))
- Move `kiwi-schema` to devDependencies (already bundled into dist)

## [0.6.0] - 2026-01-18

### Added

- **`node bounds`** — get node position, size, center point, edges
- **`path` commands** — vector path manipulation:
  - `path get <id>` — read SVG path data
  - `path set <id> "M..."` — replace path data
  - `path move <id> --dx --dy` — translate all points
  - `path scale <id> --factor` — scale from center
  - `path flip <id> --axis x|y` — mirror horizontally/vertically
- Uses [svgpath](https://github.com/fontello/svgpath) library for path transformations
- Path command tests

## [0.5.9] - 2026-01-18

### Changed

- Version now read from package.json instead of hardcoded

## [0.5.8] - 2026-01-18

### Added

- `page create` command documented in SKILL.md
- Auto-layout (hug contents) tests for render

### Fixed

- **JSX render hug contents** — auto-layout frames now correctly calculate size from children
  - `trigger-layout` moved from proxy to CLI (ensures multiplayer nodes are visible)
  - Plugin retries node lookup with exponential backoff
  - Switching sizingMode FIXED→AUTO forces Figma to recalculate

## [0.5.7] - 2026-01-18

### Fixed

- Font family and style now shown in `node tree` output

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
  - Dry run: `--dry-run` outputs NodeChanges JSON
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
