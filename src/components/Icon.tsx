// Minimal inline icon set (stroke-based), so the app ships zero icon deps.
type P = { size?: number; className?: string }
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
})

export const IconPlay = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
export const IconPause = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} fill="currentColor" stroke="none">
    <rect x="6.5" y="5.5" width="3.5" height="13" rx="1" />
    <rect x="14" y="5.5" width="3.5" height="13" rx="1" />
  </svg>
)
export const IconStepF = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M7 5l8 7-8 7z" fill="currentColor" stroke="none" />
    <path d="M17 5v14" />
  </svg>
)
export const IconStepB = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M17 5l-8 7 8 7z" fill="currentColor" stroke="none" />
    <path d="M7 5v14" />
  </svg>
)
export const IconLoop = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M17 2l3 3-3 3" />
    <path d="M3 11V9a4 4 0 0 1 4-4h13" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M21 13v2a4 4 0 0 1-4 4H4" />
  </svg>
)
export const IconBranch = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.4 6H13a3 3 0 0 1 3 3v.4" />
  </svg>
)
export const IconPlus = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconUpload = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
  </svg>
)
export const IconCompare = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="7" height="14" rx="1.5" />
    <rect x="14" y="5" width="7" height="14" rx="1.5" />
    <path d="M12 3v18" strokeDasharray="2 2.5" />
  </svg>
)
export const IconClose = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconCheck = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
)
export const IconPin = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
)
export const IconChat = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
  </svg>
)
export const IconTrash = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
)
export const IconChevron = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const IconBack = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconLayers = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
  </svg>
)
export const IconDownload = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
)
export const IconClock = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const IconFolder = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)
export const IconImage = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9" r="1.6" />
    <path d="M21 16l-5-5-7 7" />
  </svg>
)
export const IconVideo = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="13" height="14" rx="2" />
    <path d="M16 9l5-3v12l-5-3z" />
  </svg>
)
export const IconPdf = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
)
export const IconAudio = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6" cy="18" r="2.6" />
    <circle cx="16" cy="16" r="2.6" />
  </svg>
)
export const IconLottie = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7 14c2-6 8-6 10 0" />
  </svg>
)
export const IconGrid = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </svg>
)
export const IconList = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
)
export const IconStar = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} fill="currentColor" stroke="none">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
)
export const IconStarOutline = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
)
export const IconMore = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)
export const IconEdit = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)
export const IconBell = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)
export const IconUser = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)
export const IconLogout = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)
export const IconShield = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)
