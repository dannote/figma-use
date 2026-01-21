/** @jsxImportSource ../../src/render */
import { Frame, Text } from '../../src/render/index.ts'

type CardProps = {
  title: string
  items: string[]
  variant?: 'primary' | 'secondary'
}

export default function Card({ title, items, variant = 'primary' }: CardProps) {
  const bgColor = variant === 'primary' ? '#3B82F6' : '#6B7280'

  return (
    <Frame name="Card" w={320} h={400} bg="#FFFFFF" flex="col" gap={16} p={24} rounded={12}>
      <Text name="Title" size={24} weight="bold" color="#111827">
        {title}
      </Text>

      <Frame name="Items" flex="col" gap={8} w={272}>
        {items.map((item, i) => (
          <Frame
            key={i}
            name={`Item ${i + 1}`}
            flex="row"
            gap={12}
            py={12}
            px={16}
            bg="#F3F4F6"
            rounded={8}
          >
            <Frame w={8} h={8} bg={bgColor} rounded={4} />
            <Text size={14} color="#374151">
              {item}
            </Text>
          </Frame>
        ))}
      </Frame>

      <Frame name="Actions" flex="row" gap={8}>
        <Frame name="Primary Button" bg={bgColor} py={12} px={24} rounded={8}>
          <Text color="#FFFFFF" size={14} weight={500}>
            Action
          </Text>
        </Frame>
        <Frame name="Secondary Button" bg="#E5E7EB" py={12} px={24} rounded={8}>
          <Text color="#374151" size={14} weight={500}>
            Cancel
          </Text>
        </Frame>
      </Frame>
    </Frame>
  )
}
