import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { SiteContent } from "@/lib/content";

export const siteContent = pgTable("site_content", {
  id: integer("id").primaryKey(),
  published: jsonb("published").$type<SiteContent>().notNull(),
  draft: jsonb("draft").$type<SiteContent>().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  kind: text("kind").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminSettings = pgTable("admin_settings", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  sessionSecret: text("session_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  organization: text("organization").notNull().default(""),
  topic: text("topic").notNull().default(""),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type ContactMessageRow = typeof contactMessages.$inferSelect;
