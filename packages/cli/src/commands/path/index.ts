import { defineCommand } from 'citty'
import get from './get.ts'
import set from './set.ts'
import move from './move.ts'
import scale from './scale.ts'
import flip from './flip.ts'

export default defineCommand({
  meta: { description: 'Vector path operations' },
  subCommands: {
    get,
    set,
    move,
    scale,
    flip,
  }
})
