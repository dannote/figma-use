import { defineCommand } from 'citty'

export default defineCommand({
  meta: { description: 'Analyze design patterns' },
  subCommands: {
    clusters: () => import('./clusters.ts').then((m) => m.default),
    colors: () => import('./colors.ts').then((m) => m.default),
    typography: () => import('./typography.ts').then((m) => m.default),
    spacing: () => import('./spacing.ts').then((m) => m.default),
    snapshot: () => import('./snapshot.ts').then((m) => m.default)
  }
})
