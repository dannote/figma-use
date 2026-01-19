import { defineCommand } from 'citty'
import rect from './rect.ts'
import ellipse from './ellipse.ts'
import line from './line.ts'
import polygon from './polygon.ts'
import star from './star.ts'
import vector from './vector.ts'
import frame from './frame.ts'
import text from './text.ts'
import component from './component.ts'
import instance from './instance.ts'
import section from './section.ts'
import page from './page.ts'
import slice from './slice.ts'
import icon from './icon.ts'

export default defineCommand({
  meta: { description: 'Create nodes' },
  subCommands: {
    rect,
    ellipse,
    line,
    polygon,
    star,
    vector,
    frame,
    text,
    component,
    instance,
    section,
    page,
    slice,
    icon
  }
})
