import * as esbuild from 'esbuild'

const [, uiBuild] = await Promise.all([
  esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/main.js',
    target: 'es2015',
    treeShaking: true,
    minify: true,
  }),
  esbuild.build({
    entryPoints: ['src/ui.ts'],
    bundle: true,
    write: false,
    target: 'es2015'
  })
])

const uiJs = uiBuild.outputFiles![0].text
const uiHtml = await Bun.file('src/ui.html').text()
const inlinedHtml = uiHtml.replace('<script src="ui.js"></script>', `<script>${uiJs}</script>`)
await Bun.write('dist/ui.html', inlinedHtml)

// Copy and update manifest
const manifest = await Bun.file('manifest.json').json()
manifest.name = 'Figma Use'
manifest.id = 'figma-use-plugin'
manifest.main = 'main.js'
manifest.ui = 'ui.html'
manifest.networkAccess.reasoning = 'Connect to local proxy server for CLI control'
await Bun.write('dist/manifest.json', JSON.stringify(manifest, null, 2))
