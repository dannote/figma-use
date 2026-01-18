import { defineCommand } from 'citty'
import { getFileInfo } from '../../rest-api.ts'
import { getFileInfoViaBrowser } from '../../cdp-api.ts'
import { getFileKey, handleError } from '../../client.ts'
import { dim, accent } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Get file metadata' },
  args: {
    file: { type: 'string', description: 'File key (default: current file)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      // Try REST API if token set
      if (process.env.FIGMA_ACCESS_TOKEN) {
        const fileKey = args.file || await getFileKey()
        const info = await getFileInfo(fileKey)
        
        if (args.json) {
          console.log(JSON.stringify({ key: fileKey, ...info }, null, 2))
          return
        }
        
        const lastMod = new Date(info.lastModified).toLocaleString()
        console.log(`${accent(info.name)}`)
        console.log(`  Key: ${fileKey}`)
        console.log(`  Version: ${info.version}`)
        console.log(`  Last modified: ${lastMod}`)
        console.log(`  ${dim(info.thumbnailUrl)}`)
      } else {
        // Fall back to browser
        const info = await getFileInfoViaBrowser()
        
        if (args.json) {
          console.log(JSON.stringify(info, null, 2))
          return
        }
        
        console.log(`${accent(info.name)}`)
        console.log(`  Key: ${info.key}`)
        console.log(`  ${dim('(Set FIGMA_ACCESS_TOKEN for full metadata)')}`)
      }
    } catch (e) { handleError(e) }
  }
})
