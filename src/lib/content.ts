import seed from "@/data/seed.json";

export type MediaItem = {
  id: string;
  alt: string;
  src: string;
  fit?: "cover" | "contain";
  position?: string;
};

export type NavigationItem = {
  id: string;
  label: string;
  visible: boolean;
  hidden: boolean;
  slug: string;
};

export type Company = {
  id: string;
  href: string;
  name: string;
  category: string;
  image: MediaItem;
  logos: MediaItem[];
};

export type AlbumPhoto = MediaItem & {
  row: number;
  ratio: number;
  caption: string;
};

export type Album = {
  id: string;
  title: string;
  photos: AlbumPhoto[];
};

export type GalleryTile = {
  id: string;
  span: number;
  albumId: string;
  title: string;
  image: MediaItem;
};

export type Topic = { id: string; icon: string; title: string };
export type AdditionalLink = { id: string; text: string; href: string; button?: string };
export type Channel = {
  id: string;
  icon: string;
  title: string;
  text: string;
  href: string;
  button: string;
  additionalLinks: AdditionalLink[];
};

export type Colleague = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  emailButton: string;
  phoneButton: string;
};

export type DocumentLink = {
  id: string;
  title: string;
  description: string;
  url: string;
};

export type HiddenPage = {
  id: string;
  slug: string;
  label: string;
  showInNav: boolean;
  eyebrow: string;
  title: string;
  body: string;
  image: MediaItem;
  documents: DocumentLink[];
};

export type SiteContent = {
  home: {
    logo: MediaItem;
    portrait: MediaItem;
    text: string;
  };
  site: {
    legal: string;
    theme: {
      ink: string;
      line: string;
      muted: string;
      accent: string;
      surface: string;
      accentDark: string;
      background: string;
      portraitBackground: string;
    };
    title: string;
    design: {
      font: string;
      rounded: number;
      contentWidth: number;
      backgroundImage: string;
      backgroundOpacity: number;
    };
    labels: Record<string, string>;
    favicon: string;
    lastName: string;
    firstName: string;
    navigation: NavigationItem[];
    description: string;
    sectionOrder: string[];
  };
  about: {
    title: string;
    images: MediaItem[];
    introduction: string;
    missions: string;
  };
  hours: {
    days: number[];
    morningStart: string;
    morningEnd: string;
    afternoonStart: string;
    afternoonEnd: string;
  };
  albums: Album[];
  contact: {
    lead: string;
    title: string;
    choice: string;
    topics: Topic[];
    subject: string;
    welcome: string;
    channels: Channel[];
    portrait: MediaItem;
    question: string;
    colleagues: Colleague[];
    invitation: string;
    colleaguesTitle: string;
  };
  gallery: {
    tiles: GalleryTile[];
    title: string;
  };
  companies: Company[];
  hiddenPages: HiddenPage[];
  updatedAt: string;
  [key: string]: unknown;
};

export const initialContent = seed as unknown as SiteContent;

export function cloneContent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getPageTitle(content: SiteContent, id: string): string {
  return content.site.navigation.find((item) => item.id === id)?.label ?? id;
}

/** Identifiant de version utilisé pour la synchronisation en direct du site public. */
export function contentVersion(content: SiteContent | null | undefined): string {
  if (content && typeof content.updatedAt === "string" && content.updatedAt) return content.updatedAt;
  return "initial";
}
