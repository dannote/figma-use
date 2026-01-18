import * as React from 'react'
import { Frame, Text, defineComponent } from '../../src/render/index.ts'

const Button = defineComponent('Button',
  <Frame style={{ 
    padding: 12, 
    backgroundColor: "#3B82F6", 
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <Text style={{ fontSize: 14, color: "#FFFFFF", fontWeight: '500' }}>Click me</Text>
  </Frame>
)

export default () => (
  <Frame name="Buttons" style={{ 
    flexDirection: 'column', 
    gap: 16, 
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16
  }}>
    <Button />
    <Button />
    <Button />
  </Frame>
)
