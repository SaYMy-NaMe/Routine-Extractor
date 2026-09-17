import type { CSSProperties } from 'react'
import type { EmptyDayBadgeStyle } from '../../../domain'

/** Inline styles derived from the user's badge customisation. */
export function badgeCss(style: EmptyDayBadgeStyle): CSSProperties {
  const border =
    style.border === 'solid'
      ? `1px solid ${style.borderColor}`
      : style.border === 'dashed'
        ? `1px dashed ${style.borderColor}`
        : undefined
  return {
    background: style.background,
    color: style.color,
    fontWeight: style.bold ? 700 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    letterSpacing: style.wideTracking ? '0.15em' : '0.02em',
    border,
    borderLeft: style.border === 'accent' ? `4px solid ${style.borderColor}` : border,
    // An accent bar reads better on a squared badge than on a pill.
    borderRadius: style.border === 'accent' ? 6 : undefined,
  }
}
