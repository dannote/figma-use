import { defineCommand } from 'citty'
import { readFileSync } from 'fs'

import { sendCommand, handleError } from '../../client.ts'
import { ok, fail } from '../../format.ts'
import { parseFigmaPatch } from './parse.ts'
import { serializeNode, deserializeNode, diffProps } from './serialize.ts'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export default defineCommand({
  meta: { description: 'Apply a diff patch to Figma nodes' },
  args: {
    stdin: { type: 'boolean', description: 'Read patch from stdin' },
    file: { type: 'positional', description: 'Patch file path', required: false },
    'dry-run': { type: 'boolean', description: 'Show what would be changed without applying' },
    force: { type: 'boolean', description: 'Apply even if old values do not match' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let patchText: string

      if (args.stdin) {
        patchText = await readStdin()
      } else if (args.file) {
        patchText = readFileSync(args.file, 'utf-8')
      } else {
        console.error(fail('Provide a patch file or use --stdin'))
        process.exit(1)
      }

      const patches = parseFigmaPatch(patchText)

      if (patches.length === 0) {
        console.error(fail('No valid patches found'))
        process.exit(1)
      }

      const results: Array<{
        nodeId: string
        path: string
        status: 'applied' | 'skipped' | 'failed' | 'created' | 'deleted'
        error?: string
        changes?: Record<string, unknown>
      }> = []

      for (const patch of patches) {
        const { path, nodeId, isDelete, isCreate, oldContent, newContent } = patch

        // Handle delete
        if (isDelete && nodeId) {
          if (args['dry-run']) {
            results.push({ nodeId, path, status: 'deleted', changes: { action: 'DELETE' } })
            continue
          }

          try {
            await sendCommand('delete-node', { id: nodeId })
            results.push({ nodeId, path, status: 'deleted' })
          } catch (e) {
            results.push({ nodeId, path, status: 'failed', error: String(e) })
          }
          continue
        }

        // Handle create
        if (isCreate) {
          const newProps = deserializeNode(newContent)

          if (args['dry-run']) {
            results.push({
              nodeId: 'new',
              path,
              status: 'created',
              changes: newProps as unknown as Record<string, unknown>
            })
            continue
          }

          // TODO: Create node based on type
          // For now, we'll skip create operations as they need parent resolution
          results.push({
            nodeId: 'new',
            path,
            status: 'skipped',
            error: 'CREATE not yet implemented - use render for new nodes'
          })
          continue
        }

        // Handle modify
        if (!nodeId) {
          results.push({ nodeId: 'unknown', path, status: 'skipped', error: 'No node ID in patch' })
          continue
        }

        // Get current node state
        let currentNode: Record<string, unknown>
        try {
          currentNode = (await sendCommand('get-node-info', { id: nodeId })) as Record<
            string,
            unknown
          >
        } catch {
          results.push({ nodeId, path, status: 'failed', error: `Node not found: ${nodeId}` })
          continue
        }

        const currentSerialized = serializeNode(currentNode)
        const expectedOld = oldContent

        // Validate old content matches (unless --force)
        if (!args.force && currentSerialized !== expectedOld) {
          // Try line-by-line comparison for better error message
          const currentLines = currentSerialized.split('\n')
          const expectedLines = expectedOld.split('\n')
          const mismatches: string[] = []

          for (const expLine of expectedLines) {
            if (!currentLines.includes(expLine)) {
              mismatches.push(expLine)
            }
          }

          results.push({
            nodeId,
            path,
            status: 'failed',
            error: `Old value mismatch. Expected:\n${mismatches.join('\n')}\nActual:\n${currentSerialized}`
          })
          continue
        }

        // Calculate and apply changes
        const oldProps = deserializeNode(oldContent)
        const newProps = deserializeNode(newContent)
        const changes = diffProps(oldProps, newProps)

        if (Object.keys(changes).length === 0) {
          results.push({ nodeId, path, status: 'skipped', error: 'No changes detected' })
          continue
        }

        if (args['dry-run']) {
          results.push({
            nodeId,
            path,
            status: 'applied',
            changes: changes as Record<string, unknown>
          })
          continue
        }

        // Apply each change
        try {
          if (changes.fill) {
            await sendCommand('set-fill-color', { id: nodeId, color: changes.fill })
          }
          if (changes.stroke) {
            await sendCommand('set-stroke-color', {
              id: nodeId,
              color: changes.stroke,
              weight: changes.strokeWeight
            })
          }
          if (changes.opacity !== undefined) {
            await sendCommand('set-opacity', { id: nodeId, opacity: changes.opacity })
          }
          if (changes.radius !== undefined) {
            await sendCommand('set-radius', { id: nodeId, radius: changes.radius })
          }
          if (changes.size) {
            await sendCommand('resize-node', {
              id: nodeId,
              width: changes.size[0]!,
              height: changes.size[1]!
            })
          }
          if (changes.pos) {
            await sendCommand('move-node', { id: nodeId, x: changes.pos[0]!, y: changes.pos[1]! })
          }
          if (changes.text !== undefined) {
            await sendCommand('set-text-content', { id: nodeId, text: changes.text })
          }
          if (changes.visible !== undefined) {
            await sendCommand('set-visibility', { id: nodeId, visible: changes.visible })
          }
          if (changes.locked !== undefined) {
            await sendCommand('set-locked', { id: nodeId, locked: changes.locked })
          }

          results.push({
            nodeId,
            path,
            status: 'applied',
            changes: changes as Record<string, unknown>
          })
        } catch (e) {
          results.push({ nodeId, path, status: 'failed', error: String(e) })
        }
      }

      // Output
      if (args.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const r of results) {
          const icon =
            r.status === 'applied'
              ? '✓'
              : r.status === 'created'
                ? '+'
                : r.status === 'deleted'
                  ? '-'
                  : r.status === 'skipped'
                    ? '○'
                    : '✗'
          console.log(`${icon} ${r.path} #${r.nodeId}`)

          if (r.error) {
            console.log(`  ${r.error}`)
          }
          if (r.changes && args['dry-run']) {
            for (const [key, val] of Object.entries(r.changes)) {
              console.log(`  ${key}: ${JSON.stringify(val)}`)
            }
          }
        }

        const applied = results.filter(
          (r) => r.status === 'applied' || r.status === 'created' || r.status === 'deleted'
        ).length
        const failed = results.filter((r) => r.status === 'failed').length

        if (args['dry-run']) {
          console.log(`\n${applied} changes would be applied`)
        } else {
          console.log(
            `\n${ok(`${applied} applied`)}${failed > 0 ? `, ${fail(`${failed} failed`)}` : ''}`
          )
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
