/**
 * Double Calendar component - January & February 2026
 * Uses CSS Grid for the days layout
 */

import { Frame, Text } from '../../src/render/index.ts'

const colors = {
  bg: '#FFFFFF',
  bgHover: '#EFF6FF',
  text: '#111827',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#3B82F6',
  primaryText: '#FFFFFF'
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const JANUARY = [
  null, null, null, null, null, 1, 2,
  3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30,
  31, null, null, null, null, null, null
]

const FEBRUARY = [
  null, null, null, null, null, null, 1,
  2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, null,
  null, null, null, null, null, null, null
]

const DayHeader = ({ day }: { day: string }) => (
  <Frame
    style={{
      width: 36,
      height: 32,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}
  >
    <Text style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>{day}</Text>
  </Frame>
)

const DayCell = ({
  day,
  isSelected,
  isToday
}: {
  day: number | null
  isSelected?: boolean
  isToday?: boolean
}) => {
  if (day === null) return <Frame style={{ width: 36, height: 36 }} />

  const textColor = isSelected ? colors.primaryText : isToday ? colors.primary : colors.text

  return (
    <Frame
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isSelected ? colors.primary : isToday ? colors.bgHover : undefined
      }}
    >
      <Text
        style={{ fontSize: 14, fontWeight: isSelected || isToday ? 600 : 400, color: textColor }}
      >
        {String(day)}
      </Text>
    </Frame>
  )
}

const MonthGrid = ({
  title,
  days,
  selectedDay,
  today
}: {
  title: string
  days: (number | null)[]
  selectedDay?: number
  today?: number
}) => (
  <Frame style={{ flexDirection: 'column', gap: 4 }}>
    {/* Month title */}
    <Frame
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 32 }}
    >
      <Text style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</Text>
    </Frame>

    {/* Days header - 7 column grid */}
    <Frame
      style={{
        display: 'grid',
        cols: '36px 36px 36px 36px 36px 36px 36px',
        colGap: 2
      }}
    >
      {DAYS.map((d) => (
        <DayHeader key={d} day={d} />
      ))}
    </Frame>

    {/* Days grid - 7 columns × 6 rows */}
    <Frame
      name="Days Grid"
      style={{
        display: 'grid',
        cols: '36px 36px 36px 36px 36px 36px 36px',
        rows: '36px 36px 36px 36px 36px 36px',
        gap: 2
      }}
    >
      {days.map((day, i) => (
        <DayCell key={i} day={day} isSelected={day === selectedDay} isToday={day === today} />
      ))}
    </Frame>
  </Frame>
)

export default function CalendarDouble() {
  return (
    <Frame
      name="Double Calendar"
      style={{
        backgroundColor: colors.bg,
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        gap: 32,
        borderColor: colors.border,
        borderWidth: 1
      }}
    >
      <MonthGrid title="January 2026" days={JANUARY} selectedDay={18} today={17} />
      <MonthGrid title="February 2026" days={FEBRUARY} selectedDay={14} />
    </Frame>
  )
}
