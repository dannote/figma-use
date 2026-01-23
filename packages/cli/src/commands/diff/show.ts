import { bold, green, red, cyan } from 'agentfmt'
import { defineCommand } from 'citty'
import { createPatch } from 'diff'

import { sendCommand, handleError } from '../../client.ts'
import { fail } from '../../format.ts'
import { serializeNode } from './serialize.ts'

export default defineCommand({
  meta: { description: 'Show diff between current node state and provided properties' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    props: {
      type: 'string',
      description: 'New properties as JSON (e.g. \'{"opacity": 1, "fill": "#FF0000"}\')'
    }
  },
  async run({ args }) {
    try {
      if (!args.props) {
        console.error(fail('Provide --props with new values'))
        process.exit(1)
      }

      // Get current node state
      const node = (await sendCommand('get-node-info', { id: args.id })) as Record<string, unknown>
      const nodeName = (node.name as string) || 'Node'

      // Build path (simplified - just name for now)
      const path = `/${nodeName} #${args.id}`

      // Current serialized state
      const oldContent = serializeNode(node)

      // Parse new props and merge
      const newProps = JSON.parse(args.props)
      const modifiedNode = { ...node }

      // Apply new props to a copy
      if (newProps.fill) {
        modifiedNode.fills = [{ type: 'SOLID', color: newProps.fill }]
      }
      if (newProps.stroke) {
        modifiedNode.strokes = [{ type: 'SOLID', color: newProps.stroke }]
      }
      if (newProps.opacity !== undefined) {
        modifiedNode.opacity = newProps.opacity
      }
      if (newProps.radius !== undefined) {
        modifiedNode.cornerRadius = newProps.radius
      }
      if (newProps.size) {
        modifiedNode.width = newProps.size[0]
        modifiedNode.height = newProps.size[1]
      }
      if (newProps.width !== undefined) {
        modifiedNode.width = newProps.width
      }
      if (newProps.height !== undefined) {
        modifiedNode.height = newProps.height
      }
      if (newProps.x !== undefined) {
        modifiedNode.x = newProps.x
      }
      if (newProps.y !== undefined) {
        modifiedNode.y = newProps.y
      }

      const newContent = serializeNode(modifiedNode)

      // Generate unified diff
      const patch = createPatch(path, oldContent, newContent, '', '')

      // Output with colors
      for (const line of patch.split('\n')) {
        if (line.startsWith('---') || line.startsWith('+++')) {
          console.log(bold(line))
        } else if (line.startsWith('-')) {
          console.log(red(line))
        } else if (line.startsWith('+')) {
          console.log(green(line))
        } else if (line.startsWith('@@')) {
          console.log(cyan(line))
        } else {
          console.log(line)
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
