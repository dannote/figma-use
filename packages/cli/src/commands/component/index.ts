import { defineCommand } from 'citty'

import addProp from './add-prop.ts'
import combine from './combine.ts'
import deleteProp from './delete-prop.ts'
import editProp from './edit-prop.ts'

export default defineCommand({
  meta: { description: 'Component property operations' },
  subCommands: {
    'add-prop': addProp,
    combine: combine,
    'edit-prop': editProp,
    'delete-prop': deleteProp
  }
})
