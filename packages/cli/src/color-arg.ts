/**
 * Parse color argument - supports hex colors and variable references
 * 
 * @example
 * parseColorArg("#FF0000")           // { hex: "#FF0000" }
 * parseColorArg("var:Colors/Primary") // { variable: "Colors/Primary" }
 * parseColorArg("$Colors/Primary")    // { variable: "Colors/Primary" }
 */
export interface ColorArg {
  hex?: string
  variable?: string
}

export function parseColorArg(color: string | undefined): ColorArg | undefined {
  if (!color) return undefined
  
  // var:Colors/Primary or $Colors/Primary
  const varMatch = color.match(/^(?:var:|[$])(.+)$/)
  if (varMatch) {
    return { variable: varMatch[1] }
  }
  
  return { hex: color }
}

/**
 * Convert ColorArg to the format expected by plugin commands
 * Returns string for backwards compatibility, or object for variable binding
 */
export function colorArgToPayload(color: string | undefined): string | { variable: string } | undefined {
  if (!color) return undefined
  
  const parsed = parseColorArg(color)
  if (!parsed) return undefined
  
  if (parsed.variable) {
    return { variable: parsed.variable }
  }
  
  return parsed.hex
}
