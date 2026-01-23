#!/usr/bin/env node

// Enable V8 compile cache for faster subsequent runs
import { enableCompileCache } from 'node:module'
try {
  enableCompileCache()
} catch {}

import('../dist/cli/index.js')
