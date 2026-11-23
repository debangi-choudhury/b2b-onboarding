import type { CSSProperties } from 'react'

/**
 * Colors and shared styles for the applicant pages (design A, "Guided steps"),
 * matched to the B2B theme's navy header. Inline styles keep the look the same
 * under any store theme; CSS handles still allow overrides.
 */
export const color = {
  navy: '#14233C',
  accent: '#2552D0',
  accentDark: '#1A3FA6',
  accentSoft: '#E3EAFB',
  accentRing: '#DCE5FA',
  ground: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#DDE3EE',
  borderStrong: '#C5CEDD',
  text: '#1B2433',
  textSoft: '#4A5468',
  textMuted: '#5B6577',
  success: '#1F8A5B',
  successSoft: '#F1FAF5',
  successBorder: '#CFE7DA',
  danger: '#B32A24',
  dangerBorder: '#C2362F',
  warningSoft: '#FFF6E5',
  warningBorder: '#F2D49B',
  warningText: '#5A4210',
  dropBorder: '#9FB2DA',
  dropSoft: '#F7F9FE',
}

export const card: CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: 16,
  boxSizing: 'border-box',
}

export const primaryButton = (disabled = false): CSSProperties => ({
  minHeight: 48,
  padding: '0 28px',
  borderRadius: 10,
  border: 'none',
  background: disabled ? '#A9BCEB' : color.accent,
  color: '#FFFFFF',
  font: 'inherit',
  fontWeight: 600,
  fontSize: 15,
  cursor: disabled ? 'default' : 'pointer',
})

export const secondaryButton: CSSProperties = {
  minHeight: 44,
  padding: '0 18px',
  borderRadius: 10,
  border: `1px solid ${color.borderStrong}`,
  background: color.surface,
  color: color.text,
  font: 'inherit',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
}

export const input = (hasError: boolean): CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  height: 46,
  padding: '0 14px',
  border: hasError
    ? `1.5px solid ${color.dangerBorder}`
    : `1px solid ${color.borderStrong}`,
  borderRadius: 10,
  background: color.surface,
  color: color.text,
  font: 'inherit',
  fontSize: 15,
})

export const label: CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 6,
  color: color.text,
}
