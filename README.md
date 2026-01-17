# Figma Bridge

Minimal proxy server to control Figma via CLI.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐       HTTP        ┌─────────────┐
│   Figma     │ ←────────────────→ │   Proxy     │ ←───────────────→ │    CLI      │
│   Plugin    │                    │   Server    │                   │             │
└─────────────┘                    └─────────────┘                   └─────────────┘
```

## Setup

```bash
bun install
```

## Usage

### 1. Start the proxy server

```bash
cd packages/proxy && bun dev
```

### 2. Install Figma plugin

```bash
cd packages/plugin && bun run build
```

In Figma: Plugins → Development → Import plugin from manifest → select `packages/plugin/manifest.json`

### 3. CLI

```bash
cd packages/cli
bun run dev <command> [options]
```

## Commands

### Status & Info

```bash
figma status                      # Check if plugin is connected
figma getPages                    # List all pages
figma getSelection                # Get current selection
figma getNode --id <id>           # Get node info
figma getComponents               # Get all components
```

### Create

```bash
figma createRectangle --x 0 --y 0 --width 100 --height 100 [--name "Rect"] [--parentId "1:2"]
figma createFrame --x 0 --y 0 --width 100 --height 100 [--name "Frame"] [--parentId "1:2"]
figma createText --x 0 --y 0 --text "Hello" [--fontSize 14] [--fontName "Inter"] [--fontWeight 400] [--fontColor "#000000FF"] [--name "Text"] [--parentId "1:2"]
figma createInstance --componentId "1:2" [--x 0] [--y 0] [--name "Instance"] [--parentId "1:3"]
figma createComponent --name "Button" [--parentId "1:2"]
figma cloneNode --id "1:2"
```

### Update

```bash
figma moveNode --id "1:2" --x 100 --y 200
figma resizeNode --id "1:2" --width 200 --height 150
figma setFillColor --id "1:2" --color "#FF0000FF"
figma setStrokeColor --id "1:2" --color "#0000FFFF"
figma setCornerRadius --id "1:2" --radius 8 [--topLeft 4] [--topRight 4] [--bottomLeft 4] [--bottomRight 4]
figma setParent --id "1:2" --parentId "1:3"
figma setLayout --id "1:2" --mode HORIZONTAL [--wrap] [--clip] [--itemSpacing 8] [--paddingLeft 16] ...
figma setInstanceProperties --id "1:2" --properties '{"prop1": "value1"}'
figma setComponentPropertyRefs --id "1:2" --refs '{"characters": "prop1"}'
```

### Component Properties

```bash
figma addComponentProperty --componentId "1:2" --name "Label" --type TEXT --defaultValue "Button"
figma editComponentProperty --componentId "1:2" --name "Label" --type TEXT --defaultValue "New" [--preferredValues '["A","B"]']
figma deleteComponentProperty --componentId "1:2" --name "Label"
```

### Delete

```bash
figma deleteNode --id "1:2"
```

## Environment Variables

- `FIGMA_PROXY_URL` - Proxy server URL (default: `http://localhost:38451`)
