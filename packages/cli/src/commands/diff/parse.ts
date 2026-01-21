/**
 * Parse unified diff format for Figma nodes.
 *
 * Format:
 *   --- /Parent/Child #sessionID:localID
 *   +++ /Parent/Child #sessionID:localID
 *   @@ -1,3 +1,3 @@
 *    type: RECTANGLE
 *   -opacity: 0.8
 *   +opacity: 1
 */

import { parsePatch } from 'diff'

import type { StructuredPatch } from 'diff'

export interface FigmaPatch {
  /** Node path like /Cat Illustration/Head */
  path: string
  /** Node ID like 123:456 */
  nodeId: string | null
  /** Whether this is a delete operation (old exists, new is /dev/null) */
  isDelete: boolean
  /** Whether this is a create operation (old is /dev/null, new exists) */
  isCreate: boolean
  /** Parsed hunks from diff library */
  hunks: StructuredPatch['hunks']
  /** Raw old content (reconstructed from - lines) */
  oldContent: string
  /** Raw new content (reconstructed from + lines) */
  newContent: string
}

/**
 * Parse a figma-use diff patch into structured operations.
 */
export function parseFigmaPatch(patchText: string): FigmaPatch[] {
  const parsed = parsePatch(patchText)
  const patches: FigmaPatch[] = []

  for (const file of parsed) {
    const { path, nodeId } = parseFileName(file.oldFileName || file.newFileName || '')

    const isDelete = file.newFileName === '/dev/null' || file.newFileName === ''
    const isCreate = file.oldFileName === '/dev/null' || file.oldFileName === ''

    // Reconstruct content from hunks
    let oldContent = ''
    let newContent = ''

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith('-') && !line.startsWith('---')) {
          oldContent += line.slice(1) + '\n'
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          newContent += line.slice(1) + '\n'
        } else if (line.startsWith(' ')) {
          oldContent += line.slice(1) + '\n'
          newContent += line.slice(1) + '\n'
        }
      }
    }

    patches.push({
      path,
      nodeId,
      isDelete,
      isCreate,
      hunks: file.hunks,
      oldContent: oldContent.trimEnd(),
      newContent: newContent.trimEnd()
    })
  }

  return patches
}

/**
 * Parse filename like "/Cat Illustration/Head #123:456" into path and nodeId.
 */
function parseFileName(filename: string): { path: string; nodeId: string | null } {
  const match = filename.match(/^(.+?)\s+#(\d+:\d+)$/)
  if (match && match[1] && match[2]) {
    return { path: match[1], nodeId: match[2] }
  }
  return { path: filename, nodeId: null }
}

/**
 * Build a unified diff string from old and new content.
 */
export function buildPatch(
  path: string,
  nodeId: string,
  oldContent: string,
  newContent: string
): string {
  const filename = `${path} #${nodeId}`
  const lines: string[] = []

  lines.push(`--- ${filename}`)
  lines.push(`+++ ${filename}`)

  const oldLines = oldContent ? oldContent.split('\n') : []
  const newLines = newContent ? newContent.split('\n') : []

  // Simple hunk: replace all
  lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`)

  for (const line of oldLines) {
    lines.push(`-${line}`)
  }
  for (const line of newLines) {
    lines.push(`+${line}`)
  }

  return lines.join('\n')
}
