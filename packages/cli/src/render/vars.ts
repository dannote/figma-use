/**
 * Figma Variable Bindings (StyleX-inspired API)
 * 
 * @example
 * ```tsx
 * // tokens.figma.ts
 * export const colors = defineVars({
 *   primary: 'VariableID:38448:122296',
 *   secondary: 'VariableID:38448:122301',
 * })
 * 
 * // Card.figma.tsx
 * <Frame style={{ fill: colors.primary }}>
 * ```
 */

const VAR_SYMBOL = Symbol.for('figma.variable')

export interface FigmaVariable {
  [VAR_SYMBOL]: true
  id: string
  sessionID: number
  localID: number
}

/**
 * Check if value is a Figma variable reference
 */
export function isVariable(value: unknown): value is FigmaVariable {
  return typeof value === 'object' && value !== null && VAR_SYMBOL in value
}

/**
 * Parse VariableID string to sessionID and localID
 */
function parseVariableId(id: string): { sessionID: number; localID: number } {
  // Format: "VariableID:38448:122296" or "38448:122296"
  const match = id.match(/(?:VariableID:)?(\d+):(\d+)/)
  if (!match) {
    throw new Error(`Invalid variable ID format: ${id}. Expected "VariableID:sessionID:localID" or "sessionID:localID"`)
  }
  return {
    sessionID: parseInt(match[1], 10),
    localID: parseInt(match[2], 10),
  }
}

/**
 * Create a single variable reference
 */
function createVariable(id: string): FigmaVariable {
  const { sessionID, localID } = parseVariableId(id)
  return {
    [VAR_SYMBOL]: true,
    id: id.startsWith('VariableID:') ? id : `VariableID:${id}`,
    sessionID,
    localID,
  }
}

/**
 * Define Figma variables for use in styles
 * 
 * @example
 * ```ts
 * export const colors = defineVars({
 *   primary: 'VariableID:38448:122296',
 *   secondary: '38448:122301', // shorthand also works
 * })
 * 
 * // Use in components:
 * <Frame style={{ fill: colors.primary }} />
 * ```
 */
export function defineVars<T extends Record<string, string>>(
  vars: T
): { [K in keyof T]: FigmaVariable } {
  const result = {} as { [K in keyof T]: FigmaVariable }
  
  for (const [key, value] of Object.entries(vars)) {
    result[key as keyof T] = createVariable(value)
  }
  
  return result
}

/**
 * Shorthand for single variable
 * 
 * @example
 * ```ts
 * const primaryColor = figmaVar('38448:122296')
 * ```
 */
export function figmaVar(id: string): FigmaVariable {
  return createVariable(id)
}
