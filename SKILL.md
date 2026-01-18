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
figma-use plugin
```

---

## JSX Rendering (Fastest Way)

Use `render --stdin` with **pure JSX only**. No variables, no functions, no imports — just JSX tags:

```bash
echo '<Frame style={{padding: 24, gap: 16, flexDirection: "column", backgroundColor: "#FFF", borderRadius: 12}}>
  <Text style={{fontSize: 24, fontWeight: "bold", color: "#000"}}>Card Title</Text>
  <Text style={{fontSize: 14, color: "#666"}}>Description text here</Text>
</Frame>' | figma-use render --stdin
```

⚠️ **stdin does NOT support:** `const`, `let`, `function`, `defineComponent`, `defineComponentSet`, ternary operators, or any JavaScript logic. Only literal JSX.

**Elements:** `Frame`, `Rectangle`, `Ellipse`, `Text`, `Line`, `Star`, `Polygon`, `Vector`, `Group`

**Style props:** `width`, `height`, `x`, `y`, `padding`, `paddingTop/Right/Bottom/Left`, `gap`, `flexDirection` (row|column), `justifyContent`, `alignItems`, `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`, `opacity`, `fontSize`, `fontFamily`, `fontWeight`, `color`, `textAlign`

### Buttons Example (3 sizes)

Since stdin doesn't support variables, write out each variant explicitly:

```bash
echo '<Frame name="Buttons" style={{gap: 16, flexDirection: "row", padding: 24}}>
  <Frame name="Small" style={{paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: "#3B82F6", borderRadius: 6, flexDirection: "row", justifyContent: "center", alignItems: "center"}}>
    <Text style={{fontSize: 12, color: "#FFF"}}>Button</Text>
  </Frame>
  <Frame name="Medium" style={{paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: "#3B82F6", borderRadius: 6, flexDirection: "row", justifyContent: "center", alignItems: "center"}}>
    <Text style={{fontSize: 14, color: "#FFF"}}>Button</Text>
  </Frame>
  <Frame name="Large" style={{paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, backgroundColor: "#3B82F6", borderRadius: 6, flexDirection: "row", justifyContent: "center", alignItems: "center"}}>
    <Text style={{fontSize: 16, color: "#FFF"}}>Button</Text>
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
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
figma-use create rect --width 100 --height 50 --fill "#FF0000" --radius 8
figma-use create ellipse --width 80 --height 80 --fill "#00FF00"
figma-use create text --text "Hello" --fontSize 24 --fill "#000"
figma-use create line --length 100 --stroke "#000"
```

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
