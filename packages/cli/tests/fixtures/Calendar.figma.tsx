/**
 * Calendar component in Nuxt UI style with blue accent colors and Iconify icons
 */

import * as React from 'react'
import { Frame, Text, Icon } from '../../src/render/index.ts'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_DAYS = [
  [null, null, null, null, null, 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
  [31, null, null, null, null, null, null]
]

const colors = {
  bg: '#FFFFFF',
  bgHover: '#EFF6FF',
  text: '#111827',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#3B82F6',
  primaryText: '#FFFFFF'
}

const DayHeader = ({ day }: { day: string }) => (
  <Frame
    name={`header-${day}`}
    style={{
      width: 40,
      height: 40,
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
  if (day === null) {
    return <Frame name="empty" style={{ width: 40, height: 40 }} />
  }

  const textColor = isSelected ? colors.primaryText : isToday ? colors.primary : colors.text
  const baseStyle = {
    width: 40,
    height: 40,
    borderRadius: 8,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const
  }

  const style = isSelected
    ? { ...baseStyle, backgroundColor: colors.primary }
    : isToday
      ? { ...baseStyle, backgroundColor: colors.bgHover }
      : baseStyle

  return (
    <Frame name={`day-${day}`} style={style}>
      <Text
        style={{ fontSize: 14, fontWeight: isSelected || isToday ? 600 : 400, color: textColor }}
      >
        {String(day)}
      </Text>
    </Frame>
  )
}

const WeekRow = ({
  days,
  selectedDay,
  today
}: {
  days: (number | null)[]
  selectedDay?: number
  today?: number
}) => (
  <Frame style={{ flexDirection: 'row', gap: 4, width: 308, height: 40 }}>
    {days.map((day, i) => (
      <DayCell key={i} day={day} isSelected={day === selectedDay} isToday={day === today} />
    ))}
  </Frame>
)

const NavButton = ({ direction }: { direction: 'left' | 'right' }) => (
  <Frame
    name={`nav-${direction}`}
    style={{
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.bgHover,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}
  >
    <Icon
      icon={direction === 'left' ? 'lucide:chevron-left' : 'lucide:chevron-right'}
      size={18}
      color={colors.textMuted}
    />
  </Frame>
)

export default function Calendar() {
  const selectedDay = 18
  const today = 17

  return (
    <Frame
      name="Calendar"
      style={{
        width: 340,
        height: 420,
        backgroundColor: colors.bg,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'column',
        gap: 8,
        borderColor: colors.border,
        borderWidth: 1
      }}
    >
      {/* Header with navigation */}
      <Frame
        name="header"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 308,
          height: 40
        }}
      >
        <NavButton direction="left" />
        <Frame
          style={{
            width: 200,
            height: 32,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Icon icon="lucide:calendar" size={18} color={colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>January 2026</Text>
        </Frame>
        <NavButton direction="right" />
      </Frame>

      {/* Days header */}
      <Frame style={{ flexDirection: 'row', gap: 4, width: 308, height: 40 }}>
        {DAYS.map((day) => (
          <DayHeader key={day} day={day} />
        ))}
      </Frame>

      {/* Calendar grid */}
      {MONTH_DAYS.map((week, i) => (
        <WeekRow key={i} days={week} selectedDay={selectedDay} today={today} />
      ))}

      {/* Footer with today button */}
      <Frame
        name="footer"
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          width: 308,
          height: 36,
          marginTop: 8
        }}
      >
        <Frame
          name="today-button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 12,
            height: 32,
            borderRadius: 6,
            backgroundColor: colors.bgHover
          }}
        >
          <Icon icon="lucide:circle-dot" size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: 500, color: colors.primary }}>Today</Text>
        </Frame>
      </Frame>
    </Frame>
  )
}
