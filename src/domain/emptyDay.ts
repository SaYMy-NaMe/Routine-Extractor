/**
 * Empty-day badge: how a day with no scheduled classes is presented.
 *
 * The rules live in the domain because they shape the printed routine as
 * well as the on-screen grid — every renderer (grid, cards, print sheet,
 * PDF, DOCX) derives its output from the same settings.
 */

import type { OffDayStatus } from './schedule'

/** Which empty-day states get their own badge style. */
export type EmptyDayKind = Exclude<OffDayStatus, 'none'>

export type BadgeBorder = 'none' | 'solid' | 'dashed' | 'accent'

export interface EmptyDayBadgeStyle {
  /** Badge text, e.g. "No Class On this day". */
  readonly text: string
  /** 6-digit hex colours. */
  readonly background: string
  readonly color: string
  readonly bold: boolean
  readonly italic: boolean
  readonly uppercase: boolean
  readonly wideTracking: boolean
  /** Emoji/glyph shown before the text when `showIcon` is on. */
  readonly icon: string
  readonly showIcon: boolean
  readonly border: BadgeBorder
  readonly borderColor: string
}

/**
 * How empty days are laid out:
 *  - `badge`     full-width badge across the row (default)
 *  - `collapsed` a slim row with a small badge
 *  - `hidden`    the day row is omitted entirely
 *  - `cells`     no badge — the empty cells are shown as usual
 */
export type EmptyDayMode = 'badge' | 'collapsed' | 'hidden' | 'cells'

export interface EmptyDaySettings {
  readonly mode: EmptyDayMode
  /**
   * When true the evening column is part of the empty state: a day with an
   * evening class is not empty, and the badge spans the evening cell too.
   * When false the evening cell is always rendered on its own.
   */
  readonly spanEvening: boolean
  readonly badges: Readonly<Record<EmptyDayKind, EmptyDayBadgeStyle>>
}

export const DEFAULT_NO_CLASS_BADGE: EmptyDayBadgeStyle = Object.freeze({
  text: 'No Class On this day',
  background: '#F3F4F6',
  color: '#4B5563',
  bold: true,
  italic: false,
  uppercase: true,
  wideTracking: true,
  icon: '🚫',
  showIcon: false,
  border: 'none',
  borderColor: '#9CA3AF',
})

export const DEFAULT_WEEKEND_BADGE: EmptyDayBadgeStyle = Object.freeze({
  ...DEFAULT_NO_CLASS_BADGE,
  text: 'Weekend',
  background: '#FFF7E6',
  color: '#92400E',
  icon: '🌤️',
  borderColor: '#F59E0B',
})

export const DEFAULT_EMPTY_DAY_SETTINGS: EmptyDaySettings = Object.freeze({
  mode: 'badge',
  spanEvening: true,
  badges: { 'no-class': DEFAULT_NO_CLASS_BADGE, weekend: DEFAULT_WEEKEND_BADGE },
})

export const BADGE_ICONS = ['🚫', '☕', '🌿', '📚', '🏖️', '🌤️', '💤', '✨'] as const
export const BADGE_TEXT_MAX = 60

const HEX_RE = /^#[0-9a-f]{6}$/i

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v)

/** The badge text exactly as it should be printed (icon + case rules applied). */
export function badgeDisplayText(style: EmptyDayBadgeStyle, opts: { icon?: boolean } = {}): string {
  const text = (style.text.trim() || 'No Class').slice(0, BADGE_TEXT_MAX)
  const cased = style.uppercase ? text.toUpperCase() : text
  return opts.icon !== false && style.showIcon && style.icon ? `${style.icon} ${cased}` : cased
}

/** Coerce untrusted (persisted) data into valid badge settings. */
export function coerceBadgeStyle(raw: unknown, fallback: EmptyDayBadgeStyle): EmptyDayBadgeStyle {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Partial<Record<keyof EmptyDayBadgeStyle, unknown>>
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  return {
    text: typeof r.text === 'string' ? r.text.slice(0, BADGE_TEXT_MAX) : fallback.text,
    background: isHexColor(r.background) ? r.background : fallback.background,
    color: isHexColor(r.color) ? r.color : fallback.color,
    bold: bool(r.bold, fallback.bold),
    italic: bool(r.italic, fallback.italic),
    uppercase: bool(r.uppercase, fallback.uppercase),
    wideTracking: bool(r.wideTracking, fallback.wideTracking),
    icon: typeof r.icon === 'string' ? r.icon.slice(0, 4) : fallback.icon,
    showIcon: bool(r.showIcon, fallback.showIcon),
    border:
      r.border === 'solid' || r.border === 'dashed' || r.border === 'accent' || r.border === 'none'
        ? r.border
        : fallback.border,
    borderColor: isHexColor(r.borderColor) ? r.borderColor : fallback.borderColor,
  }
}

export function coerceEmptyDaySettings(raw: unknown): EmptyDaySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_EMPTY_DAY_SETTINGS
  const r = raw as Partial<EmptyDaySettings>
  const badges = (r.badges ?? {}) as Partial<Record<EmptyDayKind, unknown>>
  return {
    mode: r.mode === 'collapsed' || r.mode === 'hidden' || r.mode === 'cells' ? r.mode : 'badge',
    spanEvening: r.spanEvening !== false,
    badges: {
      'no-class': coerceBadgeStyle(badges['no-class'], DEFAULT_NO_CLASS_BADGE),
      weekend: coerceBadgeStyle(badges.weekend, DEFAULT_WEEKEND_BADGE),
    },
  }
}
