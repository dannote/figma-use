#!/usr/bin/env bun
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Use source files directly (Bun handles TypeScript)
// This ensures defineComponent registry is shared with imported .figma.tsx files
const cliPath = join(__dirname, '..', 'packages', 'cli', 'src', 'index.ts')

const child = spawn('bun', ['run', cliPath, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code || 0))
