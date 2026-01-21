import { defineCommand } from 'citty'

import flip from './flip.ts'
import get from './get.ts'
import move from './move.ts'
import scale from './scale.ts'
import set from './set.ts'

export default defineCommand({
  meta: { description: 'Vector path operations' },
  subCommands: {
    get,
    set,
    move,
    scale,
    flip
  }
})
