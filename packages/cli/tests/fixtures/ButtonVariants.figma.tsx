import * as React from 'react'
import { Frame, Text, defineComponentSet } from '../../src/render/index.ts'

const Button = defineComponentSet('Button', {
  variant: ['Primary', 'Secondary'] as const,
  size: ['Small', 'Large'] as const,
}, ({ variant, size }) => (
  <Frame style={{ 
    padding: size === 'Large' ? 16 : 8, 
    backgroundColor: variant === 'Primary' ? '#3B82F6' : '#E5E7EB',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    <Text style={{ 
      fontSize: size === 'Large' ? 16 : 14, 
      color: variant === 'Primary' ? '#FFFFFF' : '#111827',
      fontWeight: '500'
    }}>
      {variant} {size}
    </Text>
  </Frame>
))

export default () => (
  <Frame name="Button Variants" style={{ 
    flexDirection: 'column', 
    gap: 16, 
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16
  }}>
    <Button variant="Primary" size="Large" />
    <Button variant="Primary" size="Small" />
    <Button variant="Secondary" size="Large" />
    <Button variant="Secondary" size="Small" />
  </Frame>
)
