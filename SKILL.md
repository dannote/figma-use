---
name: figma-bridge
description: Control Figma documents via CLI. Use when user asks to create, modify, or inspect Figma designs programmatically - creating shapes, frames, text, components, setting colors, layout, or reading document structure.
---

# Figma Bridge

CLI to control Figma through a local proxy server.

## Setup

1. Start proxy: `cd ~/Development/figma-bridge/packages/proxy && bun dev`
2. In Figma: Plugins → Development → Import plugin from manifest → `~/Development/figma-bridge/packages/plugin/manifest.json`
3. Run the plugin (keep window open)

## Usage

```bash
cd ~/Development/figma-bridge/packages/cli
bun run dev <command> [options]
```

## Commands

### Read

```bash
status                            # Check plugin connection
getPages                          # List pages
getSelection                      # Get selected nodes
getNode --id <id>                 # Get node by ID
getComponents                     # List all components
```

### Create

```bash
createRectangle --x 0 --y 0 --width 100 --height 100 [--name "Rect"] [--parentId "1:2"]
createFrame --x 0 --y 0 --width 100 --height 100 [--name "Frame"] [--parentId "1:2"]
createText --x 0 --y 0 --text "Hello" [--fontSize 14] [--fontName "Inter"] [--fontWeight 400] [--fontColor "#000000FF"] [--name "Text"] [--parentId "1:2"]
createInstance --componentId "1:2" [--x 0] [--y 0] [--name "Instance"] [--parentId "1:3"]
createComponent --name "Button" [--parentId "1:2"]
cloneNode --id "1:2"
```

### Update

```bash
moveNode --id "1:2" --x 100 --y 200
resizeNode --id "1:2" --width 200 --height 150
setFillColor --id "1:2" --color "#FF0000FF"
setStrokeColor --id "1:2" --color "#0000FFFF"
setCornerRadius --id "1:2" --radius 8 [--topLeft 4] [--topRight 4] [--bottomLeft 4] [--bottomRight 4]
setParent --id "1:2" --parentId "1:3"
setLayout --id "1:2" --mode HORIZONTAL [--wrap] [--clip] [--itemSpacing 8] [--paddingLeft 16] [--paddingRight 16] [--paddingTop 16] [--paddingBottom 16] [--primaryAxisAlign CENTER] [--counterAxisAlign CENTER] [--sizingVertical HUG] [--sizingHorizontal FILL]
setInstanceProperties --id "1:2" --properties '{"prop": "value"}'
setComponentPropertyRefs --id "1:2" --refs '{"characters": "propName"}'
```

### Component Properties

```bash
addComponentProperty --componentId "1:2" --name "Label" --type TEXT --defaultValue "Button"
editComponentProperty --componentId "1:2" --name "Label" --type TEXT --defaultValue "New" [--preferredValues '["A","B"]']
deleteComponentProperty --componentId "1:2" --name "Label"
```

Types: `BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, `VARIANT`

### Delete

```bash
deleteNode --id "1:2"
```

## Node IDs

Format: `pageIndex:nodeIndex` (e.g., `1:2`, `45:123`)

Get IDs via `getSelection`, `getComponents`, or Figma Dev Mode (Copy link → ID in URL).

## Colors

Hex format with alpha: `#RRGGBBAA` (e.g., `#FF0000FF` = red, `#00000080` = 50% black)

## Layout Modes

- `NONE` - No auto-layout
- `HORIZONTAL` - Row
- `VERTICAL` - Column

Alignment: `MIN`, `MAX`, `CENTER`, `SPACE_BETWEEN`

Sizing: `FIXED`, `HUG`, `FILL`
