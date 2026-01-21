import { defineCommand } from 'citty'

import get from './get.ts'
import set from './set.ts'
import zoomToFit from './zoom-to-fit.ts'

export default defineCommand({
  meta: { description: 'Viewport operations' },
  subCommands: {
    get,
    set,
    'zoom-to-fit': zoomToFit
  }
})
