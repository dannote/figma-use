import { defineCommand } from 'citty'

import { getStatus, getFileKey } from '../client.ts'

export default defineCommand({
  meta: { description: 'Check connection status' },
  args: { json: { type: 'boolean', description: 'Output as JSON' } },
  async run({ args }) {
    const result = {
      connected: false,
      fileName: null as string | null,
      fileKey: null as string | null
    }

    try {
      const status = await getStatus()
      result.connected = status.connected
      result.fileName = status.fileName || null
      result.fileKey = await getFileKey()
    } catch {
      // CDP not available
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    if (result.connected) {
      console.log('✓ Connected to Figma')
      if (result.fileName) console.log(`  File: ${result.fileName}`)
      if (result.fileKey) console.log(`  Key: ${result.fileKey}`)
    } else {
      console.log('✗ Not connected to Figma')
      console.log('  Start Figma with: open -a Figma --args --remote-debugging-port=9222')
      process.exit(1)
    }
  }
})
