// Example: Render a card component to Figma
// Usage: figma-use render examples/Card.figma.tsx --props '{"title": "Hello", "items": ["A", "B", "C"]}'

type CardProps = {
  title: string
  items: string[]
  variant?: 'primary' | 'secondary'
}

export default function Card({ title, items, variant = 'primary' }: CardProps) {
  const bgColor = variant === 'primary' ? '#3B82F6' : '#6B7280'

  return (
    <frame
      name="Card"
      width={320}
      height={400}
      fill="#FFFFFF"
      layout="col"
      gap={16}
      padding={24}
      radius={12}
    >
      <text name="Title" fontSize={24} fontStyle="Bold" fill="#111827">
        {title}
      </text>

      <frame name="Items" layout="col" gap={8} width={272}>
        {items.map((item, i) => (
          <frame
            key={i}
            name={`Item ${i + 1}`}
            layout="row"
            gap={12}
            padding={[12, 16]}
            fill="#F3F4F6"
            radius={8}
          >
            <frame width={8} height={8} fill={bgColor} radius={4} />
            <text fontSize={14} fill="#374151">
              {item}
            </text>
          </frame>
        ))}
      </frame>

      <frame name="Actions" layout="row" gap={8}>
        <frame name="Primary Button" fill={bgColor} padding={[12, 24]} radius={8}>
          <text fill="#FFFFFF" fontSize={14} fontStyle="Medium">
            Action
          </text>
        </frame>
        <frame name="Secondary Button" fill="#E5E7EB" padding={[12, 24]} radius={8}>
          <text fill="#374151" fontSize={14} fontStyle="Medium">
            Cancel
          </text>
        </frame>
      </frame>
    </frame>
  )
}
