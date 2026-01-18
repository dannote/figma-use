/**
 * Example Figma design tokens using defineVars
 * 
 * Usage:
 * ```tsx
 * import { colors, spacing } from './tokens.figma'
 * 
 * <Frame style={{ backgroundColor: colors.primary, padding: spacing.md }}>
 * ```
 */

import { defineVars } from '../../src/render/index.ts'

// Color tokens mapped to Figma variables
export const colors = defineVars({
  // Grays
  gray50: 'VariableID:38448:122296',
  gray100: 'VariableID:38448:122297',
  gray200: 'VariableID:38448:122298',
  gray300: 'VariableID:38448:122299',
  gray400: 'VariableID:38448:122300',
  gray500: 'VariableID:38448:122301',
  
  // Semantic
  primary: 'VariableID:38448:122305',
  secondary: 'VariableID:38448:122301',
  background: 'VariableID:38448:122296',
})

// Note: For non-color variables (spacing, radius), 
// use the actual values directly since multiplayer 
// variable binding currently only supports colors
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}
