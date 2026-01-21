import { defineCommand } from 'citty'

import jsx from './jsx.ts'
import node from './node.ts'
import screenshot from './screenshot.ts'
import selection from './selection.ts'

export default defineCommand({
  meta: { description: 'Export images and code' },
  subCommands: {
    node,
    selection,
    screenshot,
    jsx
  }
})
