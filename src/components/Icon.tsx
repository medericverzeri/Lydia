import type { ReactNode } from "react";

type IconName =
  | "diagonal" | "down" | "up" | "back" | "next" | "zoom" | "menu" | "close"
  | "clock" | "grid" | "globe" | "phone" | "mail" | "lock" | "upload"
  | "trash" | "plus" | "external" | "eye" | "eyeOff" | "check" | "file"
  | "image" | "save" | "refresh" | "copy" | "chevron" | "dots";

const paths: Record<IconName, ReactNode> = {
  diagonal: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  down: <><path d="M12 4v15" /><path d="m6 13 6 6 6-6" /></>,
  up: <><path d="M12 20V5" /><path d="m6 11 6-6 6 6" /></>,
  back: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  next: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  zoom: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M11 8v6M8 11h6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" /></>,
  phone: <path d="M7 3h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3c0 1-1 2-2 2A16 16 0 0 1 5 5c0-1 1-2 2-2Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3h16v-3" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 6.2A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.3 7.8C3.5 9.5 2 12 2 12s4 6 10 6a10 10 0 0 0 4-.8" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></>,
  save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.5 9a7 7 0 0 1 12-2l1.5 3M17.5 15a7 7 0 0 1-12 2L4 14" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export type { IconName };
