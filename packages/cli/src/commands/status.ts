import { defineCommand } from 'citty'
import { getStatus } from '../client.ts'

export default defineCommand({
  meta: { description: 'Check if plugin is connected' },
  async run() {
    try {
      const status = await getStatus()
      console.log(status.pluginConnected ? '✓ Plugin connected' : '✗ Plugin not connected')
    } catch {
      console.log('✗ Proxy not running')
      process.exit(1)
    }
  }
})
