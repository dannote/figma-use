/**
 * Figma Variable Bindings (StyleX-inspired API)
 *
 * @example
 * ```tsx
 * // tokens.figma.ts - with explicit values (recommended)
 * export const colors = defineVars({
 *   primary: { name: 'Colors/Gray/50', value: '#F8FAFC' },
 *   accent: { name: 'Colors/Blue/500', value: '#3B82F6' },
 * })
 *
 * // tokens.figma.ts - name only (value loaded from Figma)
 * export const colors = defineVars({
 *   primary: 'Colors/Gray/50',
 *   accent: 'Colors/Blue/500',
 * })
 *
 * // Card.figma.tsx
 * <Frame style={{ backgroundColor: colors.primary }}>
 * ```
 */

const VAR_SYMBOL = Symbol.for('figma.variable')

/** Variable definition - either string name or object with name and value */
export type VarDef = string | { name: string; value: string }

export interface FigmaVariable {
  [VAR_SYMBOL]: true
  name: string // Variable name like "Colors/Gray/50"
  value?: string // Fallback color value like "#F8FAFC"
  _resolved?: {
    // Filled in at render time
    id: string
    sessionID: number
    localID: number
  }
}

export interface ResolvedVariable {
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
 * Variable registry - maps names to IDs
 * Populated by loadVariables() before render
 */
const variableRegistry = new Map<string, ResolvedVariable>()

/**
 * Load variables from Figma into registry
 */
export function loadVariablesIntoRegistry(variables: Array<{ id: string; name: string }>) {
  variableRegistry.clear()
  for (const v of variables) {
    const match = v.id.match(/VariableID:(\d+):(\d+)/)
    if (match) {
      variableRegistry.set(v.name, {
        id: v.id,
        sessionID: parseInt(match[1]!, 10),
        localID: parseInt(match[2]!, 10)
      })
    }
  }
}

/**
 * Resolve a variable name to its ID
 * @throws if variable not found in registry
 */
export function resolveVariable(variable: FigmaVariable): ResolvedVariable {
  // Already resolved?
  if (variable._resolved) {
    return variable._resolved
  }

  // Check if it's an ID format (legacy support)
  const idMatch = variable.name.match(/^(?:VariableID:)?(\d+):(\d+)$/)
  if (idMatch) {
    const resolved = {
      id: `VariableID:${idMatch[1]}:${idMatch[2]}`,
      sessionID: parseInt(idMatch[1]!, 10),
      localID: parseInt(idMatch[2]!, 10)
    }
    variable._resolved = resolved
    return resolved
  }

  // Lookup by name
  const resolved = variableRegistry.get(variable.name)
  if (!resolved) {
    const available = Array.from(variableRegistry.keys()).slice(0, 5).join(', ')
    throw new Error(
      `Variable "${variable.name}" not found. ` +
        `Available: ${available}${variableRegistry.size > 5 ? '...' : ''}. ` +
        `Make sure variables are loaded before render.`
    )
  }

  variable._resolved = resolved
  return resolved
}

/**
 * Check if variable registry is populated
 */
export function isRegistryLoaded(): boolean {
  return variableRegistry.size > 0
}

/**
 * Get registry size (for debugging)
 */
export function getRegistrySize(): number {
  return variableRegistry.size
}

/**
 * Define Figma variables for use in styles
 *
 * @example
 * ```ts
 * // With explicit fallback values (recommended)
 * export const colors = defineVars({
 *   primary: { name: 'Colors/Gray/50', value: '#F8FAFC' },
 *   accent: { name: 'Colors/Blue/500', value: '#3B82F6' },
 * })
 *
 * // Name only (value loaded from Figma registry)
 * export const colors = defineVars({
 *   primary: 'Colors/Gray/50',
 * })
 *
 * // Use in components:
 * <Frame style={{ backgroundColor: colors.primary }} />
 * ```
 */
export function defineVars<T extends Record<string, VarDef>>(
  vars: T
): { [K in keyof T]: FigmaVariable } {
  const result = {} as { [K in keyof T]: FigmaVariable }

  for (const [key, def] of Object.entries(vars)) {
    if (typeof def === 'string') {
      result[key as keyof T] = {
        [VAR_SYMBOL]: true,
        name: def
      }
    } else {
      result[key as keyof T] = {
        [VAR_SYMBOL]: true,
        name: def.name,
        value: def.value
      }
    }
  }

  return result
}

/**
 * Shorthand for single variable
 *
 * @example
 * ```ts
 * const primaryColor = figmaVar('Colors/Gray/50', '#F8FAFC')
 * ```
 */
export function figmaVar(name: string, value?: string): FigmaVariable {
  return {
    [VAR_SYMBOL]: true,
    name,
    value
  }
}
