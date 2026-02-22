import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, isSmokeEnabled, mcpRequest, toolExists } from './helpers'

type FailureCase = {
  tool: string
  args: Record<string, unknown>
  expectedIncludes: string | string[]
}

const CASES: FailureCase[] = [
  { tool: 'figma_page_set', args: { page: '' }, expectedIncludes: 'Page not found' },
  {
    tool: 'figma_page_current',
    args: {},
    expectedIncludes: "Cannot read properties of undefined (reading 'trim')"
  },
  { tool: 'figma_viewport_zoom-to-fit', args: { ids: '1:2' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_variable_set', args: { id: 'VariableID:0:0', mode: '0:0', value: '1' }, expectedIncludes: 'Variable' },
  { tool: 'figma_variable_bind', args: { node: '1:2', field: 'fills', variable: 'VariableID:0:0' }, expectedIncludes: 'Node not found' },
  { tool: 'figma_variable_create', args: { name: 'x', collection: 'VariableCollectionId:0:0', type: 'COLOR', value: '#FF0000' }, expectedIncludes: 'Collection not found' },
  { tool: 'figma_group_ungroup', args: { id: '1:2' }, expectedIncludes: 'Not a group node' },
  { tool: 'figma_group_create', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_group_flatten', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_path_get', args: { id: '1:2' }, expectedIncludes: 'Vector node not found' },
  { tool: 'figma_path_scale', args: { id: '1:2', factor: '1.1' }, expectedIncludes: 'Vector node not found' },
  { tool: 'figma_path_set', args: { id: '1:2', path: 'M0 0 L10 0 L5 8 Z' }, expectedIncludes: 'Vector node not found' },
  { tool: 'figma_path_flip', args: { id: '1:2', axis: 'x' }, expectedIncludes: 'Vector node not found' },
  { tool: 'figma_path_move', args: { id: '1:2', dx: '1', dy: '1' }, expectedIncludes: 'Vector node not found' },
  { tool: 'figma_component_edit-prop', args: { id: '1:2', name: 'liked', default: 'true' }, expectedIncludes: 'Component not found' },
  { tool: 'figma_component_delete-prop', args: { id: '1:2', name: 'liked' }, expectedIncludes: 'Component not found' },
  { tool: 'figma_component_add-prop', args: { id: '1:2', name: 'liked', type: 'BOOLEAN', default: 'false' }, expectedIncludes: 'Component not found' },
  { tool: 'figma_component_combine', args: { ids: '1:2,1:3', name: 'Set' }, expectedIncludes: 'not a component' },
  { tool: 'figma_diff_apply', args: { file: '/tmp/does-not-exist.patch' }, expectedIncludes: 'Error' },
  { tool: 'figma_diff_visual', args: { from: '1:2', to: '1:3', output: '/tmp/out.png' }, expectedIncludes: 'Node not found' },
  { tool: 'figma_diff_jsx', args: { from: '1:2', to: '1:3' }, expectedIncludes: 'Node not found' },
  { tool: 'figma_diff_create', args: { from: '1:2', to: '1:3' }, expectedIncludes: 'Node not found' },
  { tool: 'figma_boolean_union', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_boolean_exclude', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_boolean_intersect', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_boolean_subtract', args: { ids: '1:2,1:3' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_connector_get', args: { id: '1:2' }, expectedIncludes: 'Connector not found' },
  { tool: 'figma_connector_set', args: { id: '1:2', type: 'straight' }, expectedIncludes: 'Connector not found' },
  { tool: 'figma_connector_create', args: { from: '1:2', to: '1:3' }, expectedIncludes: 'FigJam files' },
  { tool: 'figma_selection_set', args: { ids: '1:2' }, expectedIncludes: 'c.map is not a function' },
  { tool: 'figma_set_text-resize', args: { id: '1:2', mode: 'height' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_image', args: { id: '1:2', file: '/tmp/x.png', mode: 'FILL' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_props', args: { id: '1:2', prop: 'x=true' }, expectedIncludes: 'Instance not found' },
  { tool: 'figma_set_radius', args: { id: '1:2', radius: '12' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_opacity', args: { id: '1:2', value: '0.8' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_layout', args: { id: '1:2', mode: 'VERTICAL', gap: '8', padding: '12' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_visible', args: { id: '1:2', value: 'true' }, expectedIncludes: 'Error' },
  { tool: 'figma_set_locked', args: { id: '1:2', value: 'false' }, expectedIncludes: 'Error' },
  { tool: 'figma_node_to-component', args: { ids: '1:2' }, expectedIncludes: 'trim' },
  { tool: 'figma_node_set-parent', args: { id: '1:2', parent: '1:3' }, expectedIncludes: 'Node or parent not found' },
  { tool: 'figma_node_replace-with', args: { id: '1:2', target: '1:3' }, expectedIncludes: 'Target node not found' },
  { tool: 'figma_export_fonts', args: { page: '___missing___' }, expectedIncludes: 'Page not found' },
  { tool: 'figma_export_selection', args: { format: 'PNG', output: '/tmp/sel.png' }, expectedIncludes: 'No selection' },
  { tool: 'figma_create_instance', args: { component: '1:2', x: '10', y: '10' }, expectedIncludes: 'Component not found' }
]

function isFailingRegressionEnabled(): boolean {
  return process.env.RUN_FAILING_REGRESSION === '1'
}

describe('smoke/failing-tools-regression', () => {
  beforeAll(async () => {
    if (!isSmokeEnabled() || !isFailingRegressionEnabled()) return
    await ensureMcpReady()
  })

  for (const c of CASES) {
    test(`${c.tool} currently fails with expected signature`, async () => {
      if (!isSmokeEnabled() || !isFailingRegressionEnabled()) return
      if (!(await toolExists(c.tool))) return

      const expected = Array.isArray(c.expectedIncludes)
        ? c.expectedIncludes
        : [c.expectedIncludes]

      const response = await mcpRequest('tools/call', {
        name: c.tool,
        arguments: c.args
      })

      if (response.error) {
        expect(expected.some((v) => response.error!.message.includes(v))).toBe(true)
        return
      }

      expect(response.result).toBeDefined()
      expect(response.result!.isError).toBe(true)
      const text = response.result!.content?.find((x) => x.type === 'text')?.text || ''
      expect(expected.some((v) => text.includes(v))).toBe(true)
    })
  }
})
