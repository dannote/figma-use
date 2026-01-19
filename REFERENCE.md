# Command Reference

Complete list of all figma-use commands. For conceptual overview see [README.md](./README.md).

## Create

```bash
figma-use create frame --width 400 --height 300 --fill "#FFF" --radius 12 --layout VERTICAL --gap 16
figma-use create rect --width 100 --height 50 --fill "#FF0000" --radius 8
figma-use create ellipse --width 80 --height 80 --fill "#00FF00"
figma-use create text --text "Hello" --font-size 24 --fill "#000"
figma-use create line --length 100 --stroke "#000"
figma-use create polygon --sides 6 --radius 50 --fill "#0000FF"
figma-use create star --points 5 --inner-radius 20 --outer-radius 50 --fill "#FFD700"
figma-use create vector --path "M 0 0 L 100 50 L 0 100 Z" --fill "#F00"
figma-use create component --width 200 --height 100
figma-use create instance --component <id>
figma-use create section --name "Section" --x 0 --y 0 --width 600 --height 400
figma-use create page "Page Name"
figma-use create slice --width 100 --height 100
figma-use create icon mdi:home --size 24 --color "#000"
figma-use create icon lucide:star --size 48 --component  # as Figma component
```

All create commands support `--x`, `--y`, `--parent <id>`, `--name "Name"`.

Color options (`--fill`, `--stroke`, `--color`) accept hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) or variable references (`var:Colors/Primary`, `$Colors/Primary`).

## Set (Modify)

```bash
figma-use set fill <id> "#FF0000"
figma-use set fill <id> "var:Colors/Primary"
figma-use set stroke <id> "#000" --weight 2
figma-use set stroke-align <id> INSIDE|CENTER|OUTSIDE
figma-use set radius <id> 12
figma-use set radius <id> --top-left 8 --top-right 8 --bottom-left 0 --bottom-right 0
figma-use set opacity <id> 0.5
figma-use set rotation <id> 45
figma-use set visible <id> true|false
figma-use set locked <id> true|false
figma-use set text <id> "New text"
figma-use set font <id> --family "Inter" --style "Bold" --size 20
figma-use set font-range <id> --start 0 --end 5 --style Bold --color "#FF0000"
figma-use set effect <id> --type DROP_SHADOW --radius 10 --color "#00000040" --offset-x 0 --offset-y 4
figma-use set effect <id> --type LAYER_BLUR --radius 8
figma-use set layout <id> --mode VERTICAL|HORIZONTAL|NONE --gap 12 --padding 16
figma-use set layout <id> --wrap --gap 8
figma-use set constraints <id> --horizontal LEFT|RIGHT|CENTER|SCALE --vertical TOP|BOTTOM|CENTER|SCALE
figma-use set blend <id> NORMAL|MULTIPLY|SCREEN|OVERLAY|...
figma-use set image <id> ./path/to/image.png
figma-use set props <id> --prop "Text=Hello" --prop "Visible=true"
figma-use set minmax <id> --min-width 100 --max-width 500
```

## Node Operations

```bash
figma-use node get <id>                    # Get node properties
figma-use node get <id> --json             # JSON output
figma-use node tree                        # Page structure as tree
figma-use node tree --depth 3              # Limit depth
figma-use node tree <id>                   # Tree from specific node
figma-use node children <id>               # List direct children
figma-use node bounds <id>                 # Position, size, center point
figma-use node delete <id>
figma-use node clone <id>                  # Clone in same parent
figma-use node clone <id> --parent <pid>   # Clone to different parent
figma-use node rename <id> "New Name"
figma-use node move <id> --x 100 --y 200
figma-use node move <id> --dx 10 --dy -5   # Relative move
figma-use node resize <id> --width 300 --height 200
figma-use node set-parent <id> --parent <pid>
figma-use node to-component <id>           # Convert frame to component
figma-use node to-component "1:2 1:3 1:4"  # Multiple frames
```

## Find & Select

```bash
figma-use find --name "Button"             # Find by name (partial match)
figma-use find --name "Button" --exact     # Exact name match
figma-use find --type FRAME|TEXT|RECTANGLE|ELLIPSE|COMPONENT|INSTANCE|...
figma-use find --name "Icon" --type FRAME
figma-use selection get                    # Get selected nodes
figma-use selection set "1:2 1:3"          # Set selection by IDs
```

## Export

```bash
figma-use export node <id> --output design.png
figma-use export node <id> --output design.svg --format svg
figma-use export node <id> --output design.pdf --format pdf
figma-use export node <id> --scale 2       # 2x resolution
figma-use export selection --output sel.png
figma-use export screenshot --output viewport.png
```

## Pages & Viewport

```bash
figma-use page current
figma-use page list
figma-use page set "Page Name"
figma-use page set <page-id>
figma-use viewport get
figma-use viewport set --x 100 --y 200 --zoom 1.5
figma-use viewport zoom-to-fit <id>
figma-use viewport zoom-to-fit "1:2 1:3 1:4"
```

## Variables & Collections

```bash
figma-use variable list
figma-use variable list --collection <id>
figma-use variable get <id>
figma-use variable create "Primary" --collection <id> --type COLOR --value "#3B82F6"
figma-use variable create "Spacing/MD" --collection <id> --type FLOAT --value 16
figma-use variable set <id> --value "#FF0000"
figma-use variable set <id> --value "#FF0000" --mode "Dark"
figma-use variable delete <id>
figma-use variable bind <node-id> --variable <var-id> --field fills

figma-use collection list
figma-use collection get <id>
figma-use collection create "Colors" --modes "Light,Dark"
figma-use collection delete <id>
```

## Styles

```bash
figma-use style list
figma-use style create-paint "Brand/Primary" --color "#E11D48"
figma-use style create-text "Heading/H1" --family "Inter" --size 32 --weight 700
figma-use style create-effect "Shadow/MD" --type DROP_SHADOW --radius 10 --color "#00000040"
```

## Vector Paths

```bash
figma-use path get <id>
figma-use path set <id> "M 0 0 L 100 100 L 0 100 Z"
figma-use path move <id> --dx 10 --dy -5
figma-use path scale <id> --factor 1.5
figma-use path scale <id> --factor 0.5 --origin-x 50 --origin-y 50
figma-use path flip <id> --axis x
figma-use path flip <id> --axis y
```

## Boolean Operations

```bash
figma-use boolean union "1:2 1:3"
figma-use boolean subtract "1:2 1:3"       # First minus rest
figma-use boolean intersect "1:2 1:3"
figma-use boolean exclude "1:2 1:3"
```

## Groups

```bash
figma-use group create "1:2 1:3 1:4"
figma-use group ungroup <group-id>
figma-use group flatten <id>               # Flatten to single vector
```

## Components

```bash
figma-use component add-prop <id> --name "Label" --type TEXT --default "Button"
figma-use component add-prop <id> --name "ShowIcon" --type BOOLEAN --default true
figma-use component add-prop <id> --name "Size" --type VARIANT
figma-use component edit-prop <id> --name "Label" --default "Click me"
figma-use component delete-prop <id> --name "Label"
```

## Diff (Experimental)

```bash
figma-use diff create --from <id1> --to <id2>
figma-use diff create --from <id1> --to <id2> --output patch.diff
figma-use diff show <id> --fill "#FF0000" --opacity 0.5  # Show what would change
figma-use diff apply patch.diff
figma-use diff apply --stdin < patch.diff
figma-use diff apply patch.diff --dry-run
figma-use diff apply patch.diff --force    # Skip validation
figma-use diff visual --from <id1> --to <id2> --output diff.png
figma-use diff visual --from <id1> --to <id2> --threshold 0.05
```

## Import

```bash
figma-use import --svg '<svg>...</svg>'
figma-use import --svg "$(cat icon.svg)"
figma-use import --svg "$(cat icon.svg)" --x 100 --y 200
```

## Comments & Versions

```bash
figma-use comment list
figma-use comment add "Review this section"
figma-use comment add "Check alignment" --x 200 --y 100
figma-use comment add "Reply text" --reply <comment-id>
figma-use comment delete <id>
figma-use version list
```

## File & User Info

```bash
figma-use file info                        # File key and name
figma-use me                               # Current user info
figma-use get pages                        # All pages
figma-use get components                   # All components
figma-use get styles                       # All local styles
```

## Fonts

```bash
figma-use font list
figma-use font list --family "Inter"
figma-use font list --family "Roboto" --json
```

## System

```bash
figma-use status                           # Check connection
figma-use proxy                            # Start proxy server
figma-use proxy --port 8080                # Custom port
figma-use plugin install                   # Install plugin (quit Figma first)
figma-use plugin list                      # List development plugins
figma-use mcp                              # Show MCP config snippet
figma-use profile <command>                # Profile command via CDP
```

## Eval (Escape Hatch)

```bash
figma-use eval "return figma.currentPage.name"
figma-use eval "figma.currentPage.selection.map(n => n.name)"
figma-use eval "figma.createRectangle().resize(100, 100)"
```

## Render

```bash
figma-use render ./Component.figma.tsx
figma-use render ./Component.figma.tsx --props '{"title": "Hello"}'
echo '<Frame style={{w: 100, h: 100, bg: "#F00"}} />' | figma-use render --stdin
figma-use render --examples                # Show API reference
```

## Output Formats

All commands support `--json` for machine-readable output:

```bash
figma-use node get <id> --json
figma-use find --type FRAME --json
figma-use variable list --json
```

## Node ID Format

- Regular nodes: `session:local` (e.g., `1:23`, `45:678`)
- Elements inside instances: `I<instance-id>;<internal-id>` (e.g., `I1:23;4:56`)

Get IDs from `figma-use selection get` or `figma-use node tree`.

## Color Format

- Hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
- Variable reference: `var:Variable/Name` or `$Variable/Name`
