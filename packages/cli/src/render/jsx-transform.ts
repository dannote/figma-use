import { transformSync } from 'esbuild'
import { INTRINSIC_ELEMENTS } from './components.tsx'

const JSX_DEFINE = Object.fromEntries(
  INTRINSIC_ELEMENTS.map((name) => [name, JSON.stringify(name.toLowerCase())])
)

/**
 * Transform JSX snippet to ES module using esbuild.
 *
 * Supports:
 * - Pure JSX: `<Frame />`
 * - JSX with setup code: `const x = 1; <Frame style={{width: x}} />`
 * - JSX with defineVars: `const colors = defineVars({...}); <Frame style={{backgroundColor: colors.primary}} />`
 */
export function transformJsxSnippet(code: string): string {
  const snippet = code.trim()

  // Full module with imports/exports — use as-is
  if (snippet.includes('import ') || snippet.includes('export ')) {
    return transformSync(snippet, {
      loader: 'tsx',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      define: JSX_DEFINE
    }).code
  }

  // Snippet mode: wrap in factory function
  // Find where JSX starts (first < followed by uppercase letter)
  const jsxStart = snippet.search(/<[A-Z]/)
  const hasSetupCode = jsxStart > 0
  const usesDefineVars = snippet.includes('defineVars')

  let fullCode: string
  if (hasSetupCode) {
    const setupPart = snippet.slice(0, jsxStart).trim()
    const jsxPart = snippet.slice(jsxStart)
    const params = usesDefineVars ? '(React, { defineVars })' : '(React)'
    fullCode = `export default ${params} => { ${setupPart}; return () => (${jsxPart}); };`
  } else {
    fullCode = `export default (React) => () => (${snippet});`
  }

  const result = transformSync(fullCode, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    define: JSX_DEFINE
  })

  return result.code
}
