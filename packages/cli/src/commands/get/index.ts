import { defineCommand } from 'citty'

import components from './components.ts'
import pages from './pages.ts'
import styles from './styles.ts'

export default defineCommand({
  meta: { description: 'Get document info' },
  subCommands: {
    pages,
    components,
    styles
  }
})
