import { defineCommand } from 'citty'
import { handleError, getFileKey, getParentGUID } from '../client.ts'
import { ok, fail } from '../format.ts'
import { resolve } from 'path'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as React from 'react'
import { renderToNodeChanges } from '../render/index.ts'
import { FigmaMultiplayerClient, getCookiesFromDevTools, initCodec } from '../multiplayer/index.ts'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export default defineCommand({
  meta: { 
    description: 'Render React component to Figma via WebSocket',
  },
  args: {
    file: { type: 'string', description: 'TSX/JSX file path' },
    stdin: { type: 'boolean', description: 'Read TSX from stdin' },
    props: { type: 'string', description: 'JSON props to pass to component' },
    parent: { type: 'string', description: 'Parent node ID (sessionID:localID)' },
    export: { type: 'string', description: 'Named export (default: default)' },
    json: { type: 'boolean', description: 'Output as JSON' },
    dryRun: { type: 'boolean', description: 'Output NodeChanges without sending to Figma' },
  },
  async run({ args }) {
    let filePath: string
    let tempFile: string | null = null
    
    // Handle stdin or file
    if (args.stdin) {
      const code = await readStdin()
      if (!code.trim()) {
        console.error(fail('No input received from stdin'))
        process.exit(1)
      }
      
      // Write to temp file for Bun to import
      tempFile = join(tmpdir(), `figma-render-${Date.now()}.tsx`)
      writeFileSync(tempFile, code)
      filePath = tempFile
    } else if (args.file) {
      filePath = resolve(args.file)
      
      if (!existsSync(filePath)) {
        console.error(fail(`File not found: ${filePath}`))
        process.exit(1)
      }
    } else {
      console.error(fail('Provide a file path or use --stdin'))
      process.exit(1)
    }
    
    try {
      // Import TSX file directly - Bun handles transpilation
      const module = await import(filePath)
      
      const exportName = args.export || 'default'
      const Component = module[exportName]
      
      if (!Component) {
        console.error(fail(`Export "${exportName}" not found`))
        process.exit(1)
      }
      
      // Initialize codec
      await initCodec()
      
      // Get connection info
      let fileKey: string
      try {
        fileKey = await getFileKey()
      } catch {
        console.error(fail('Cannot connect to Chrome DevTools on port 9222'))
        console.error('')
        console.error('Start Figma with remote debugging enabled:')
        console.error('  figma --remote-debugging-port=9222')
        process.exit(1)
      }
      
      const parentGUID = args.parent 
        ? parseGUID(args.parent)
        : await getParentGUID()
      
      // Connect to Figma
      let cookies: string
      try {
        cookies = await getCookiesFromDevTools()
      } catch {
        console.error(fail('Cannot get cookies from Chrome DevTools'))
        console.error('')
        console.error('Make sure Figma is running with:')
        console.error('  figma --remote-debugging-port=9222')
        process.exit(1)
      }
      
      const client = new FigmaMultiplayerClient(fileKey)
      const session = await client.connect(cookies)
      
      // Create React element and render to NodeChanges
      const props = args.props ? JSON.parse(args.props) : {}
      const element = React.createElement(Component, props)
      
      const result = renderToNodeChanges(element, {
        sessionID: session.sessionID,
        parentGUID,
        startLocalID: Date.now() % 1000000,
      })
      
      if (args.dryRun) {
        console.log(JSON.stringify(result.nodeChanges, null, 2))
        client.close()
        return
      }
      
      if (!args.json) {
        console.log(`Rendering ${result.nodeChanges.length} nodes...`)
      }
      
      // Send to Figma
      await client.sendNodeChangesSync(result.nodeChanges)
      client.close()
      
      // Output
      if (args.json) {
        const ids = result.nodeChanges.map(nc => ({
          id: `${nc.guid.sessionID}:${nc.guid.localID}`,
          name: nc.name,
        }))
        console.log(JSON.stringify(ids, null, 2))
      } else {
        console.log(ok(`Rendered ${result.nodeChanges.length} nodes`))
        const first = result.nodeChanges[0]
        if (first) {
          console.log(`  root: ${first.guid.sessionID}:${first.guid.localID}`)
        }
      }
      
    } catch (e) { 
      handleError(e) 
    } finally {
      // Cleanup temp file
      if (tempFile && existsSync(tempFile)) {
        unlinkSync(tempFile)
      }
    }
  }
})

function parseGUID(id: string): { sessionID: number; localID: number } {
  const parts = id.split(':').map(Number)
  return { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 }
}
