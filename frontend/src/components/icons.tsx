import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  strokeWidth?: number
  className?: string
}

function Svg({ size = 22, strokeWidth = 2, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
    <path d="M3 9.5h18" />
    <path d="M8 2.5v4M16 2.5v4" />
  </Svg>
)

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18" />
  </Svg>
)

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 11.5a8 8 0 0 1-11.5 7.2L4 20.5l1.8-5.4A8 8 0 1 1 21 11.5z" />
    <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
  </Svg>
)

export const IconNews = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h13a1 1 0 0 1 1 1v13a2 2 0 0 0 2-2V8" />
    <rect x="4" y="5" width="14" height="16" rx="1" />
    <path d="M7 9h8M7 13h8M7 17h5" />
  </Svg>
)

export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8.5 13h7M8.5 17h7" />
  </Svg>
)

export const IconLandmark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M4 10h16" />
    <path d="M12 3 4 7h16z" />
    <path d="M6 10v9M10 10v9M14 10v9M18 10v9" />
  </Svg>
)

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3v6h-6" />
    <path d="M21 9A9 9 0 1 0 18.4 18.4" />
  </Svg>
)

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </Svg>
)

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
  </Svg>
)

export const IconPaperclip = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8.5 12.3 17.2a4 4 0 0 1-5.6-5.7l8.5-8.5a2.6 2.6 0 0 1 3.7 3.7l-8.6 8.5a1.2 1.2 0 0 1-1.7-1.7l7.9-7.9" />
  </Svg>
)

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)

export const IconBan = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6 18.4 18.4" />
  </Svg>
)
