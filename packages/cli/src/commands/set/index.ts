import { defineCommand } from 'citty'
import fill from './fill.ts'
import stroke from './stroke.ts'
import strokeAlign from './stroke-align.ts'
import radius from './radius.ts'
import opacity from './opacity.ts'
import rotation from './rotation.ts'
import visible from './visible.ts'
import locked from './locked.ts'
import text from './text.ts'
import font from './font.ts'
import fontRange from './font-range.ts'
import effect from './effect.ts'
import layout from './layout.ts'
import constraints from './constraints.ts'
import blend from './blend.ts'
import image from './image.ts'
import props from './props.ts'
import minmax from './minmax.ts'

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
