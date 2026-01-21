import { defineCommand } from 'citty'
import { createTwoFilesPatch } from 'diff'

import { sendCommand, handleError } from '../../client.ts'
import { fail } from '../../format.ts'
import { serializeNode } from './serialize.ts'

interface NodeInfo {
  id: string
  name: string
  type: string
  children?: NodeInfo[]
  [key: string]: unknown
}

/**
 * Recursively collect all nodes from a tree into a flat map by name path.
 */
function collectNodes(
  node: NodeInfo,
  parentPath: string = ''
): Map<string, { path: string; id: string; node: NodeInfo }> {
  const result = new Map<string, { path: string; id: string; node: NodeInfo }>()

  const path = parentPath ? `${parentPath}/${node.name}` : `/${node.name}`
  result.set(path, { path, id: node.id, node })

  if (node.children) {
    for (const child of node.children) {
      const childNodes = collectNodes(child, path)
      for (const [k, v] of childNodes) {
        result.set(k, v)
      }
    }
  }

  return result
}

export default defineCommand({
  meta: { description: 'Create a diff patch between two nodes/trees' },
  args: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true },
    depth: { type: 'string', description: 'Tree depth (default: 10)' }
  },
  async run({ args }) {
    try {
      const depth = args.depth ? Number(args.depth) : 10

      // Get both trees (sequential to avoid WebSocket issues)
      const fromTree = (await sendCommand('get-node-tree', { id: args.from, depth })) as NodeInfo
      const toTree = (await sendCommand('get-node-tree', { id: args.to, depth })) as NodeInfo

      if (!fromTree || !toTree) {
        console.error(fail('Could not fetch node trees'))
        process.exit(1)
      }

      // Collect all nodes by path
      const fromNodes = collectNodes(fromTree)
      const toNodes = collectNodes(toTree)

      // Find all unique paths
      const allPaths = new Set([...fromNodes.keys(), ...toNodes.keys()])

      const patches: string[] = []

      for (const path of allPaths) {
        const fromEntry = fromNodes.get(path)
        const toEntry = toNodes.get(path)

        // Normalize path: replace root name with target's root for consistent naming
        const normalizedPath = path.replace(/^\/[^/]+/, `/${toTree.name}`)

        if (!fromEntry && toEntry) {
          // Node added in target
          const newContent = serializeNode(toEntry.node)
          const filename = `${normalizedPath} #${toEntry.id}`
          patches.push(`--- /dev/null
+++ ${filename}
@@ -0,0 +1,${newContent.split('\n').length} @@
${newContent
  .split('\n')
  .map((l) => `+${l}`)
  .join('\n')}`)
        } else if (fromEntry && !toEntry) {
          // Node removed in target
          const oldContent = serializeNode(fromEntry.node)
          const filename = `${normalizedPath} #${fromEntry.id}`
          patches.push(`--- ${filename}
+++ /dev/null
@@ -1,${oldContent.split('\n').length} +0,0 @@
${oldContent
  .split('\n')
  .map((l) => `-${l}`)
  .join('\n')}`)
        } else if (fromEntry && toEntry) {
          // Both exist — compare
          const oldContent = serializeNode(fromEntry.node)
          const newContent = serializeNode(toEntry.node)

          if (oldContent !== newContent) {
            const fromFilename = `${normalizedPath} #${fromEntry.id}`
            const toFilename = `${normalizedPath} #${toEntry.id}`

            const patch = createTwoFilesPatch(
              fromFilename,
              toFilename,
              oldContent,
              newContent,
              '',
              ''
            )

            // Remove the Index header line
            const lines = patch.split('\n')
            const filtered = lines.filter(
              (l) =>
                !l.startsWith('Index:') &&
                l !== '==================================================================='
            )
            patches.push(filtered.join('\n').trim())
          }
        }
      }

      if (patches.length === 0) {
        console.error(fail('No differences found'))
        process.exit(1)
      }

      console.log(patches.join('\n'))
    } catch (e) {
      handleError(e)
    }
  }
})
