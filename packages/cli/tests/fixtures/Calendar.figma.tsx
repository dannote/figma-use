/**
 * Calendar component in Nuxt UI style with blue accent colors
 */

import * as React from 'react'
import { Frame, Text } from '../../src/render/index.ts'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_DAYS = [
  [null, null, null, null, null, 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
  [31, null, null, null, null, null, null],
]

const colors = {
  bg: '#FFFFFF',
  bgHover: '#F9FAFB',
  text: '#111827',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryText: '#FFFFFF',
}

const DayHeader = ({ day }: { day: string }) => (
  <Frame
    name={`header-${day}`}
    style={{
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Text style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>
      {day}
    </Text>
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }

  const style = isSelected 
    ? { ...baseStyle, backgroundColor: colors.primary }
    : isToday 
      ? { ...baseStyle, backgroundColor: colors.bgHover }
      : baseStyle

  return (
    <Frame name={`day-${day}`} style={style}>
      <Text style={{ fontSize: 14, fontWeight: isSelected || isToday ? 600 : 400, color: textColor }}>
        {String(day)}
      </Text>
    </Frame>
  )
}

const WeekRow = ({ days, selectedDay, today }: { days: (number | null)[]; selectedDay?: number; today?: number }) => (
  <Frame style={{ flexDirection: 'row', gap: 4 }}>
    {days.map((day, i) => (
      <DayCell 
        key={i} 
        day={day} 
        isSelected={day === selectedDay}
        isToday={day === today}
      />
    ))}
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
        borderWidth: 1,
      }}
    >
      {/* Header */}
      <Frame style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: 308, height: 40 }}>
        <Frame style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: colors.bgHover, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textMuted }}>‹</Text>
        </Frame>
        <Text style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
          January 2026
        </Text>
        <Frame style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: colors.bgHover, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textMuted }}>›</Text>
        </Frame>
      </Frame>

      {/* Days header */}
      <Frame style={{ flexDirection: 'row', gap: 4 }}>
        {DAYS.map(day => <DayHeader key={day} day={day} />)}
      </Frame>

      {/* Calendar grid */}
      {MONTH_DAYS.map((week, i) => (
        <WeekRow key={i} days={week} selectedDay={selectedDay} today={today} />
      ))}
    </Frame>
  )
}
