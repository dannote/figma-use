/**
 * ComponentSet (variants) support
 *
 * ## How ComponentSet works in Figma's multiplayer protocol
 *
 * ComponentSet is NOT a separate node type - it's a FRAME with special fields:
 *   - type = FRAME (4)
 *   - isStateGroup = true (field 225)
 *   - stateGroupPropertyValueOrders (field 238) = [{property: "variant", values: ["A", "B"]}]
 *
 * Children are SYMBOL (Component) nodes with names like "variant=Primary, size=Large".
 * Figma auto-generates componentPropertyDefinitions from these names.
 *
 * ## Why Instances are created via Plugin API
 *
 * IMPORTANT: Instance nodes with symbolData.symbolID CANNOT be created via multiplayer
 * when linking to components in the same batch. Figma reassigns GUIDs on receive,
 * breaking the symbolID references.
 *
 * Example: We send SYMBOL with localID=100, Instance with symbolData.symbolID=100.
 * Figma receives and assigns new IDs: SYMBOL becomes 200, but Instance still
 * references 100 → broken link.
 *
 * This works for defineComponent() because Component and first Instance are adjacent
 * in the node tree, but fails for ComponentSet where variant components are created
 * first, then instances are created as siblings of the ComponentSet.
 *
 * Solution: Create the ComponentSet and variant Components via multiplayer (fast),
 * then create Instances via Plugin API in trigger-layout (correct linking).
 * The pendingComponentSetInstances array passes instance specs to the plugin.
 *
 * Discovered through protocol sniffing - see scripts/sniff-ws.ts
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

// Use global registry to avoid module duplication issues between bundled CLI and source imports
const REGISTRY_KEY = '__figma_use_component_set_registry__'
const componentSetRegistry: Map<symbol, ComponentSetDef<VariantDef>> =
  (globalThis as Record<string, unknown>)[REGISTRY_KEY] as Map<symbol, ComponentSetDef<VariantDef>> ||
  ((globalThis as Record<string, unknown>)[REGISTRY_KEY] = new Map<symbol, ComponentSetDef<VariantDef>>())

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
  componentSetRegistry.set(sym, {
    name,
    variants,
    render,
    symbol: sym
  } as ComponentSetDef<VariantDef>)

  const VariantInstance: React.FC<
    Partial<VariantProps<V>> & { style?: Record<string, unknown> }
  > = (props) => {
    const { style, ...variantProps } = props
    return React.createElement('__component_set_instance__', {
      __componentSetSymbol: sym,
      __componentSetName: name,
      __variantProps: variantProps,
      style
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
export function buildStateGroupPropertyValueOrders(
  variants: VariantDef
): Array<{ property: string; values: string[] }> {
  return Object.entries(variants).map(([property, values]) => ({
    property,
    values: [...values]
  }))
}
