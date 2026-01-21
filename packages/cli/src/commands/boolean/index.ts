import { defineCommand } from 'citty'

import exclude from './exclude.ts'
import intersect from './intersect.ts'
import subtract from './subtract.ts'
import union from './union.ts'

export default defineCommand({
  meta: { description: 'Boolean operations' },
  subCommands: {
    union,
    subtract,
    intersect,
    exclude
  }
})
