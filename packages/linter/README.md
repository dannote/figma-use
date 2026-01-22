# Figma Design Linter

A design linting engine for Figma, inspired by ESLint/Stylelint. Helps teams maintain design consistency, enforce design system rules, and catch accessibility issues.

## Installation

The linter is integrated into figma-use CLI:

```bash
figma-use lint
```

## Usage

### Basic Usage

```bash
# Lint current page with recommended preset
figma-use lint

# Lint specific frame
figma-use lint --root "1:234"

# Use strict preset
figma-use lint --preset strict

# Run specific rules only
figma-use lint --rule color-contrast --rule touch-target-size

# Verbose output with suggestions
figma-use lint -v

# JSON output (for CI/CD)
figma-use lint --json
```

### List Available Rules

```bash
figma-use lint --list-rules
```

## Presets

| Preset | Description |
|--------|-------------|
| `recommended` | Balanced defaults for most projects |
| `strict` | Stricter rules for production-ready designs |
| `accessibility` | Focus on a11y rules only |
| `design-system` | Maximum strictness for design system libraries |

## Rules

### Design Tokens

| Rule | Description | Fixable |
|------|-------------|---------|
| `no-hardcoded-colors` | Colors should use variables | ✅ |
| `consistent-spacing` | Spacing values should follow the scale (8pt grid) | ✅ |
| `consistent-radius` | Corner radius should use design system values | ✅ |

### Layout

| Rule | Description | Fixable |
|------|-------------|---------|
| `prefer-auto-layout` | Frames with children should use Auto Layout | |
| `pixel-perfect` | No subpixel values (x, y, width, height) | ✅ |

### Typography

| Rule | Description | Fixable |
|------|-------------|---------|
| `text-style-required` | Text should use shared text styles | |
| `min-text-size` | Text must be at least 12px | ✅ |

### Accessibility

| Rule | Description | Fixable |
|------|-------------|---------|
| `color-contrast` | Text contrast ≥ 4.5:1 (AA) or 7:1 (AAA) | |
| `touch-target-size` | Interactive elements ≥ 44x44px | ✅ |

### Naming & Structure

| Rule | Description | Fixable |
|------|-------------|---------|
| `no-default-names` | No "Frame 1", "Rectangle 5" etc. | |
| `no-hidden-layers` | Hidden layers may be unused | ✅ |
| `no-deeply-nested` | Max 6 levels of nesting | |
| `no-empty-frames` | Frames should have content or fill | |

## Configuration

Create `.figmalintrc.yaml` in your project:

```yaml
extends: recommended

rules:
  no-hardcoded-colors: error
  consistent-spacing:
    severity: warning
    options:
      base: 8
      allowedValues: [0, 4, 8, 12, 16, 24, 32, 48, 64]
  
  color-contrast:
    severity: error
    options:
      level: AA  # or AAA
  
  touch-target-size:
    severity: warning
    options:
      minSize: 44

ignore:
  - "**/Drafts/**"
```

## Programmatic API

```typescript
import { createLinter, formatReport } from '@anthropic-tools/figma-linter'

const linter = createLinter({
  preset: 'recommended',
  variables: figmaVariables, // For suggesting variable fixes
})

const result = linter.lint(figmaNodes)

console.log(formatReport(result))
// or
console.log(JSON.stringify(result))
```

## Creating Custom Rules

```typescript
import { defineRule } from '@anthropic-tools/figma-linter'

export default defineRule({
  meta: {
    id: 'my-custom-rule',
    category: 'design-tokens',
    description: 'My custom design rule',
    fixable: false,
  },

  match: ['FRAME', 'COMPONENT'],

  check(node, context) {
    if (someCondition) {
      context.report({
        node,
        message: 'Something is wrong',
        suggest: 'How to fix it',
      })
    }
  },
})
```

## Severity Levels

- `error` - Will exit with code 1 (blocks CI)
- `warning` - Reported but doesn't fail
- `info` - Informational only
- `off` - Rule disabled

## Output Format

### Console (default)

```
✖ Header/Title (1:234)
    error    Contrast ratio 2.1:1 is below AA threshold (4.5:1)    color-contrast
    warning  Touch target 32x32 is below minimum 44x44              touch-target-size

⚠ Card/Body (1:567)
    warning  Frame with 3 children doesn't use Auto Layout         prefer-auto-layout
    info     Layer name "Frame 42" is not descriptive              no-default-names

────────────────────────────────────────────────────────────────
✖ 1 error  ⚠ 2 warnings  ℹ 1 info

Run with --fix to auto-fix 1 issue
```

### JSON

```json
{
  "messages": [
    {
      "ruleId": "color-contrast",
      "severity": "error",
      "message": "Contrast ratio 2.1:1 is below AA threshold (4.5:1)",
      "nodeId": "1:234",
      "nodeName": "Title",
      "nodePath": ["Header", "Title"]
    }
  ],
  "errorCount": 1,
  "warningCount": 2,
  "infoCount": 1,
  "fixableCount": 1
}
```
