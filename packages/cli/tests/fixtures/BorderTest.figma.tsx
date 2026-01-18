import * as React from "react"
import { defineVars, Frame } from "../../src/render/index.ts"

const colors = defineVars({
  border: "Colors/Gray/500",
  fill: "Colors/Gray/50",
})

export default function Test() {
  return (
    <Frame 
      name="BorderTest"
      style={{ 
        width: 100, 
        height: 100, 
        borderColor: colors.border,
        borderWidth: 2,
        backgroundColor: colors.fill
      }} 
    />
  )
}
