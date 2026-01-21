import { defineCommand } from 'citty'

import createEffect from './create-effect.ts'
import createPaint from './create-paint.ts'
import createText from './create-text.ts'
import list from './list.ts'

export default defineCommand({
  meta: { description: 'Style operations' },
  subCommands: {
    list,
    'create-paint': createPaint,
    'create-text': createText,
    'create-effect': createEffect
  }
})
