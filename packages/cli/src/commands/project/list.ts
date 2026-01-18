import { defineCommand } from 'citty'
import { getTeamProjects } from '../../rest-api.ts'
import { handleError } from '../../client.ts'
import { accent, dim } from '../../format.ts'

export default defineCommand({
  meta: { description: 'List team projects' },
  args: {
    team: { type: 'positional', description: 'Team ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const projects = await getTeamProjects(args.team)
      
      if (args.json) {
        console.log(JSON.stringify(projects, null, 2))
        return
      }
      
      if (projects.length === 0) {
        console.log('No projects found')
        return
      }
      
      for (const p of projects) {
        console.log(`${accent(p.name)} ${dim(`(${p.id})`)}`)
      }
    } catch (e) { handleError(e) }
  }
})
