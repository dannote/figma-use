import * as esbuild from 'esbuild'

const [, uiBuild] = await Promise.all([
  esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/main.js',
    target: 'es2015'
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
const inlinedHtml = uiHtml.replace(
  '<script src="ui.js"></script>',
  `<script>${uiJs}</script>`
)
await Bun.write('dist/ui.html', inlinedHtml)
