const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  'aria-hidden': true,
} as const

export const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} {...base}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
    />
  </svg>
)
export const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
)
export const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 8v5m0 3h.01" />
  </svg>
)
