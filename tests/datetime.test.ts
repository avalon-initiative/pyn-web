import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../src/state/datetime.state'

describe('date and time formatting', () => {
  it('prints Mon DD YYYY and HH:MM in the given timezone', () => {
    expect(formatDate('2026-06-09T14:05:33.652Z', 'UTC')).toBe('Jun 09 2026')
    expect(formatDateTime('2026-06-09T14:05:33.652Z', 'UTC')).toBe('Jun 09 2026 14:05')
  })

  it('converts from UTC across the date line', () => {
    expect(formatDateTime('2026-06-09T23:30:00Z', 'Asia/Tokyo')).toBe('Jun 10 2026 08:30')
    expect(formatDateTime('2026-01-01T03:00:00Z', 'America/New_York')).toBe('Dec 31 2025 22:00')
  })

  it('uses a 24-hour clock at midnight', () => {
    expect(formatDateTime('2026-06-09T00:05:00Z', 'UTC')).toBe('Jun 09 2026 00:05')
  })
})
