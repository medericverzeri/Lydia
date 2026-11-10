import { randomUUID } from "node:crypto";
import { db } from "../db";
import { adminSettings, contactMessages, mediaAssets, siteContent } from "../db/schema";
import { cloneContent, contentVersion, initialContent, type SiteContent } from "./content";
import { desc, eq, sql } from "drizzle-orm";
import embeddedMedia from "../data/embedded-media.json";

type EmbeddedAsset = {
  id: string;
  name: string;
  mime: string;
  kind: string;
  size: number;
  data: string;
};

const embedded = embeddedMedia as { assets: EmbeddedAsset[]; urlMap: Record<string, string> };
const embeddedIds = new Set(embedded.assets.map((asset) => asset.id));

export type MediaRecord = {
  id: string;
  name: string;
  mime: string;
  kind: string;
  size: number;
  createdAt: string;
  url: string;
};

export type MessageRecord = {
  id: number;
  name: string;
  email: string;
  phone: string;
  organization: string;
  topic: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type AdminSnapshot = {
  draft: SiteContent;
  published: SiteContent;
  publishedAt: string | null;
  draftUpdatedAt: string | null;
  media: MediaRecord[];
  messages: MessageRecord[];
};

let ready: Promise<void> | null = null;

function replaceLegacyUrls<T>(value: T): T {
  if (typeof value === "string") return (embedded.urlMap[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((item) => replaceLegacyUrls(item)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = replaceLegacyUrls(item);
    return result as T;
  }
  return value;
}

/**
 * Les médias sont embarqués sous forme de texte dans src/data/embedded-media.json.
 * Ils sont restaurés en base au premier lancement : le dossier public n'est
 * donc plus indispensable, même si un export de projet est incomplet.
 */
async function seedEmbeddedMedia(): Promise<void> {
  const existingRows = await db.select({ id: mediaAssets.id }).from(mediaAssets);
  const existing = new Set(existingRows.map((row) => row.id));
  const missing = embedded.assets.filter((asset) => !existing.has(asset.id));
  for (let index = 0; index < missing.length; index += 8) {
    const chunk = missing.slice(index, index + 8).map((asset) => ({
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      kind: asset.kind,
      size: asset.size,
      data: asset.data,
    }));
    await db.insert(mediaAssets).values(chunk).onConflictDoNothing();
  }
}

/** Migre les anciennes URL /media/... et /documents/... déjà présentes en base. */
async function migrateLegacyContent(): Promise<void> {
  const rows = await db.select().from(siteContent).where(eq(siteContent.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return;
  const published = replaceLegacyUrls(row.published);
  const draft = replaceLegacyUrls(row.draft);
  const changed = JSON.stringify(published) !== JSON.stringify(row.published)
    || JSON.stringify(draft) !== JSON.stringify(row.draft);
  if (changed) {
    await db.update(siteContent).set({ published, draft }).where(eq(siteContent.id, 1));
  }
}

async function initialize(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_content (
      id integer PRIMARY KEY,
      published jsonb NOT NULL,
      draft jsonb NOT NULL,
      published_at timestamptz NOT NULL DEFAULT now(),
      draft_updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      mime text NOT NULL,
      kind text NOT NULL,
      size integer NOT NULL,
      data text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id serial PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      phone text NOT NULL DEFAULT '',
      organization text NOT NULL DEFAULT '',
      topic text NOT NULL DEFAULT '',
      message text NOT NULL,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id integer PRIMARY KEY,
      password_hash text NOT NULL,
      session_secret text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const fresh = cloneContent(initialContent);
  await db
    .insert(siteContent)
    .values({ id: 1, published: fresh, draft: cloneContent(initialContent) })
    .onConflictDoNothing();

  await seedEmbeddedMedia();
  await migrateLegacyContent();
}

export async function ensureDatabase(): Promise<void> {
  if (!ready) ready = initialize().catch((error) => {
    ready = null;
    throw error;
  });
  await ready;
}

export async function getPublishedContent(): Promise<SiteContent> {
  await ensureDatabase();
  const rows = await db.select({ published: siteContent.published }).from(siteContent).where(eq(siteContent.id, 1)).limit(1);
  return rows[0]?.published ?? cloneContent(initialContent);
}

export async function getPublishedVersion(): Promise<string> {
  await ensureDatabase();
  const rows = await db
    .select({ published: siteContent.published, publishedAt: siteContent.publishedAt })
    .from(siteContent)
    .where(eq(siteContent.id, 1))
    .limit(1);
  const row = rows[0];
  if (!row) return contentVersion(initialContent);
  return contentVersion(row.published) === "initial"
    ? (row.publishedAt?.toISOString() ?? "initial")
    : contentVersion(row.published);
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  await ensureDatabase();
  const [rows, mediaRows, messageRows] = await Promise.all([
    db.select().from(siteContent).where(eq(siteContent.id, 1)).limit(1),
    db.select({
      id: mediaAssets.id,
      name: mediaAssets.name,
      mime: mediaAssets.mime,
      kind: mediaAssets.kind,
      size: mediaAssets.size,
      createdAt: mediaAssets.createdAt,
    }).from(mediaAssets).orderBy(desc(mediaAssets.createdAt)),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(100),
  ]);
  const row = rows[0];
  return {
    draft: row?.draft ?? cloneContent(initialContent),
    published: row?.published ?? cloneContent(initialContent),
    publishedAt: row?.publishedAt?.toISOString() ?? null,
    draftUpdatedAt: row?.draftUpdatedAt?.toISOString() ?? null,
    media: mediaRows.filter((item) => !embeddedIds.has(item.id)).map((item) => ({
      id: item.id,
      name: item.name,
      mime: item.mime,
      kind: item.kind,
      size: item.size,
      createdAt: item.createdAt.toISOString(),
      url: `/api/media/${item.id}`,
    })),
    messages: messageRows.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      organization: item.organization,
      topic: item.topic,
      message: item.message,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function getMediaStats(): Promise<{
  embeddedAvailable: number;
  embeddedTotal: number;
  uploaded: number;
}> {
  await ensureDatabase();
  const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets);
  return {
    embeddedAvailable: rows.filter((item) => embeddedIds.has(item.id)).length,
    embeddedTotal: embedded.assets.length,
    uploaded: rows.filter((item) => !embeddedIds.has(item.id)).length,
  };
}

/** Contrôle public : prouve que les médias sont bien présents dans le build et en base. */
export async function getDeployCheck() {
  const media = await getMediaStats();
  return {
    embeddedMediaInBuild: embedded.assets.length,
    embeddedMediaInDatabase: media.embeddedAvailable,
    uploadedMedia: media.uploaded,
    publicFolderRequired: false,
  };
}

export function validateContent(value: unknown): SiteContent {
  if (!value || typeof value !== "object") throw new Error("Contenu invalide.");
  const candidate = value as Partial<SiteContent>;
  if (!candidate.site || !candidate.home || !candidate.about || !candidate.gallery || !candidate.contact) {
    throw new Error("Le contenu est incomplet.");
  }
  if (!Array.isArray(candidate.site.navigation) || !Array.isArray(candidate.albums) || !Array.isArray(candidate.companies)) {
    throw new Error("La structure du contenu est invalide.");
  }
  if (JSON.stringify(value).length > 2_000_000) throw new Error("Le contenu dépasse la taille autorisée.");
  const normalized = cloneContent(value) as SiteContent;
  normalized.hiddenPages = Array.isArray(normalized.hiddenPages) ? normalized.hiddenPages : [];
  normalized.site.navigation = normalized.site.navigation.map((item) => ({
    ...item,
    visible: item.visible !== false,
    hidden: Boolean(item.hidden),
    slug: item.slug || item.id,
  }));
  return normalized;
}

export async function saveContent(content: SiteContent, publish: boolean): Promise<void> {
  await ensureDatabase();
  const now = new Date();
  if (publish) {
    await db.insert(siteContent).values({
      id: 1,
      published: content,
      draft: content,
      publishedAt: now,
      draftUpdatedAt: now,
    }).onConflictDoUpdate({
      target: siteContent.id,
      set: { published: content, draft: content, publishedAt: now, draftUpdatedAt: now },
    });
  } else {
    await db.insert(siteContent).values({
      id: 1,
      published: content,
      draft: content,
      draftUpdatedAt: now,
    }).onConflictDoUpdate({
      target: siteContent.id,
      set: { draft: content, draftUpdatedAt: now },
    });
  }
}

export async function createMedia(input: {
  name: string;
  mime: string;
  kind: "image" | "pdf";
  size: number;
  buffer: Buffer;
}): Promise<MediaRecord> {
  await ensureDatabase();
  const id = randomUUID();
  await db.insert(mediaAssets).values({
    id,
    name: input.name,
    mime: input.mime,
    kind: input.kind,
    size: input.size,
    data: input.buffer.toString("base64"),
  });
  return {
    id,
    name: input.name,
    mime: input.mime,
    kind: input.kind,
    size: input.size,
    createdAt: new Date().toISOString(),
    url: `/api/media/${id}`,
  };
}

export async function getMedia(id: string) {
  await ensureDatabase();
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMedia(id: string): Promise<void> {
  await ensureDatabase();
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
}

export async function createMessage(input: {
  name: string;
  email: string;
  phone: string;
  organization: string;
  topic: string;
  message: string;
}): Promise<void> {
  await ensureDatabase();
  await db.insert(contactMessages).values(input);
}

export async function setMessageRead(id: number, isRead: boolean): Promise<void> {
  await ensureDatabase();
  await db.update(contactMessages).set({ isRead }).where(eq(contactMessages.id, id));
}

export async function deleteMessage(id: number): Promise<void> {
  await ensureDatabase();
  await db.delete(contactMessages).where(eq(contactMessages.id, id));
}
