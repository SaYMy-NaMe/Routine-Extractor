import { type EmptyDayBadgeStyle, badgeDisplayText } from '../../../domain'
import { cx } from '../../components/ui'
import { badgeCss } from './badgeCss'

interface Props {
  style: EmptyDayBadgeStyle
  collapsed?: boolean
  block?: boolean
  onClick?: () => void
  title?: string
  className?: string
}

/** The customisable "No Class" / "Weekend" badge used by the grid and the card view. */
export function EmptyDayBadge({ style, collapsed, block, onClick, title, className }: Props) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={badgeCss(style)}
      className={cx(
        'inline-flex items-center justify-center rounded-full',
        collapsed ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        block && 'w-full rounded-lg',
        onClick &&
          'focus-visible:ring-theory-500/50 cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {badgeDisplayText(style)}
    </Tag>
  )
}
