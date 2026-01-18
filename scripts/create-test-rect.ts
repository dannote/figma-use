#!/usr/bin/env bun
/**
 * Create test rectangle via plugin API
 * Usage: bun scripts/create-test-rect.ts <name> [options]
 * 
 * Options:
 *   --fill <color>     Fill color (hex or var:ID)
 *   --stroke <color>   Stroke color
 *   --x <number>       X position
 *   --y <number>       Y position
 *   --var <varId>      Bind fill to variable ID
 */

import { sendCommand } from '../packages/cli/src/client.ts'

const args = process.argv.slice(2)
const name = args[0] || 'TEST_' + Date.now()

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const fill = getArg('--fill') || '#FF0000'
const stroke = getArg('--stroke')
const x = parseInt(getArg('--x') || '0')
const y = parseInt(getArg('--y') || '0')
const varId = getArg('--var')
console.log(`Creating rectangle "${name}"...`)

// Create rectangle
const rect = await sendCommand('create-rectangle', {
  name,
  width: 100,
  height: 100,
  x,
  y,
  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
})

console.log(`Created: ${rect.id}`)

// Set fill color
if (fill && !fill.startsWith('var:')) {
  await sendCommand('set-fill-color', { nodeId: rect.id, color: fill })
}

// Bind variable
if (varId) {
  console.log(`Binding variable: ${varId}`)
  await sendCommand('bind-fill-variable', { nodeId: rect.id, variableId: varId })
}

// Set stroke
if (stroke) {
  await sendCommand('set-stroke-color', { nodeId: rect.id, color: stroke, weight: 2 })
}

console.log(`Done: ${rect.id}`)
