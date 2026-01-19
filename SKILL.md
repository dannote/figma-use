---
name: figma-use
description: Control Figma via CLI — create shapes, frames, text, components, set styles, layout, variables, export images. Use when asked to create/modify Figma designs or automate design tasks.
---

# Figma Use

Full control over Figma from the command line.

## Before You Start

**Always check connection first:**

```bash
figma-use status
```

If not connected:
```bash
# 1. Start proxy (keep running in background)
figma-use proxy &

# 2. Start Figma with debug port (for render command)
figma --remote-debugging-port=9222

# 3. In Figma: Plugins → Development → Figma Use
```

If plugin not installed:
```bash
# Quit Figma first, then:
figma-use plugin install
```

---

## ⚠️ Incremental Updates via Diff (Experimental)

**After initial render, NEVER re-render the full JSX tree.**

Use unified diff patches to apply targeted changes with validation:

> ⚠️ **Experimental:** `diff` commands are new and may change.

### Compare two frames and generate patch
```bash
# Compare original vs modified version
figma-use diff create --from 123:456 --to 789:012
```

Output (unified diff format):
```diff
--- /Card/Header #123:457
+++ /Card/Header #789:013
@@ -1,5 +1,5 @@
 type: FRAME
 size: 200 50
 pos: 0 0
-fill: #FFFFFF
+fill: #F0F0F0
-opacity: 0.8
+opacity: 1
```

⚠️ **Don't forget space prefix on context lines** — `size: 48 40` will fail, ` size: 48 40` works.

### Apply patch (validates old values!)
```bash
# Dry run — preview changes
figma-use diff apply patch.diff --dry-run

# Apply changes (fails if old values don't match)
figma-use diff apply patch.diff

# Force apply (skip validation)
figma-use diff apply patch.diff --force

# From stdin
cat patch.diff | figma-use diff apply --stdin
```

### Visual diff (PNG)
```bash
figma-use diff visual --from <id1> --to <id2> --output diff.png
figma-use diff visual --from <id1> --to <id2> --output diff.png --threshold 0.05  # Stricter
```

Red pixels show differences. Useful for verifying modifications.

### Workflow: Iterative design with critique

1. **Render initial design:**
   ```bash
   cat design.jsx | figma-use render --stdin --json > nodes.json
   ```

2. **Get critique, then generate patch:**
   ```bash
   # Clone and modify (or compare to another frame)
   figma-use diff create --from <original> --to <modified>
   ```

3. **Apply patch to original:**
   ```bash
   figma-use diff apply --stdin < changes.diff
   ```

### Direct commands (for simple changes)
```bash
figma-use set fill <id> "#FF0000"
figma-use set opacity <id> 0.5
figma-use node resize <id> --width 300 --height 200
figma-use node move <id> --x 100 --y 200
figma-use node delete <id>
```

---

## JSX Rendering (Fastest Way)

Use `render --stdin` with **pure JSX only**. No variables, no functions, no imports — just JSX tags:

```bash
echo '<Frame style={{p: 24, gap: 16, flex: "col", bg: "#FFF", rounded: 12}}>
  <Text style={{size: 24, weight: "bold", color: "#000"}}>Card Title</Text>
  <Text style={{size: 14, color: "#666"}}>Description text here</Text>
</Frame>' | figma-use render --stdin
```

⚠️ **stdin does NOT support:** `const`, `let`, `function`, `defineComponent`, `defineComponentSet`, ternary operators, or any JavaScript logic. Only literal JSX.

**Elements:** `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`

**Style props (with shorthands):**

| Shorthand | Full | Values |
|-----------|------|--------|
| `w`, `h` | `width`, `height` | number |
| `bg` | `backgroundColor` | hex color |
| `rounded` | `borderRadius` | number |
| `p`, `pt`, `pr`, `pb`, `pl` | `padding*` | number |
| `px`, `py` | paddingLeft+Right, paddingTop+Bottom | number |
| `flex` | `flexDirection` | `"row"`, `"col"` |
| `justify` | `justifyContent` | `"start"`, `"end"`, `"center"`, `"between"`, `"evenly"` |
| `items` | `alignItems` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `size` | `fontSize` | number |
| `font` | `fontFamily` | string |
| `weight` | `fontWeight` | `"bold"`, number |

Also: `gap`, `opacity`, `color`, `borderColor`, `borderWidth`, `textAlign`, `x`, `y`

### Auto-Layout (Hug Contents)

Frames with `flex` automatically calculate size from children:

```bash
# Height calculated as 50 + 10 (gap) + 30 = 90
echo '<Frame style={{w: 200, flex: "col", gap: 10}}>
  <Frame style={{w: 200, h: 50, bg: "#00FF00"}} />
  <Frame style={{w: 200, h: 30, bg: "#0000FF"}} />
</Frame>' | figma-use render --stdin
```

**Limitation:** Row layout without explicit width collapses to 1×1 — always set `w` on row containers

### Buttons Example (3 sizes)

Since stdin doesn't support variables, write out each variant explicitly:

```bash
echo '<Frame name="Buttons" style={{gap: 16, flex: "row", p: 24}}>
  <Frame name="Small" style={{px: 12, py: 6, bg: "#3B82F6", rounded: 6, flex: "row", justify: "center", items: "center"}}>
    <Text style={{size: 12, color: "#FFF"}}>Button</Text>
  </Frame>
  <Frame name="Medium" style={{px: 16, py: 8, bg: "#3B82F6", rounded: 6, flex: "row", justify: "center", items: "center"}}>
    <Text style={{size: 14, color: "#FFF"}}>Button</Text>
  </Frame>
  <Frame name="Large" style={{px: 24, py: 12, bg: "#3B82F6", rounded: 6, flex: "row", justify: "center", items: "center"}}>
    <Text style={{size: 16, color: "#FFF"}}>Button</Text>
  </Frame>
</Frame>' | figma-use render --stdin
```

### Converting Frames to Components

```bash
figma-use node to-component <id>           # Single frame
figma-use node to-component "1:2 1:3 1:4"  # Multiple frames
```

### Grouping and Auto-Layout

```bash
figma-use group create "1:2 1:3"           # Group nodes (auto-converts to frame)
figma-use set layout <id> --mode HORIZONTAL --gap 8 --padding 16
```

Note: Groups auto-convert to frames after sync, so `set layout` works immediately.

### Advanced: ComponentSets with Variants (via files)

For proper Figma ComponentSets with variant properties, create a `.figma.tsx` file:

```bash
figma-use render --examples  # Full API reference
figma-use render ./MyComponent.figma.tsx
```

---

## CLI Commands

### Create

```bash
figma-use create page "Page Name"
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
figma-use create rect --width 100 --height 50 --fill "#FF0000" --radius 8
figma-use create ellipse --width 80 --height 80 --fill "#00FF00"
figma-use create text --text "Hello" --font-size 24 --fill "#000"
figma-use create line --length 100 --stroke "#000"
figma-use create icon mdi:home --size 24 --color "#000"        # Iconify icon
figma-use create icon lucide:star --size 48 --component        # as Figma component
```

**Icons:** 150k+ from Iconify — `mdi:*`, `lucide:*`, `heroicons:*`, `tabler:*`, `fa-solid:*`, `ph:*`, etc. Browse: https://icon-sets.iconify.design/

### Query

```bash
figma-use node get <id>           # Node properties
figma-use node tree               # Page structure
figma-use node tree --depth 2     # Limit depth
figma-use node children <id>      # Children list
figma-use find --name "Button"    # Find by name
figma-use find --type FRAME       # Find by type
figma-use selection get           # Current selection
```

### Modify

```bash
figma-use set fill <id> "#FF0000"
figma-use set stroke <id> "#000" --weight 2
figma-use set radius <id> 12
figma-use set opacity <id> 0.5
figma-use set text <id> "New text"
figma-use set font <id> --family "Inter" --style "Bold" --size 20
figma-use set font-range <id> --start 0 --end 5 --style Bold --color "#FF0000"
figma-use set layout <id> --mode VERTICAL --gap 12 --padding 16
figma-use node move <id> --x 100 --y 200
figma-use node resize <id> --width 300 --height 200
figma-use node delete <id>
```

### Import

```bash
figma-use import --svg '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
figma-use import --svg "$(cat icon.svg)" --x 100 --y 200
```

### Export

```bash
figma-use export node <id> --output design.png
figma-use export screenshot --output viewport.png
figma-use export selection --output selection.png
```

### Navigate

```bash
figma-use page list
figma-use page set "Page Name"
figma-use viewport zoom-to-fit <ids...>
figma-use viewport get
figma-use viewport set --x 100 --y 200 --zoom 1.5
```

**Always zoom after creating elements** — otherwise the user won't see what you made:
```bash
figma-use viewport zoom-to-fit <created-node-id>
```

### Variables & Styles

```bash
figma-use variable list
figma-use variable create "Primary" --collection <id> --type COLOR --value "#3B82F6"
figma-use style list
figma-use style create-paint "Brand/Primary" --color "#E11D48"
```

**Variable references in CLI:** Use `var:Name` or `$Name` in any color option (`--fill`, `--stroke`, `--color`):
```bash
figma-use create rect --x 0 --y 0 --width 100 --height 100 --fill 'var:Primary'
figma-use create icon mdi:home --color '$Brand/Accent'
figma-use set fill <id> 'var:Colors/Primary'
figma-use set stroke <id> '$Brand/Border'
```

### Fonts

```bash
figma-use font list                  # All available fonts
figma-use font list --family Roboto  # Filter by family name
```

### Comments & History

Requires Figma running with `--remote-debugging-port=9222`:

```bash
figma-use comment list                       # List file comments
figma-use comment add "Review this"          # Add comment
figma-use comment add "Here" --x 200 --y 100 # Comment at position
figma-use comment add "Reply" --reply <id>   # Reply to comment
figma-use comment delete <id>                # Delete comment
figma-use version list                       # Version history
figma-use me                                 # Current user info
figma-use file info                          # File key and name
```

### Escape Hatch

```bash
figma-use eval "return figma.currentPage.name"
figma-use eval "figma.createRectangle().resize(100, 100)"
```

---

## Output

Human-readable by default. Add `--json` for machine parsing.

## Colors

Hex format: `#RGB`, `#RRGGBB`, `#RRGGBBAA`

## Node IDs

Format: `sessionID:localID` (e.g., `1:2`, `45:123`). Get from `figma-use selection get` or `figma-use node tree`.

---

## Best Practices

### Always Verify Visually

After any operation, export a screenshot to confirm the result:

```bash
figma-use export node <id> --scale 0.5 --output /tmp/check.png  # Overview
figma-use export node <id> --scale 2 --output /tmp/detail.png   # Details
```

For modifications, use visual diff to highlight changes:

```bash
# Before modifying, export original
figma-use export node <id> --output /tmp/before.png

# After changes, compare visually
figma-use diff visual --from <original-id> --to <modified-id> --output /tmp/diff.png
```

Red pixels = differences. Use `--threshold 0.05` for stricter comparison.

### Copying Elements Between Pages

`node clone` creates a copy in the same parent. To move to another page:

```bash
figma-use node clone <source-id> --json | jq -r '.id'  # Get new ID
figma-use node set-parent <new-id> --parent <target-page-or-frame-id>
figma-use node move <new-id> --x 50 --y 50  # Reposition (coordinates reset)
```

### Working with Sections

Sections organize components on a page. Elements must be explicitly moved inside:

```bash
figma-use create section --name "Buttons" --x 0 --y 0 --width 600 --height 200
figma-use node set-parent <component-id> --parent <section-id>
figma-use node move <component-id> --x 50 --y 50  # Position inside section
```

⚠️ **Deleting a section deletes all children inside it!**

### Building a Component from Existing Design

```bash
# 1. Find and copy the element
figma-use find --name "Button"
figma-use node clone <id> --json | jq -r '.id'

# 2. Move to components page/section
figma-use node set-parent <new-id> --parent <section-id>
figma-use node move <new-id> --x 50 --y 50

# 3. Rename with proper naming convention
figma-use node rename <new-id> "Button/Primary"

# 4. Convert to component
figma-use node to-component <new-id>

# 5. Verify
figma-use export node <section-id> --scale 0.5 --output /tmp/check.png
```

### Replacing Frames with Component Instances

When copying a composite element (like a dialog), nested elements are frames, not instances. To use existing components:

```bash
# Delete the frame
figma-use node delete <frame-id>

# Create instance of the component
figma-use create instance --component <component-id> --x 50 --y 50 --parent <parent-id>
```

### Instance Element IDs

Elements inside instances have composite IDs: `I<instance-id>;<internal-id>`

```bash
figma-use set text "I123:456;789:10" "New text"  # Modify text inside instance
```

### Finding Elements by Properties

```bash
figma-use find --type FRAME 2>&1 | grep "stroke: #EF4444"  # Red border
figma-use find --type TEXT 2>&1 | grep "Bold"              # Bold text
```

---

## Vector Drawing

Work iteratively: bounds → draw → screenshot → adjust → repeat.

### Path Commands

```bash
figma-use node bounds <id>                    # Position, size, center
figma-use create vector --path "M 0 0 L 100 50 Z" --fill "#F00"
figma-use path get <id>                       # Read path data
figma-use path set <id> "M 0 0 L 100 100 Z"   # Replace path
figma-use path move <id> --dx 10 --dy -5      # Translate points
figma-use path scale <id> --factor 1.5        # Scale from center
figma-use path flip <id> --axis x             # Mirror horizontally
figma-use path flip <id> --axis y             # Mirror vertically
```

### SVG Path Syntax

```
M x y       Move to          L x y       Line to
H x         Horizontal to    V y         Vertical to
C x1 y1 x2 y2 x y   Cubic Bezier    Q x1 y1 x y   Quadratic Bezier
Z           Close path
```

### Iterative Workflow

```bash
# 1. Create canvas, get bounds
figma-use create frame --width 300 --height 300 --fill "#F0F4FF" --name "Drawing"
figma-use node bounds 123:456

# 2. Draw shape with Bezier curves
figma-use create vector --path "M 80 180 C 50 180 50 140 80 140 C 180 130 200 150 180 195 Z" --fill "#FFD700" --parent 123:456

# 3. Screenshot to verify
figma-use export node 123:456 --output /tmp/check.png

# 4. Adjust if needed
figma-use path scale 123:457 --factor 0.9
figma-use path move 123:457 --dx 20 --dy 0

# 5. Get bounds of first shape, position next relative to it
figma-use node bounds 123:457
```

### Common Shapes

```bash
# Triangle
figma-use create vector --path "M 50 0 L 100 100 L 0 100 Z" --fill "#F00"

# Star
figma-use create vector --path "M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z" --fill "#FFD700"

# Heart
figma-use create vector --path "M 50 90 C 20 60 0 30 25 10 C 40 0 50 10 50 25 C 50 10 60 0 75 10 C 100 30 80 60 50 90 Z" --fill "#E11D48"

# Arrow right
figma-use create vector --path "M 0 20 L 60 20 L 60 10 L 80 25 L 60 40 L 60 30 L 0 30 Z" --fill "#000"
```

### Complex Illustrations

For intricate artwork, import SVG instead:

```bash
figma-use import --svg "$(cat icon.svg)"
```
