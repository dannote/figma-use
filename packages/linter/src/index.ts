export { Linter, createLinter } from './core/linter.ts'
export type {
  Rule,
  RuleMeta,
  RuleContext,
  FigmaNode,
  FigmaVariable,
  LintMessage,
  LintResult,
  LintConfig,
  Severity,
  Category,
  FixAction,
  Paint,
  RGB,
  Effect,
} from './core/types.ts'
export { defineRule } from './core/rule.ts'
export {
  rgbToHex,
  hexToRgb,
  contrastRatio,
  relativeLuminance,
  colorDistance,
  isMultipleOf,
  isDefaultName,
  getNodePath,
  SPACING_SCALE,
  FONT_SIZE_SCALE,
} from './core/utils.ts'
export { allRules } from './rules/index.ts'
export { presets, recommended, strict, accessibility, designSystem } from './config/presets.ts'
export { formatReport, formatJSON } from './reporters/console.ts'
