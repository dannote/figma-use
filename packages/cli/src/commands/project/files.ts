import { defineCommand } from 'citty'
import { getProjectFiles } from '../../rest-api.ts'
import { handleError } from '../../client.ts'
import { accent, dim } from '../../format.ts'

export default defineCommand({
  meta: { description: 'List files in a project' },
  args: {
    project: { type: 'positional', description: 'Project ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const files = await getProjectFiles(args.project)
      
      if (args.json) {
        console.log(JSON.stringify(files, null, 2))
        return
      }
      
      if (files.length === 0) {
        console.log('No files found')
        return
      }
      
      for (const f of files) {
        const lastMod = new Date(f.last_modified).toLocaleDateString()
        console.log(`${accent(f.name)} ${dim(`(${f.key})`)} ${dim(lastMod)}`)
      }
    } catch (e) { handleError(e) }
  }
})
