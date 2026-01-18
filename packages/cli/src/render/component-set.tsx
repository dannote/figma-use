/**
 * ComponentSet (variants) support
 * 
 * ComponentSet = FRAME with:
 *   - isStateGroup = true (field 225)
 *   - stateGroupPropertyValueOrders (field 238) = [{property, values}]
 *   - children are SYMBOL (Component) nodes with names like "variant=A, size=B"
 */

import * as React from 'react'

type VariantDef = Record<string, readonly string[]>
type VariantProps<V extends VariantDef> = { [K in keyof V]: V[K][number] }

interface ComponentSetDef<V extends VariantDef> {
  name: string
  variants: V
  render: (props: VariantProps<V>) => React.ReactElement
  symbol: symbol
}

const componentSetRegistry = new Map<symbol, ComponentSetDef<VariantDef>>()

export function resetComponentSetRegistry() {
  componentSetRegistry.clear()
}

export function getComponentSetRegistry() {
  return componentSetRegistry
}

/**
 * Define a component with variants (ComponentSet)
 * 
 * @example
 * const Button = defineComponentSet('Button', {
 *   variant: ['Primary', 'Secondary'] as const,
 *   size: ['Small', 'Large'] as const,
 * }, ({ variant, size }) => (
 *   <Frame style={{ padding: size === 'Large' ? 16 : 8 }}>
 *     <Text>{variant}</Text>
 *   </Frame>
 * ))
 * 
 * <Button variant="Primary" size="Large" />
 */
export function defineComponentSet<V extends VariantDef>(
  name: string,
  variants: V,
  render: (props: VariantProps<V>) => React.ReactElement
): React.FC<Partial<VariantProps<V>> & { style?: Record<string, unknown> }> {
  const sym = Symbol(name)
  componentSetRegistry.set(sym, { name, variants, render, symbol: sym } as ComponentSetDef<VariantDef>)
  
  const VariantInstance: React.FC<Partial<VariantProps<V>> & { style?: Record<string, unknown> }> = (props) => {
    const { style, ...variantProps } = props
    return React.createElement('__component_set_instance__', {
      __componentSetSymbol: sym,
      __componentSetName: name,
      __variantProps: variantProps,
      style,
    })
  }
  VariantInstance.displayName = name
  
  return VariantInstance
}

/**
 * Generate all variant combinations
 */
export function generateVariantCombinations<V extends VariantDef>(
  variants: V
): Array<VariantProps<V>> {
  const keys = Object.keys(variants) as (keyof V)[]
  if (keys.length === 0) return [{}] as Array<VariantProps<V>>
  
  const result: Array<VariantProps<V>> = []
  
  function combine(index: number, current: Partial<VariantProps<V>>) {
    if (index === keys.length) {
      result.push(current as VariantProps<V>)
      return
    }
    
    const key = keys[index]
    for (const value of variants[key]) {
      combine(index + 1, { ...current, [key]: value })
    }
  }
  
  combine(0, {})
  return result
}

/**
 * Build variant name string for Figma component (e.g., "variant=Primary, size=Large")
 */
export function buildVariantName(props: Record<string, string>): string {
  return Object.entries(props)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
}

/**
 * Build stateGroupPropertyValueOrders for ComponentSet
 */
export function buildStateGroupPropertyValueOrders(variants: VariantDef): Array<{property: string, values: string[]}> {
  return Object.entries(variants).map(([property, values]) => ({
    property,
    values: [...values]
  }))
}
