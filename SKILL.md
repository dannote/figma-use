---
name: figma-use
description: Control Figma via CLI — create shapes, frames, text, components, set styles, layout, export images. Use when asked to create/modify Figma designs, transfer web UI to Figma, or automate design tasks.
---

# Figma Use

Full control over Figma from the command line. 73 commands for creating, styling, and exporting designs.

## Setup

```bash
# Install globally
bun install -g @dannote/figma-use

# Install plugin (quit Figma first!)
figma-use plugin

# Start proxy
figma-use proxy

# Open Figma → Plugins → Development → Figma Use
```

## Quick Reference

### Create Shapes (with inline styles)

All create commands support inline styling — no need for separate set-* calls:

```bash
# Rectangle with fill, stroke, radius, opacity in one command
figma-use create-rectangle --x 0 --y 0 --width 100 --height 50 \
  --fill "#3B82F6" --stroke "#1D4ED8" --strokeWeight 2 --radius 8 --opacity 0.9

figma-use create-ellipse --x 0 --y 0 --width 50 --height 50 --fill "#10B981"
figma-use create-line --x 0 --y 0 --length 100 --stroke "#000"
figma-use create-polygon --x 0 --y 0 --radius 30 --sides 6 --fill "#F59E0B"
figma-use create-star --x 0 --y 0 --outerRadius 30 --innerRadius 15 --points 5 --fill "#EF4444"
```

### Create Containers (with layout)

Frames support auto-layout directly in create command:

```bash
# Frame with fill, radius, and auto-layout
figma-use create-frame --x 0 --y 0 --width 400 --height 300 \
  --fill "#FFF" --radius 12 --name "Card" \
  --layoutMode VERTICAL --itemSpacing 16 --padding "24,24,24,24"

# Horizontal layout with gap
figma-use create-frame --x 0 --y 0 --width 200 --height 48 \
  --fill "#3B82F6" --radius 8 --name "Button" \
  --layoutMode HORIZONTAL --itemSpacing 8 --padding "12,24,12,24"

figma-use create-component --x 0 --y 0 --width 200 --height 40 --name "Button"
figma-use create-instance --componentId "1:23" --x 100 --y 100
figma-use create-section --x 0 --y 0 --width 800 --height 600 --name "Hero"
```

### Create Text (with font styles)

```bash
# Text with font, size, color in one command
figma-use create-text --x 0 --y 0 --text "Hello" \
  --fontSize 24 --fontFamily "Inter" --fontStyle "Bold" --fill "#000"

figma-use set-text --id "1:5" --text "New content"
figma-use set-font --id "1:5" --family "Inter" --style "Bold" --size 18
figma-use set-text-properties --id "1:5" --textAlign CENTER --lineHeight 1.5
```

### Styling

```bash
figma-use set-fill-color --id "1:2" --color "#FF0000"
figma-use set-stroke-color --id "1:2" --color "#000" --weight 2
figma-use set-stroke-align --id "1:2" --align INSIDE  # INSIDE | CENTER | OUTSIDE
figma-use set-corner-radius --id "1:2" --radius 12
figma-use set-corner-radius --id "1:2" --topLeft 16 --bottomRight 16  # individual corners
figma-use set-opacity --id "1:2" --opacity 0.8
figma-use set-effect --id "1:2" --type DROP_SHADOW --radius 10 --offsetX 0 --offsetY 4 --color "#00000040"
figma-use set-blend-mode --id "1:2" --mode MULTIPLY
```

### Auto-Layout

```bash
figma-use set-auto-layout --id "1:2" --mode VERTICAL --gap 12 --padding 16
figma-use set-auto-layout --id "1:2" --mode HORIZONTAL --gap 8 --paddingX 24 --paddingY 16
figma-use set-layout-child --id "1:3" --align STRETCH  # child sizing: FILL | HUG | FIXED
```

### Transform

```bash
figma-use move-node --id "1:2" --x 100 --y 200
figma-use resize-node --id "1:2" --width 300 --height 200
figma-use set-rotation --id "1:2" --angle 45
figma-use set-parent --id "1:2" --parentId "1:10"
```

### Query

```bash
figma-use status                    # Check plugin connection
figma-use get-selection             # Get selected nodes
figma-use get-node --id "1:2"       # Get node properties
figma-use get-children --id "1:2"   # List children
figma-use find-by-name --name "Button"
figma-use get-pages
figma-use get-components
figma-use get-local-styles
```

### Export

```bash
figma-use export-node --id "1:2" --format PNG --scale 2 --output design.png
figma-use screenshot --output viewport.png
figma-use export-selection --format PNG --scale 2 --output selection.png
```

### SVG Import

```bash
# Save SVG to file first, then import
figma-use import-svg --svg "$(cat icon.svg)" --x 0 --y 0 --parentId "1:2"
```

### Eval — Execute Arbitrary Code

For anything not covered by commands, use `eval` to run JavaScript directly in Figma:

```bash
# Simple expressions
figma-use eval "return figma.currentPage.selection.length"

# Create nodes
figma-use eval "const r = figma.createRectangle(); r.resize(100, 100); return r.id"

# Async operations (top-level await supported)
figma-use eval "const node = await figma.getNodeByIdAsync('1:2'); return node.name"

# Complex operations
figma-use eval "
  const frame = figma.createFrame();
  frame.resize(200, 100);
  frame.layoutMode = 'HORIZONTAL';
  frame.itemSpacing = 8;
  return { id: frame.id };
"
```

See [Figma Plugin API](https://www.figma.com/plugin-docs/api/api-reference/) for available methods.

## Output Format

Human-readable by default. Add `--json` for machine parsing:

```bash
figma-use get-node --id "1:2" --json
```

## Colors

Hex format: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`

```bash
--fill "#F00"        # short red
--fill "#FF0000"     # red
--fill "#FF000080"   # red 50% opacity
```

## Node IDs

Format: `pageIndex:nodeIndex` (e.g., `1:2`, `45:123`)

Get IDs from:
- `figma-use get-selection`
- `figma-use get-children --id "1:2"`
- Figma → right-click → Copy link → ID in URL (`node-id=1:2`)
