import { defineCommand } from 'citty'

import bounds from './bounds.ts'
import children from './children.ts'
import clone from './clone.ts'
import deleteCmd from './delete.ts'
import get from './get.ts'
import move from './move.ts'
import rename from './rename.ts'
import resize from './resize.ts'
import setParent from './set-parent.ts'
import toComponent from './to-component.ts'
import tree from './tree.ts'

export default defineCommand({
  meta: { description: 'Node operations' },
  subCommands: {
    get,
    tree,
    children,
    delete: deleteCmd,
    clone,
    rename,
    move,
    resize,
    'set-parent': setParent,
    'to-component': toComponent,
    bounds
  }
})
