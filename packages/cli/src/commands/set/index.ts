import { defineCommand } from 'citty'

import blend from './blend.ts'
import constraints from './constraints.ts'
import effect from './effect.ts'
import fill from './fill.ts'
import fontRange from './font-range.ts'
import font from './font.ts'
import image from './image.ts'
import layout from './layout.ts'
import locked from './locked.ts'
import minmax from './minmax.ts'
import opacity from './opacity.ts'
import props from './props.ts'
import radius from './radius.ts'
import rotation from './rotation.ts'
import strokeAlign from './stroke-align.ts'
import stroke from './stroke.ts'
import text from './text.ts'
import visible from './visible.ts'

export default defineCommand({
  meta: { description: 'Set node properties' },
  subCommands: {
    fill,
    stroke,
    'stroke-align': strokeAlign,
    radius,
    opacity,
    rotation,
    visible,
    locked,
    text,
    font,
    'font-range': fontRange,
    effect,
    layout,
    constraints,
    blend,
    image,
    props,
    minmax
  }
})
