import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../../client.ts'
import { fail } from '../../format.ts'
import { serializeNode } from './serialize.ts'
import { createPatch } from 'diff'

export default defineCommand({
  meta: { description: 'Create a diff patch for a node with new properties' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    fill: { type: 'string', description: 'New fill color (hex)' },
    stroke: { type: 'string', description: 'New stroke color (hex)' },
    opacity: { type: 'string', description: 'New opacity (0-1)' },
    radius: { type: 'string', description: 'New corner radius' },
    width: { type: 'string', description: 'New width' },
    height: { type: 'string', description: 'New height' },
    x: { type: 'string', description: 'New x position' },
    y: { type: 'string', description: 'New y position' },
  },
  async run({ args }) {
    try {
      // Get current node state
      const node = await sendCommand('get-node-info', { id: args.id }) as Record<string, unknown>
      const nodeName = node.name as string || 'Node'
      
      // Build path
      const path = `/${nodeName} #${args.id}`
      
      // Current serialized state
      const oldContent = serializeNode(node)
      
      // Apply new props to a copy
      const modifiedNode = { ...node }
      
      if (args.fill) {
        modifiedNode.fills = [{ type: 'SOLID', color: args.fill }]
      }
      if (args.stroke) {
        modifiedNode.strokes = [{ type: 'SOLID', color: args.stroke }]
      }
      if (args.opacity !== undefined) {
        modifiedNode.opacity = Number(args.opacity)
      }
      if (args.radius !== undefined) {
        modifiedNode.cornerRadius = Number(args.radius)
      }
      if (args.width !== undefined) {
        modifiedNode.width = Number(args.width)
      }
      if (args.height !== undefined) {
        modifiedNode.height = Number(args.height)
      }
      if (args.x !== undefined) {
        modifiedNode.x = Number(args.x)
      }
      if (args.y !== undefined) {
        modifiedNode.y = Number(args.y)
      }
      
      const newContent = serializeNode(modifiedNode)
      
      if (oldContent === newContent) {
        console.error(fail('No changes detected'))
        process.exit(1)
      }
      
      // Generate unified diff (without Index header for cleaner output)
      const lines: string[] = []
      lines.push(`--- ${path}`)
      lines.push(`+++ ${path}`)
      
      const oldLines = oldContent.split('\n')
      const newLines = newContent.split('\n')
      
      // Find changed lines
      const contextLines: string[] = []
      const removedLines: string[] = []
      const addedLines: string[] = []
      
      for (const line of oldLines) {
        if (newLines.includes(line)) {
          contextLines.push(line)
        } else {
          removedLines.push(line)
        }
      }
      
      for (const line of newLines) {
        if (!oldLines.includes(line)) {
          addedLines.push(line)
        }
      }
      
      lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`)
      
      for (const line of contextLines) {
        lines.push(` ${line}`)
      }
      for (const line of removedLines) {
        lines.push(`-${line}`)
      }
      for (const line of addedLines) {
        lines.push(`+${line}`)
      }
      
      console.log(lines.join('\n'))
      
    } catch (e) {
      handleError(e)
    }
  }
})
