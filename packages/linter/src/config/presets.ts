import type { Severity } from '../core/types.ts'

type RuleConfig = Severity | { severity: Severity; options?: Record<string, unknown> }

export interface Preset {
  rules: Record<string, RuleConfig>
}

export const recommended: Preset = {
  rules: {
    'no-hardcoded-colors': 'warning',
    'no-default-names': 'info',
    'prefer-auto-layout': 'info',
    'consistent-spacing': 'warning',
    'consistent-radius': 'info',
    'color-contrast': 'error',
    'touch-target-size': 'warning',
    'text-style-required': 'info',
    'min-text-size': 'warning',
    'no-hidden-layers': 'info',
    'no-deeply-nested': 'warning',
    'no-empty-frames': 'info',
    'pixel-perfect': 'info',
    'no-groups': 'info',
    'effect-style-required': 'info',
    'no-mixed-styles': 'warning',
    'no-detached-instances': 'off',
  },
}

export const strict: Preset = {
  rules: {
    'no-hardcoded-colors': 'error',
    'no-default-names': 'warning',
    'prefer-auto-layout': 'warning',
    'consistent-spacing': 'error',
    'consistent-radius': 'warning',
    'color-contrast': 'error',
    'touch-target-size': 'error',
    'text-style-required': 'warning',
    'min-text-size': 'error',
    'no-hidden-layers': 'warning',
    'no-deeply-nested': 'error',
    'no-empty-frames': 'warning',
    'pixel-perfect': 'warning',
    'no-groups': 'warning',
    'effect-style-required': 'warning',
    'no-mixed-styles': 'error',
    'no-detached-instances': 'warning',
  },
}

export const accessibility: Preset = {
  rules: {
    'color-contrast': 'error',
    'touch-target-size': 'error',
    'min-text-size': 'error',
    // Disable others
    'no-hardcoded-colors': 'off',
    'no-default-names': 'off',
    'prefer-auto-layout': 'off',
    'consistent-spacing': 'off',
    'consistent-radius': 'off',
    'text-style-required': 'off',
    'no-hidden-layers': 'off',
    'no-deeply-nested': 'off',
    'no-empty-frames': 'off',
    'pixel-perfect': 'off',
    'no-groups': 'off',
    'effect-style-required': 'off',
    'no-mixed-styles': 'off',
    'no-detached-instances': 'off',
  },
}

export const designSystem: Preset = {
  rules: {
    'no-hardcoded-colors': 'error',
    'no-default-names': 'error',
    'prefer-auto-layout': 'error',
    'consistent-spacing': 'error',
    'consistent-radius': 'error',
    'color-contrast': 'error',
    'touch-target-size': 'error',
    'text-style-required': 'error',
    'min-text-size': 'error',
    'no-hidden-layers': 'error',
    'no-deeply-nested': 'error',
    'no-empty-frames': 'error',
    'pixel-perfect': 'error',
    'no-groups': 'error',
    'effect-style-required': 'error',
    'no-mixed-styles': 'error',
    'no-detached-instances': 'error',
  },
}

export const presets: Record<string, Preset> = {
  recommended,
  strict,
  accessibility,
  'design-system': designSystem,
}
