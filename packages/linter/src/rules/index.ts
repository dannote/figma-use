export { default as noHardcodedColors } from './no-hardcoded-colors.ts'
export { default as noDefaultNames } from './no-default-names.ts'
export { default as preferAutoLayout } from './prefer-auto-layout.ts'
export { default as consistentSpacing } from './consistent-spacing.ts'
export { default as consistentRadius } from './consistent-radius.ts'
export { default as colorContrast } from './color-contrast.ts'
export { default as touchTargetSize } from './touch-target-size.ts'
export { default as textStyleRequired } from './text-style-required.ts'
export { default as minTextSize } from './min-text-size.ts'
export { default as noHiddenLayers } from './no-hidden-layers.ts'
export { default as noDeeplyNested } from './no-deeply-nested.ts'
export { default as noEmptyFrames } from './no-empty-frames.ts'
export { default as pixelPerfect } from './pixel-perfect.ts'
export { default as noGroups } from './no-groups.ts'
export { default as effectStyleRequired } from './effect-style-required.ts'
export { default as noMixedStyles } from './no-mixed-styles.ts'
export { default as noDetachedInstances } from './no-detached-instances.ts'

import noHardcodedColors from './no-hardcoded-colors.ts'
import noDefaultNames from './no-default-names.ts'
import preferAutoLayout from './prefer-auto-layout.ts'
import consistentSpacing from './consistent-spacing.ts'
import consistentRadius from './consistent-radius.ts'
import colorContrast from './color-contrast.ts'
import touchTargetSize from './touch-target-size.ts'
import textStyleRequired from './text-style-required.ts'
import minTextSize from './min-text-size.ts'
import noHiddenLayers from './no-hidden-layers.ts'
import noDeeplyNested from './no-deeply-nested.ts'
import noEmptyFrames from './no-empty-frames.ts'
import pixelPerfect from './pixel-perfect.ts'
import noGroups from './no-groups.ts'
import effectStyleRequired from './effect-style-required.ts'
import noMixedStyles from './no-mixed-styles.ts'
import noDetachedInstances from './no-detached-instances.ts'

import type { Rule } from '../core/types.ts'

export const allRules: Record<string, Rule> = {
  'no-hardcoded-colors': noHardcodedColors,
  'no-default-names': noDefaultNames,
  'prefer-auto-layout': preferAutoLayout,
  'consistent-spacing': consistentSpacing,
  'consistent-radius': consistentRadius,
  'color-contrast': colorContrast,
  'touch-target-size': touchTargetSize,
  'text-style-required': textStyleRequired,
  'min-text-size': minTextSize,
  'no-hidden-layers': noHiddenLayers,
  'no-deeply-nested': noDeeplyNested,
  'no-empty-frames': noEmptyFrames,
  'pixel-perfect': pixelPerfect,
  'no-groups': noGroups,
  'effect-style-required': effectStyleRequired,
  'no-mixed-styles': noMixedStyles,
  'no-detached-instances': noDetachedInstances,
}
