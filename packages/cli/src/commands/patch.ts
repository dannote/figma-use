import { defineCommand } from 'citty'

import { isFigmaPatched, patchFigma } from '../patch-figma.ts'
import { figmaLaunchHint } from '../format.ts'
import { getCdpPort } from '../cdp.ts'

export default defineCommand({
  meta: {
    description:
      'Patch Figma to allow remote debugging (required for Figma 126+)'
  },
  async run() {
    const status = isFigmaPatched()

    if (status === null) {
      console.error('Figma installation not found or not supported on this platform.')
      process.exit(1)
    }

    if (status === true) {
      console.log('Figma is already patched.')
      return
    }

    console.log('Figma 126+ blocks --remote-debugging-port.')
    console.log('This will patch app.asar and re-sign the app.\n')

    try {
      patchFigma()
    } catch (e) {
      console.error('Patch failed:', (e as Error).message)
      process.exit(1)
    }

    console.log('Patched successfully.')
    console.log(`Restart Figma with: ${figmaLaunchHint(getCdpPort())}`)
  }
})
