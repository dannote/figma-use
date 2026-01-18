import { defineCommand } from 'citty'

export default defineCommand({
  meta: { description: 'Diff operations' },
  subCommands: {
    apply: () => import('./apply.ts').then(m => m.default),
    show: () => import('./show.ts').then(m => m.default),
    create: () => import('./create.ts').then(m => m.default),
  },
})
