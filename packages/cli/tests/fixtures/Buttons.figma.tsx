import * as React from 'react'
import { defineComponentSet, Frame, Text } from '../../src/render/index.ts'

const Button = defineComponentSet('Button', {
  size: ['Small', 'Medium', 'Large'] as const,
}, ({ size }) => {
  const styles = {
    Small: { paddingV: 8, paddingH: 16, fontSize: 14 },
    Medium: { paddingV: 10, paddingH: 20, fontSize: 16 },
    Large: { paddingV: 14, paddingH: 28, fontSize: 18 },
  }
  
  const s = styles[size]
  
  return (
    <Frame style={{ 
      paddingTop: s.paddingV,
      paddingBottom: s.paddingV,
      paddingLeft: s.paddingH,
      paddingRight: s.paddingH,
      backgroundColor: '#3B82F6',
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{ 
        fontSize: s.fontSize,
        fontWeight: '600',
        color: '#FFFFFF',
      }}>
        Button
      </Text>
    </Frame>
  )
})

export default function ButtonSet() {
  return (
    <Frame style={{ gap: 24, flexDirection: 'row', padding: 40 }}>
      <Button size="Small" />
      <Button size="Medium" />
      <Button size="Large" />
    </Frame>
  )
}
