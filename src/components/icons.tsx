/**
 * Icons.
 *
 * Drawn here rather than pulled from a library, for two reasons. Square line
 * caps match a design where nothing is rounded, and the set is small enough that
 * consistency matters more than coverage. Every icon is a 24-unit grid, stroked
 * at 1.6 with no fill, so they all weigh the same next to 13px text.
 */
import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

function Glyph({ children, size = 16, className, strokeWidth = 1.6, title }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------- navigation --------------------------------------------------- */

export const IconToday = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 5h18v15H3zM3 10h18M8 3v4M16 3v4" />
  </Glyph>
);

export const IconProjects = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 6h6l2 2h10v11H3z" />
  </Glyph>
);

export const IconClass = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 4 2 9l10 5 10-5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
  </Glyph>
);

export const IconScales = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 4v16M6 20h12M4 8h16M4 8l-2 6h4zM20 8l2 6h-4z" />
  </Glyph>
);

export const IconPerson = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </Glyph>
);

export const IconPeople = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5M17 5.5a3.2 3.2 0 0 1 0 6.4M18 14.7c2.4.5 4 2.2 4 4.8" />
  </Glyph>
);

export const IconBell = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3zM10 20a2 2 0 0 0 4 0" />
  </Glyph>
);

export const IconSettings = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
    <path d="M12 2.5 13 5l2.6-.6 1.4 2.4-1.9 1.9.9 2.4 2.6.6v2.6l-2.6.6-.9 2.4 1.9 1.9-1.4 2.4-2.6-.6-1 2.5h-2l-1-2.5-2.6.6-1.4-2.4L5 17l-.9-2.4-2.6-.6v-2.6l2.6-.6.9-2.4L3 6.8l1.4-2.4L7 5l1-2.5z" />
  </Glyph>
);

export const IconSparkle = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </Glyph>
);

/* ---------- actions ----------------------------------------------------- */

export const IconSearch = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5" />
  </Glyph>
);

export const IconMenu = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Glyph>
);

export const IconClose = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </Glyph>
);

export const IconPlus = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
);

export const IconCheck = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 12.5 9 18 20 6" />
  </Glyph>
);

export const IconChevronDown = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 9l6 6 6-6" />
  </Glyph>
);

export const IconChevronRight = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 5l7 7-7 7" />
  </Glyph>
);

export const IconChevronLeft = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Glyph>
);

export const IconArrowRight = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Glyph>
);

export const IconTrash = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
  </Glyph>
);

export const IconPencil = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4" />
  </Glyph>
);

export const IconWand = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 20 15 9M14 4l1 2.5L17.5 8 15 9 14 11.5 13 9 10.5 8 13 6.5zM20 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Glyph>
);

export const IconShuffle = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 6h4l10 12h4M3 18h4l3-3.6M17 6h4M18 3l3 3-3 3M18 15l3 3-3 3" />
  </Glyph>
);

export const IconList = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 6h16M4 12h16M4 18h16M2 6h.01M2 12h.01M2 18h.01" />
  </Glyph>
);

export const IconColumns = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 4h5v16H3zM10 4h4v16h-4zM17 4h4v16h-4z" />
  </Glyph>
);

export const IconRows = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 4h18v5H3zM3 11h18v4H3zM3 17h18v3H3z" />
  </Glyph>
);

export const IconTimeline = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 4v16M4 8h12M4 14h8M4 20h14" />
  </Glyph>
);

export const IconCalendar = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 5h18v15H3zM3 10h18M8 3v4M16 3v4M8 14h3v3H8z" />
  </Glyph>
);

export const IconClock = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2" />
  </Glyph>
);

export const IconMessage = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 5h18v11H8l-5 4z" />
  </Glyph>
);

export const IconLink = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 15l6-6M8 4H5v3M16 20h3v-3M10 5.5 12 3.5a4 4 0 0 1 6 6l-2 2M14 18.5 12 20.5a4 4 0 0 1-6-6l2-2" />
  </Glyph>
);

export const IconExternal = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </Glyph>
);

export const IconFilter = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </Glyph>
);

export const IconMore = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.4} />
  </Glyph>
);

export const IconDrag = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" strokeWidth={2.6} />
  </Glyph>
);

export const IconCopy = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 9h11v11H9zM5 15H4V4h11v1" />
  </Glyph>
);

export const IconDownload = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </Glyph>
);

export const IconLogout = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 4h5v16h-5M12 8l-4 4 4 4M8 12h9" />
  </Glyph>
);

/* ---------- meaning ----------------------------------------------------- */

export const IconAlert = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3 2 20h20zM12 9v5M12 17h.01" />
  </Glyph>
);

export const IconInfo = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />
  </Glyph>
);

export const IconBlocked = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12" />
  </Glyph>
);

export const IconTarget = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </Glyph>
);

export const IconTrend = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </Glyph>
);

export const IconHand = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v6M12 11V4.5a1.5 1.5 0 0 1 3 0V11M15 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 3 0v1" />
  </Glyph>
);

export const IconFlag = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 21V4h11l-1.5 4L16 12H5" />
  </Glyph>
);

export const IconRocket = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3c4 2 6 6 6 10l-3 3H9l-3-3c0-4 2-8 6-10zM9 16l-2 5 3-2M15 16l2 5-3-2M12 10h.01" />
  </Glyph>
);

export const IconBook = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 4h7v16H4zM13 4h7v16h-7zM11 4v16" />
  </Glyph>
);

export const IconBulb = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3z" />
  </Glyph>
);

export const IconLock = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4M12 15v3" />
  </Glyph>
);

export const IconEye = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
  </Glyph>
);

export const IconCode = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" />
  </Glyph>
);

export const IconPlay = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7 4l12 8-12 8z" />
  </Glyph>
);

export const IconBuilding = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 21V4h10v17M14 10h6v11M7 8h4M7 12h4M7 16h4M17 14h1M17 18h1" />
  </Glyph>
);

export const IconClipboard = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 4H6v17h12V4h-3M9 4V3h6v1zM9 11h6M9 15h4" />
  </Glyph>
);

export const IconUndo = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 12h11a5 5 0 0 1 0 10h-3M4 12l5-5M4 12l5 5" />
  </Glyph>
);

export const IconLoad = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 20h18M3 16h12M3 12h18M3 8h9M3 4h15" />
  </Glyph>
);

export const IconSplit = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3v6M12 15v6M5 9h14v6H5zM3 6h4v6H3zM17 6h4v6h-4z" />
  </Glyph>
);

export const IconStar = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.2-5.5-3-5.5 3 1.1-6.2L3 9.6l6.3-.9z" />
  </Glyph>
);

export const IconCompass = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z" />
  </Glyph>
);
