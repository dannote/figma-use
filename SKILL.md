---
name: figma-use
description: Control Figma via CLI — create shapes, frames, text, components, set styles, layout, variables, export images. Use when asked to create/modify Figma designs or automate design tasks.
---

# figma-use

CLI for Figma. Two modes: commands and JSX.

```bash
# Commands
figma-use create frame --width 400 --height 300 --fill "#FFF" --layout VERTICAL --gap 16
figma-use create icon mdi:home --size 32 --color "#3B82F6"
figma-use set fill 1:23 "$Colors/Primary"

# JSX (props directly on elements, NOT style={{}})
echo '<Frame p={24} bg="#3B82F6" rounded={12}>
  <Text size={18} color="#FFF">Hello</Text>
</Frame>' | figma-use render --stdin --x 100 --y 100
```

## Before You Start

```bash
figma-use status  # Check connection
```

If not connected — start Figma with remote debugging:

```bash
# macOS
open -a Figma --args --remote-debugging-port=9222

# Windows
"%LOCALAPPDATA%\Figma\Figma.exe" --remote-debugging-port=9222

# Linux
figma --remote-debugging-port=9222
```

> Figma 126+ blocks remote debugging. Run `figma-use patch` once to fix, then restart Figma. Click **Always Allow** on the keychain prompt. Re-run after Figma updates.
>
> **Can't patch?** Use `figma-use daemon start --pipe` — launches Figma with debug pipe, no patching needed.

Start Figma with `--remote-debugging-port=9222` and you're ready.

## Two Modes

**Imperative** — single operations:

```bash
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12
figma-use set fill <id> "#FF0000"
figma-use node move <id> --x 100 --y 200
```

**Declarative** — render JSX trees:

```bash
echo '<Frame p={24} gap={16} flex="col" bg="#FFF" rounded={12}>
  <Text size={24} weight="bold" color="#000">Title</Text>
  <Text size={14} color="#666">Description</Text>
</Frame>' | figma-use render --stdin --x 100 --y 200
```

stdin supports both pure JSX and full module syntax with imports:

```tsx
import { Frame, Text, defineComponent } from 'figma-use/render'

const Button = defineComponent(
  'Button',
  <Frame bg="#3B82F6" p={12} rounded={6}>
    <Text color="#FFF">Click</Text>
  </Frame>
)

export default () => (
  <Frame flex="row" gap={8}>
    <Button />
    <Button />
  </Frame>
)
```

**Elements:** `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`, `Icon`, `Image`, `Instance`

Use `<Instance>` to create component instances:

```tsx
<Frame flex="row" gap={8}>
  <Instance component="59763:10626" />
  <Instance component="59763:10629" />
</Frame>
```

⚠️ **Always use `--x` and `--y`** to position renders. Don't stack everything at (0, 0).

## Icons

150k+ icons from Iconify by name:

```bash
figma-use create icon mdi:home
figma-use create icon lucide:star --size 48 --color "#F59E0B"
figma-use create icon heroicons:bell-solid --component  # as Figma component
```

In JSX:

```tsx
<Icon name="mdi:home" size={24} color="#3B82F6" />
```

## Images

Load images from URL:

```tsx
<Image src="https://example.com/photo.jpg" w={200} h={150} />
```

## Export JSX

Convert Figma nodes back to JSX code:

```bash
figma-use export jsx <id>           # Minified
figma-use export jsx <id> --pretty  # Formatted

# Format options
figma-use export jsx <id> --pretty --semi --tabs

# Match vector shapes to Iconify icons (requires: npm i whaticon)
figma-use export jsx <id> --match-icons
figma-use export jsx <id> --match-icons --icon-threshold 0.85 --prefer-icons lucide,tabler
```

Round-trip workflow:

```bash
# Export → edit → re-render
figma-use export jsx <id> --pretty > component.tsx
# ... edit the file ...
figma-use render component.tsx --x 500 --y 0
```

Compare two nodes as JSX:

```bash
figma-use diff jsx <from-id> <to-id>
```

## Export Storybook (Experimental)

Export all components on current page as Storybook stories:

```bash
figma-use export storybook                      # Output to ./stories/
figma-use export storybook --out ./src/stories  # Custom output dir
figma-use export storybook --match-icons        # Match vectors to Iconify icons
figma-use export storybook --no-semantic-html   # Disable semantic HTML conversion
```

**Semantic HTML:** By default, components are converted to semantic HTML elements based on their names:

- `Input/*`, `TextField/*` → `<input type="text">`
- `Textarea/*` → `<textarea>`
- `Checkbox/*` → `<input type="checkbox">`
- `Radio/*` → `<input type="radio">`
- `Button/*` → `<button>`
- `Select/*`, `Dropdown/*` → `<select>`

Use `--no-semantic-html` to disable this and keep `<Frame>` elements.

Generates `.stories.tsx` files:

- **ComponentSets** → React component with props + stories with args
- **VARIANT properties** → Union type props (`variant?: 'Primary' | 'Secondary'`)
- **TEXT properties** → Editable string props (`label?: string`)
- Components grouped by `/` prefix → `Button/Primary`, `Button/Secondary` → `Button.stories.tsx`

Example output for Button with variant and label:

```tsx
// Button.tsx
export interface ButtonProps {
  label?: string
  variant?: 'Primary' | 'Secondary'
}
export function Button({ label, variant }: ButtonProps) {
  if (variant === 'Primary')
    return (
      <Frame>
        <Text>{label}</Text>
      </Frame>
    )
  // ...
}

// Button.stories.tsx
export const Primary: StoryObj<typeof Button> = {
  args: { label: 'Click', variant: 'Primary' }
}
```

## Variables as Tokens

Reference Figma variables in any color option with `var:Name` or `$Name`:

```bash
figma-use create rect --width 100 --height 100 --fill 'var:Colors/Primary'
figma-use set fill <id> '$Brand/Accent'
```

In JSX:

```tsx
<Frame bg="$Colors/Primary" />
<Text color="var:Text/Primary">Hello</Text>
```

## Style Shorthands

**Size & Position:**
| Short | Full | Values |
|-------|------|--------|
| `w`, `h` | width, height | number or `"fill"` |
| `minW`, `maxW` | minWidth, maxWidth | number |
| `minH`, `maxH` | minHeight, maxHeight | number |
| `x`, `y` | position | number |

**Layout:**
| Short | Full | Values |
|-------|------|--------|
| `flex` | flexDirection | `"row"`, `"col"` |
| `gap` | spacing | number |
| `wrap` | layoutWrap | `true` |
| `justify` | justifyContent | `"start"`, `"center"`, `"end"`, `"between"` |
| `items` | alignItems | `"start"`, `"center"`, `"end"` |
| `p`, `px`, `py` | padding | number |
| `pt`, `pr`, `pb`, `pl` | padding sides | number |
| `position` | layoutPositioning | `"absolute"` |
| `grow` | layoutGrow | number |
| `stretch` | layoutAlign | `true` → STRETCH |

**Appearance:**
| Short | Full | Values |
|-------|------|--------|
| `bg` | fill | hex or `$Variable` |
| `stroke` | strokeColor | hex |
| `strokeWidth` | strokeWeight | number |
| `strokeAlign` | strokeAlign | `"inside"`, `"outside"` |
| `opacity` | opacity | 0..1 |
| `blendMode` | blendMode | `"multiply"`, etc. |

**Corners:**
| Short | Full | Values |
|-------|------|--------|
| `rounded` | cornerRadius | number |
| `roundedTL/TR/BL/BR` | individual corners | number |
| `cornerSmoothing` | squircle smoothing | 0..1 (iOS style) |

**Effects:**
| Short | Full | Values |
|-------|------|--------|
| `shadow` | dropShadow | `"0px 4px 8px rgba(0,0,0,0.25)"` |
| `blur` | layerBlur | number |
| `overflow` | clipsContent | `"hidden"` |
| `rotate` | rotation | degrees |

**Text:**
| Short | Full | Values |
|-------|------|--------|
| `size` | fontSize | number |
| `weight` | fontWeight | `"bold"`, number |
| `font` | fontFamily | string |
| `color` | textColor | hex |

**Grid (CSS Grid layout):**
| Short | Full | Values |
|-------|------|--------|
| `display` | layoutMode | `"grid"` |
| `cols` | gridTemplateColumns | `"100px 1fr auto"` |
| `rows` | gridTemplateRows | `"auto auto"` |
| `colGap` | columnGap | number |
| `rowGap` | rowGap | number |

## Components (via .figma.tsx)

First call creates master, rest create instances:

```tsx
import { defineComponent, Frame, Text } from 'figma-use/render'

const Card = defineComponent(
  'Card',
  <Frame p={24} bg="#FFF" rounded={12}>
    <Text size={18} color="#000">
      Card
    </Text>
  </Frame>
)

export default () => (
  <Frame gap={16} flex="row">
    <Card />
    <Card />
  </Frame>
)
```

```bash
figma-use render ./Card.figma.tsx --x 100 --y 200
figma-use render --examples  # Full API reference
```

## Variants (ComponentSet)

```tsx
import { defineComponentSet, Frame, Text } from 'figma-use/render'

const Button = defineComponentSet(
  'Button',
  {
    variant: ['Primary', 'Secondary'] as const,
    size: ['Small', 'Large'] as const
  },
  ({ variant, size }) => (
    <Frame
      p={size === 'Large' ? 16 : 8}
      bg={variant === 'Primary' ? '#3B82F6' : '#E5E7EB'}
      rounded={8}
    >
      <Text color={variant === 'Primary' ? '#FFF' : '#111'}>
        {variant} {size}
      </Text>
    </Frame>
  )
)
```

Creates real ComponentSet with all combinations.

## Diffs

Compare frames and generate patch:

```bash
figma-use diff create --from <id1> --to <id2>
```

```diff
--- /Card/Header #123:457
+++ /Card/Header #789:013
 type: FRAME
 size: 200 50
-fill: #FFFFFF
+fill: #F0F0F0
```

⚠️ Context lines need space prefix: ` size: 200 50` not `size: 200 50`

Apply with validation:

```bash
figma-use diff apply patch.diff            # Fails if old values don't match
figma-use diff apply patch.diff --dry-run  # Preview
figma-use diff apply patch.diff --force    # Skip validation
```

Visual diff (red = changed pixels):

```bash
figma-use diff visual --from <id1> --to <id2> --output diff.png
```

⚠️ **After initial render, use diffs or direct commands.** Don't re-render full JSX trees.

## Query (XPath)

Find nodes using XPath selectors:

```bash
figma-use query "//FRAME"                              # All frames
figma-use query "//FRAME[@width < 300]"                # Frames narrower than 300px
figma-use query "//COMPONENT[starts-with(@name, 'Button')]"  # Name starts with
figma-use query "//FRAME[contains(@name, 'Card')]"     # Name contains
figma-use query "//SECTION/FRAME"                      # Direct children
figma-use query "//SECTION//TEXT"                      # All descendants
figma-use query "//*[@cornerRadius > 0]"               # Any node with radius
figma-use query "//FRAME[@width > 100 and @width < 500]"  # Range
```

Attributes: `name`, `width`, `height`, `x`, `y`, `cornerRadius`, `opacity`, `visible`, `characters`, `fontSize`, `layoutMode`, `itemSpacing`

XPath functions: `contains()`, `starts-with()`, `string-length()`, `not()`, `and`, `or`

## Common Commands

```bash
# Create
figma-use create frame --width 400 --height 300 --fill "#FFF" --layout VERTICAL --gap 16
figma-use create text --text "Hello" --font-size 24 --fill "#000"
figma-use create rect --width 100 --height 50 --fill "#F00" --radius 8

# Find
figma-use query "//FRAME[@name = 'Header']"
figma-use find --name "Button"
figma-use find --type FRAME
figma-use selection get

# Explore
figma-use node ancestors <id>              # Get parent chain (useful for navigation)
figma-use node bindings <id>               # Get variable bindings for fills/strokes
figma-use page bounds                      # Find free space for new objects
figma-use variable find "Text/Neutral"     # Search variables by name

# Modify
figma-use set fill <id> "#FF0000"
figma-use set radius <id> 12
figma-use set text <id> "New text"
figma-use set text-resize <id> height   # Wrap text (height auto, fixed width)
figma-use set layout <id> --mode VERTICAL --gap 12 --padding 16
figma-use set layout <id> --mode GRID --cols "1fr 1fr 1fr" --rows "auto" --gap 16
figma-use node move <id> --x 100 --y 200
figma-use node resize <id> --width 300 --height 200
figma-use node delete <id> [id2...]
figma-use arrange                              # Tidy up overlapping frames on canvas
figma-use node to-component <id>

# Export
figma-use export node <id> --output design.png
figma-use export screenshot --output viewport.png

# Navigate
figma-use page list
figma-use page set "Page Name"
figma-use viewport zoom-to-fit <id>

# Daemon (faster sequential commands)
figma-use daemon start                     # Background daemon
figma-use daemon start --pipe              # Launch Figma with debug pipe (no patching)
figma-use daemon stop
figma-use daemon status
```

Full reference: [REFERENCE.md](https://github.com/dannote/figma-use/blob/master/REFERENCE.md)

## Analyze

Discovery tools for understanding design systems:

```bash
# Repeated patterns — potential components
figma-use analyze clusters
figma-use analyze clusters --min-count 5

# Color palette
figma-use analyze colors                   # Usage frequency
figma-use analyze colors --show-similar    # Find similar colors to merge

# Typography
figma-use analyze typography               # All font combinations
figma-use analyze typography --group-by size

# Spacing
figma-use analyze spacing --grid 8         # Check 8px grid compliance

# Accessibility snapshot — extract interactive elements
figma-use analyze snapshot                 # Full page
figma-use analyze snapshot <id> -i         # Interactive only (buttons, inputs, etc.)
figma-use analyze snapshot --depth 6       # Limit depth
```

**Use cases:**

- **Component extraction** — find copy-pasted elements that should be components
- **Design audit** — identify inconsistencies, similar-but-different elements
- **Design system creation** — discover existing colors, typography, spacing patterns
- **Onboarding** — understand structure of unfamiliar design files

Output shows counts, examples, and warnings (e.g., off-grid spacing, hardcoded colors).

## Lint (Experimental)

Check designs for consistency and accessibility issues:

```bash
figma-use lint                          # Recommended preset
figma-use lint --page "Components"      # Lint specific page
figma-use lint --preset strict          # Stricter rules
figma-use lint --preset accessibility   # A11y only (contrast, touch targets)
figma-use lint --rule color-contrast    # Single rule
figma-use lint -v                       # With fix suggestions
figma-use lint --json                   # For CI/CD
figma-use lint --list-rules             # Show all rules
```

**Presets:** `recommended`, `strict`, `accessibility`, `design-system`

**17 rules:**

- Design tokens: `no-hardcoded-colors`, `consistent-spacing`, `consistent-radius`, `effect-style-required`
- Layout: `prefer-auto-layout`, `pixel-perfect`
- Typography: `text-style-required`, `min-text-size`, `no-mixed-styles`
- Accessibility: `color-contrast`, `touch-target-size`
- Structure: `no-default-names`, `no-hidden-layers`, `no-deeply-nested`, `no-empty-frames`, `no-groups`
- Components: `no-detached-instances`

Exit code 1 if errors found — use in CI pipelines.

## Output

Human-readable by default — **prefer this to save tokens**. Use `--json` only when you need to parse specific fields programmatically.

## Node IDs

Format: `session:local` (e.g., `1:23`). Inside instances: `I<instance-id>;<internal-id>`.

Get IDs from `figma-use selection get` or `figma-use node tree`.

## Colors

Hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
Variables: `var:Colors/Primary` or `$Colors/Primary`

---

## Best Practices

### Always verify visually

```bash
figma-use export node <id> --output /tmp/check.png
```

### Always zoom after creating

```bash
figma-use viewport zoom-to-fit <id>
```

### Position multiple renders separately

```bash
echo '...' | figma-use render --stdin --x 0 --y 0
echo '...' | figma-use render --stdin --x 500 --y 0    # Not at same position!
```

### Arrange after batch creation

After creating multiple frames/sections, run `arrange` to spread them out:

```bash
figma-use arrange --mode grid --gap 60       # Grid layout (default)
figma-use arrange --mode squarify --gap 60   # Smart packing for mixed sizes
```

### Copy between pages

```bash
figma-use node clone <id> [id2...] --json | jq -r '.[].id'
figma-use node set-parent <new-id> --parent <target-page-id>
figma-use node move <new-id> --x 50 --y 50
```

### Replace node

```bash
# Replace with component (creates instance)
figma-use node replace-with <id> --target <component-id>

# Replace with JSX from stdin
echo '<Icon name="lucide:x" size={16} />' | figma-use node replace-with <id> --stdin
```

### Convert to component

```bash
figma-use node to-component <id>
figma-use node to-component "1:2 1:3 1:4"  # Multiple
```

### Instance internal IDs

```bash
figma-use set text "I123:456;789:10" "New text"  # I<instance>;<internal>
```

### Row layout needs width

```bash
# ❌ Collapses to 1×1
<Frame flex="row" gap={8}>

# ✅ Explicit width
<Frame w={300} flex="row" gap={8}>
```

### Sections

```bash
figma-use create section --name "Buttons" --x 0 --y 0 --width 600 --height 200
figma-use node set-parent <id> --parent <section-id>
```

⚠️ Deleting section deletes all children!

### Comment-driven workflow

Wait for designer feedback and react:

```bash
figma-use comment watch --json
```

Output when comment arrives:
```json
{
  "id": "123456",
  "message": "Make this button bigger",
  "user": { "handle": "designer" },
  "client_meta": { "node_id": "1:23" }
}
```

Agent workflow — run once per comment, then restart:

1. `figma-use comment watch --json` — blocks until new comment
2. Parse the JSON, get `message` and `target_node` (exact element under comment)
3. Process the request (modify design, etc.)
4. Reply: `figma-use comment add "Done!" --reply <comment-id>`
5. Resolve: `figma-use comment resolve <comment-id>`
6. Exit. External runner restarts for next comment.

Options:
- `--timeout 60` — exit after 60s if no comment (returns `{"timeout":true}`)
- `--interval 5` — poll every 5s (default: 3s)

### Vector paths — iterative workflow

Draw, screenshot, adjust, repeat — like a designer tweaking Bezier curves:

```bash
# 1. Draw initial shape
figma-use create vector --path "M 50 0 L 100 100 L 0 100 Z" --fill "#F00"

# 2. Check result
figma-use export node <id> --output /tmp/shape.png

# 3. Adjust: scale, move, flip
figma-use path scale <id> --factor 0.8
figma-use path move <id> --dx 20 --dy -10
figma-use path flip <id> --axis x

# 4. Or replace path entirely
figma-use path set <id> "M 50 0 C 80 30 80 70 50 100 C 20 70 20 30 50 0 Z"

# 5. Screenshot again, repeat until good
figma-use export node <id> --output /tmp/shape.png
```

For complex illustrations, import SVG:

```bash
figma-use import --svg "$(cat icon.svg)"
```
