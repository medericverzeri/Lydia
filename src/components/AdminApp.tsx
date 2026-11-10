"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AdminButton, Card, ColorField, Field, MediaField, NumberField, RecordHead, TextField, Toggle,
  type MediaKind, type PickMediaHandler,
} from "./AdminFields";
import { Icon, type IconName } from "./Icon";
import referenceMedia from "../data/reference-media.json";
import mediaUrls from "../data/media-urls.json";
import { cloneContent, contentVersion, type SiteContent } from "../lib/content";
import type { AdminSnapshot, MediaRecord, MessageRecord } from "../lib/data";

type PathPart = string | number;
type StaticMedia = { name: string; url: string; mime: string; kind: string };
type Notice = { text: string; error: boolean } | null;
type Diagnostic = {
  database: "ok" | "error";
  publishedVersion: string;
  liveSync: boolean;
  hosting: string;
  environment: { DATABASE_URL: boolean; ADMIN_PASSWORD: boolean; ADMIN_SESSION_SECRET: boolean };
  storage: string;
  media: { embeddedAvailable: number; embeddedTotal: number; uploaded: number };
  publicFolderRequired: boolean;
  checks: { label: string; ok: boolean }[];
};

const staticMedia = referenceMedia as StaticMedia[];
const fallbackImage = mediaUrls.fallbackUrl;
const logoUrl = mediaUrls.logoUrl;
const uid = () => `item-${Math.random().toString(36).slice(2, 10)}`;
const envTemplate = `DATABASE_URL=postgresql://utilisateur:mot_de_passe@hote/neondb?sslmode=require
ADMIN_PASSWORD=une-phrase-longue-et-unique
ADMIN_SESSION_SECRET=resultat-de-openssl-rand-hex-32`;

function parsePath(path: string): PathPart[] {
  return path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function setAt(root: unknown, parts: PathPart[], value: unknown): void {
  // The editor works on a fresh JSON clone; loose indexing keeps nested paths simple.
  let cursor = root as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor[parts[index] as keyof typeof cursor];
    if (!cursor || typeof cursor !== "object") return;
  }
  cursor[parts[parts.length - 1] as keyof typeof cursor] = value;
}

function arrayAt(root: unknown, parts: PathPart[]): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const value = parts.reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[String(part)];
  }, root);
  return Array.isArray(value) ? value : [];
}

function newMedia(src = fallbackImage, alt = "Nouveau visuel") {
  return { id: uid(), alt, src, fit: "cover" as const, position: "50% 50%" };
}

function LoginPanel({ setupRequired, blocked }: { setupRequired: boolean; blocked: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (setupRequired && password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(setupRequired ? "/api/admin/setup" : "/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Connexion impossible.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login">
        <img src={logoUrl} alt="Matériosol" />
        <h1>Espace <em>administration</em></h1>
        {blocked ? (
          <>
            <p>Configuration incomplète sur Vercel.</p>
            <div className="admin-notice error">
              Ajoutez <strong>ADMIN_PASSWORD</strong> et <strong>ADMIN_SESSION_SECRET</strong> dans Vercel → Settings → Environment Variables, puis redéployez une fois.
            </div>
          </>
        ) : (
          <>
            <p>{setupRequired
              ? "Première ouverture de l’aperçu : créez votre mot de passe administrateur. Il sera stocké haché dans la base de données."
              : "Modifiez le site en toute sécurité. Le contenu public n’est remplacé qu’au moment où vous cliquez sur « Enregistrer »."}</p>
            <form onSubmit={submit}>
              <label>{setupRequired ? "Créer un mot de passe (8 caractères minimum)" : "Mot de passe administrateur"}
                <input type="password" value={password} minLength={setupRequired ? 8 : undefined} autoComplete={setupRequired ? "new-password" : "current-password"} required onChange={(event) => setPassword(event.target.value)} />
              </label>
              {setupRequired && (
                <label style={{ marginTop: 12 }}>Confirmer le mot de passe
                  <input type="password" value={confirm} minLength={8} autoComplete="new-password" required onChange={(event) => setConfirm(event.target.value)} />
                </label>
              )}
              {error && <div className="admin-notice error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
              <AdminButton type="submit" variant="primary" disabled={loading}><Icon name="lock" />{loading ? "Vérification…" : setupRequired ? "Créer mon accès" : "Ouvrir l’éditeur"}</AdminButton>
            </form>
            <small>Accès protégé par une session signée et un cookie HTTP-only. Sur Vercel, le mot de passe est fourni par la variable ADMIN_PASSWORD.</small>
          </>
        )}
      </div>
    </main>
  );
}

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "identity", label: "Identité & thème", icon: "eye" },
  { id: "home", label: "Accueil & horaires", icon: "image" },
  { id: "about", label: "À propos", icon: "file" },
  { id: "network", label: "Réseau d’entreprises", icon: "grid" },
  { id: "gallery", label: "Galerie & albums", icon: "image" },
  { id: "contact", label: "Contact", icon: "mail" },
  { id: "hidden", label: "Pages masquées", icon: "lock" },
  { id: "media", label: "Médias & PDF", icon: "upload" },
  { id: "messages", label: "Messages", icon: "mail" },
  { id: "json", label: "JSON avancé", icon: "file" },
  { id: "publish", label: "Publication & Vercel", icon: "save" },
];

function AdminStudio({ snapshot }: { snapshot: AdminSnapshot }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SiteContent>(() => cloneContent(snapshot.draft));
  const [published, setPublished] = useState<SiteContent>(() => cloneContent(snapshot.published));
  const [publishedAt, setPublishedAt] = useState(snapshot.publishedAt);
  const [media, setMedia] = useState<MediaRecord[]>(snapshot.media);
  const [messages, setMessages] = useState<MessageRecord[]>(snapshot.messages);
  const [tab, setTab] = useState("identity");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [picker, setPicker] = useState<{ path: string; kind: MediaKind } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [checking, setChecking] = useState(false);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);

  const jsonValue = jsonDraft ?? JSON.stringify(draft, null, 2);

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  // Si une autre session admin publie, l'éditeur se synchronise sans écraser
  // les modifications locales non enregistrées.
  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (!active || document.visibilityState !== "visible" || dirtyRef.current || savingRef.current) return;
      try {
        const versionResponse = await fetch("/api/content/version", { cache: "no-store" });
        const versionData = (await versionResponse.json()) as { version?: string };
        if (!active || !versionData.version || versionData.version === contentVersion(published)) return;
        const response = await fetch("/api/admin/content", { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = (await response.json()) as AdminSnapshot;
        if (!active || dirtyRef.current) return;
        setPublished(cloneContent(snapshot.published));
        setDraft(cloneContent(snapshot.draft));
        setPublishedAt(snapshot.publishedAt);
        setMedia(snapshot.media);
        setMessages(snapshot.messages);
        setNotice({ text: "Une nouvelle version publiée a été synchronisée dans l’éditeur.", error: false });
      } catch {
        // La synchronisation est facultative : aucune interruption de l'édition.
      }
    };
    const timer = window.setInterval(sync, 15000);
    const onVisible = () => { void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [published]);

  function mutate(change: (next: SiteContent) => void) {
    setDraft((current) => {
      const next = cloneContent(current);
      change(next);
      return next;
    });
    setDirty(true);
  }

  function set(path: string, value: unknown) {
    mutate((next) => setAt(next, parsePath(path), value));
  }

  function addAt(path: string, item: unknown) {
    mutate((next) => arrayAt(next, parsePath(path)).push(cloneContent(item)));
  }

  function removeAt(path: string, index: number) {
    mutate((next) => arrayAt(next, parsePath(path)).splice(index, 1));
  }

  function moveAt(path: string, index: number, delta: number) {
    mutate((next) => {
      const items = arrayAt(next, parsePath(path));
      const target = index + delta;
      if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
    });
  }

  const openPicker: PickMediaHandler = (path, kind) => setPicker({ path, kind });

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    let lastUrl = "";
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/admin/media", { method: "POST", body: form });
        const data = (await response.json()) as { media?: MediaRecord; error?: string };
        if (!response.ok || !data.media) throw new Error(data.error ?? "Téléversement impossible.");
        setMedia((current) => [data.media as MediaRecord, ...current]);
        lastUrl = data.media.url;
      }
      if (picker && lastUrl) set(picker.path, lastUrl);
      setNotice({ text: `${files.length} fichier${files.length > 1 ? "s" : ""} hébergé${files.length > 1 ? "s" : ""} sur le site.`, error: false });
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Téléversement impossible.", error: true });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function chooseStatic(url: string) {
    if (!picker) return;
    set(picker.path, url);
    setPicker(null);
    setNotice({ text: "Média sélectionné. Cliquez sur « Enregistrer » pour publier ce changement.", error: false });
  }

  async function deleteUploaded(item: MediaRecord) {
    if (!window.confirm(`Supprimer « ${item.name} » de la bibliothèque ?`)) return;
    const response = await fetch(`/api/admin/media/${item.id}`, { method: "DELETE" });
    if (response.ok) setMedia((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function save(publish: boolean) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, publish }),
      });
      const data = (await response.json()) as { error?: string; content?: SiteContent; publishedAt?: string };
      if (!response.ok) throw new Error(data.error ?? "Enregistrement impossible.");
      const saved = data.content ? cloneContent(data.content) : cloneContent(draft);
      setDraft(saved);
      setJsonDraft(null);
      if (publish) {
        setPublished(cloneContent(saved));
        setPublishedAt(data.publishedAt ?? new Date().toISOString());
        setDirty(false);
        setNotice({ text: "Enregistré : le site public est à jour immédiatement, sans redéploiement. Les pages déjà ouvertes se rafraîchissent seules.", error: false });
      } else {
        setNotice({ text: "Brouillon enregistré sur le serveur. Le site public reste inchangé tant que vous n’avez pas publié.", error: false });
      }
      router.refresh();
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Enregistrement impossible.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
    router.refresh();
  }

  async function checkDeployment() {
    setChecking(true);
    try {
      const response = await fetch("/api/admin/status", { cache: "no-store" });
      const data = (await response.json()) as Diagnostic & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Diagnostic impossible.");
      setDiagnostic(data);
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Diagnostic impossible.", error: true });
    } finally {
      setChecking(false);
    }
  }

  async function copyEnvTemplate() {
    try {
      await navigator.clipboard.writeText(envTemplate);
      setNotice({ text: "Modèle des 3 variables copié. Collez-le dans Vercel et remplacez les valeurs.", error: false });
    } catch {
      setNotice({ text: "Copie impossible : recopiez les 3 noms de variables depuis l’écran.", error: false });
    }
  }

  function restorePublished() {
    setDraft(cloneContent(published));
    setDirty(false);
    setJsonDraft(null);
    setNotice({ text: "Brouillon restauré depuis la version publiée.", error: false });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `materiosol-contenu-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as SiteContent;
      if (!parsed.site || !parsed.home || !parsed.gallery) throw new Error("Fichier JSON incomplet.");
      setDraft(parsed);
      setDirty(true);
      setNotice({ text: "Contenu importé dans le brouillon. Enregistrez pour publier.", error: false });
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "Import impossible.", error: true });
    } finally {
      event.target.value = "";
    }
  }

  async function copyPrivateLink(slug: string) {
    const link = `${window.location.origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice({ text: `Lien privé copié : ${link}`, error: false });
    } catch {
      setNotice({ text: `Lien privé : ${link}`, error: false });
    }
  }

  async function toggleRead(message: MessageRecord) {
    await fetch(`/api/admin/messages/${message.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: !message.isRead }) });
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, isRead: !item.isRead } : item));
  }

  async function removeMessage(message: MessageRecord) {
    if (!window.confirm("Supprimer ce message ?")) return;
    const response = await fetch(`/api/admin/messages/${message.id}`, { method: "DELETE" });
    if (response.ok) setMessages((current) => current.filter((item) => item.id !== message.id));
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonValue) as SiteContent;
      if (!parsed.site || !parsed.home || !parsed.contact) throw new Error("Le JSON doit contenir site, home et contact.");
      setDraft(parsed);
      setJsonDraft(null);
      setDirty(true);
      setNotice({ text: "JSON appliqué au brouillon. Enregistrez pour publier.", error: false });
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : "JSON invalide.", error: true });
    }
  }

  const renderIdentity = () => (
    <>
      <Card title="Identité & référencement" description="Ces informations apparaissent dans l’en-tête, le pied de page et les métadonnées.">
        <div className="admin-grid">
          <TextField label="Titre du site" value={draft.site.title} onChange={(value) => set("site.title", value)} />
          <TextField label="Description" value={draft.site.description} onChange={(value) => set("site.description", value)} />
          <TextField label="Prénom affiché" value={draft.site.firstName} onChange={(value) => set("site.firstName", value)} />
          <TextField label="Nom affiché" value={draft.site.lastName} onChange={(value) => set("site.lastName", value)} />
          <MediaField label="Favicon" src={draft.site.favicon} path="site.favicon" onPick={openPicker} />
          <MediaField label="Texture de fond" src={draft.site.design.backgroundImage} path="site.design.backgroundImage" onPick={openPicker} />
          <div style={{ gridColumn: "1 / -1" }}><TextField label="Mentions légales" value={draft.site.legal} multiline rows={5} onChange={(value) => set("site.legal", value)} /></div>
        </div>
      </Card>
      <Card title="Navigation & sections masquables" description="Décochez « Afficher » pour retirer un bouton. Activez « Page privée » pour déplacer la section sur une URL non listée, puis copiez son lien privé.">
        {draft.site.navigation.map((item, index) => (
          <div className="admin-record" key={item.id}>
            <RecordHead title={item.label || item.id} subtitle={`Section #${index + 1} · /p/${item.slug}`}>
              <AdminButton onClick={() => copyPrivateLink(item.slug)}><Icon name="copy" />Lien privé</AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <TextField label="Libellé du bouton" value={item.label} onChange={(value) => set(`site.navigation.${index}.label`, value)} />
              <TextField label="Identifiant URL" value={item.slug} onChange={(value) => set(`site.navigation.${index}.slug`, value)} />
              <div style={{ display: "grid", alignContent: "center", gap: 8 }}>
                <Toggle label="Afficher dans le menu" checked={item.visible !== false} onChange={(value) => set(`site.navigation.${index}.visible`, value)} />
                <Toggle label="Page privée (hors site principal)" checked={Boolean(item.hidden)} onChange={(value) => set(`site.navigation.${index}.hidden`, value)} />
              </div>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 10, color: "#71847a", lineHeight: 1.7 }}>L’ordre exact des sections est également modifiable dans l’onglet « JSON avancé » via <code>site.sectionOrder</code>.</p>
      </Card>
      <Card title="Couleurs & mise en page" description="La charte du site d’origine reste modifiable couleur par couleur.">
        <div className="admin-grid-3">
          {([
            ["accent", "Accent"], ["accentDark", "Accent foncé"], ["ink", "Texte"], ["background", "Fond"],
            ["surface", "Surface"], ["muted", "Texte secondaire"], ["line", "Bordures"], ["portraitBackground", "Fond portrait"],
          ] as const).map(([key, label]) => (
            <ColorField key={key} label={label} value={draft.site.theme[key]} onChange={(value) => set(`site.theme.${key}`, value)} />
          ))}
          <NumberField label="Arrondi (px)" value={draft.site.design.rounded} onChange={(value) => set("site.design.rounded", value)} />
          <NumberField label="Largeur du contenu (px)" value={draft.site.design.contentWidth} onChange={(value) => set("site.design.contentWidth", value)} />
          <NumberField label="Opacité texture" value={draft.site.design.backgroundOpacity} onChange={(value) => set("site.design.backgroundOpacity", value)} />
          <TextField label="Police" value={draft.site.design.font} onChange={(value) => set("site.design.font", value)} />
        </div>
      </Card>
      <Card title="Tous les libellés" description="Chaque micro-texte, bouton et message de l’interface publique est éditable.">
        <div className="admin-grid-3">
          {Object.entries(draft.site.labels).map(([key, value]) => (
            <TextField key={key} label={`Libellé · ${key}`} value={String(value)} multiline={String(value).length > 55} rows={2} onChange={(next) => set(`site.labels.${key}`, next)} />
          ))}
        </div>
      </Card>
    </>
  );

  const renderHome = () => (
    <>
      <Card title="Bandeau d’accueil" description="Le logo Matériosol remplace le logo Déchèt’Lab. Sélectionnez un autre fichier local pour le changer.">
        <div className="admin-grid">
          <div style={{ gridColumn: "1 / -1" }}><TextField label="Titre (une idée par ligne)" value={draft.home.text} multiline rows={3} onChange={(value) => set("home.text", value)} /></div>
          <MediaField label="Logo principal" src={draft.home.logo.src} path="home.logo.src" onPick={openPicker} />
          <MediaField label="Portrait" src={draft.home.portrait.src} path="home.portrait.src" onPick={openPicker} />
          <TextField label="Texte alternatif du logo" value={draft.home.logo.alt} onChange={(value) => set("home.logo.alt", value)} />
          <TextField label="Texte alternatif du portrait" value={draft.home.portrait.alt} onChange={(value) => set("home.portrait.alt", value)} />
          <TextField label="Cadrage du portrait" value={draft.home.portrait.position ?? "50% 50%"} onChange={(value) => set("home.portrait.position", value)} />
        </div>
      </Card>
      <Card title="Horaires & disponibilités" description="Ces valeurs alimentent le bandeau d’accueil et la fenêtre d’horaires.">
        <div className="admin-grid-3">
          {["morningStart", "morningEnd", "afternoonStart", "afternoonEnd"].map((key) => (
            <TextField key={key} label={key} value={String(draft.hours[key as keyof typeof draft.hours] as string)} onChange={(value) => set(`hours.${key}`, value)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((label, index) => {
            const day = index === 6 ? 0 : index + 1;
            return (
              <Toggle key={label} label={label} checked={draft.hours.days.includes(day)} onChange={(checked) => mutate((next) => {
                const days = new Set(next.hours.days);
                if (checked) days.add(day); else days.delete(day);
                next.hours.days = [...days].sort((a, b) => a - b);
              })} />
            );
          })}
        </div>
      </Card>
    </>
  );

  const renderAbout = () => (
    <>
      <Card title="Présentation & missions" description="Les paragraphes séparés par une ligne vide sont reproduits automatiquement.">
        <div className="admin-grid">
          <TextField label="Titre de section" value={draft.about.title} onChange={(value) => set("about.title", value)} />
          <div />
          <div style={{ gridColumn: "1 / -1" }}><TextField label="Introduction" value={draft.about.introduction} multiline rows={10} onChange={(value) => set("about.introduction", value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><TextField label="Missions (une par ligne)" value={draft.about.missions} multiline rows={9} onChange={(value) => set("about.missions", value)} /></div>
        </div>
      </Card>
      <Card title="Visuels de la section" description="Ajoutez, remplacez, réordonnez ou supprimez les images.">
        {draft.about.images.map((image, index) => (
          <div className="admin-record" key={image.id}>
            <RecordHead title={`Image ${index + 1}`} subtitle={image.alt}>
              <AdminButton onClick={() => moveAt("about.images", index, -1)} disabled={index === 0}>↑</AdminButton>
              <AdminButton onClick={() => moveAt("about.images", index, 1)} disabled={index === draft.about.images.length - 1}>↓</AdminButton>
              <AdminButton variant="danger" onClick={() => removeAt("about.images", index)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <MediaField label="Fichier image" src={image.src} path={`about.images.${index}.src`} onPick={openPicker} />
              <TextField label="Texte alternatif" value={image.alt} onChange={(value) => set(`about.images.${index}.alt`, value)} />
              <TextField label="Cadrage" value={image.position ?? "50% 50%"} onChange={(value) => set(`about.images.${index}.position`, value)} />
            </div>
          </div>
        ))}
        <AdminButton onClick={() => addAt("about.images", newMedia())}><Icon name="plus" />Ajouter une image</AdminButton>
      </Card>
    </>
  );

  const renderNetwork = () => (
    <Card title="Cartes du réseau" description="Le carrousel public affiche trois entreprises par page. Tous les champs, images et logos sont modifiables.">
      {draft.companies.map((company, index) => (
        <div className="admin-record" key={company.id}>
          <RecordHead title={company.name.replace(/\n/g, " ")} subtitle={`Carte ${index + 1}`}>
            <AdminButton onClick={() => moveAt("companies", index, -1)} disabled={index === 0}>↑</AdminButton>
            <AdminButton onClick={() => moveAt("companies", index, 1)} disabled={index === draft.companies.length - 1}>↓</AdminButton>
            <AdminButton variant="danger" onClick={() => removeAt("companies", index)}><Icon name="trash" /></AdminButton>
          </RecordHead>
          <div className="admin-grid">
            <TextField label="Nom" value={company.name} multiline rows={2} onChange={(value) => set(`companies.${index}.name`, value)} />
            <TextField label="Catégorie" value={company.category} onChange={(value) => set(`companies.${index}.category`, value)} />
            <TextField label="Lien de la carte" value={company.href} onChange={(value) => set(`companies.${index}.href`, value)} />
            <MediaField label="Photo" src={company.image.src} path={`companies.${index}.image.src`} onPick={openPicker} />
          </div>
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 12 }}>Logos</strong>
            {company.logos.map((logo, logoIndex) => (
              <div className="admin-record" key={`${logo.id}-${logoIndex}`} style={{ background: "#fff" }}>
                <RecordHead title={`Logo ${logoIndex + 1}`}>
                  <AdminButton variant="danger" onClick={() => removeAt(`companies.${index}.logos`, logoIndex)}><Icon name="trash" /></AdminButton>
                </RecordHead>
                <div className="admin-grid">
                  <MediaField label="Fichier" src={logo.src} path={`companies.${index}.logos.${logoIndex}.src`} onPick={openPicker} />
                  <TextField label="Texte alternatif" value={logo.alt} onChange={(value) => set(`companies.${index}.logos.${logoIndex}.alt`, value)} />
                </div>
              </div>
            ))}
            <AdminButton onClick={() => addAt(`companies.${index}.logos`, newMedia(logoUrl, "Logo"))}><Icon name="plus" />Ajouter un logo</AdminButton>
          </div>
        </div>
      ))}
      <AdminButton variant="primary" onClick={() => addAt("companies", {
        id: uid(), href: "https://", name: "Nouvelle entreprise", category: "Catégorie", image: newMedia(fallbackImage, "Nouvelle entreprise"), logos: [],
      })}><Icon name="plus" />Ajouter une entreprise</AdminButton>
    </Card>
  );

  const renderGallery = () => (
    <>
      <Card title="Couvertures de la galerie" description="Une couverture reliée à un album ouvre celui-ci ; sans album, elle ouvre la lightbox.">
        <div style={{ marginBottom: 14 }}><TextField label="Titre de la section" value={draft.gallery.title} onChange={(value) => set("gallery.title", value)} /></div>
        {draft.gallery.tiles.map((tile, index) => (
          <div className="admin-record" key={tile.id}>
            <RecordHead title={tile.title || `Couverture ${index + 1}`} subtitle={`Format ${tile.span}`}>
              <AdminButton variant="danger" onClick={() => removeAt("gallery.tiles", index)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <TextField label="Titre" value={tile.title} onChange={(value) => set(`gallery.tiles.${index}.title`, value)} />
              <TextField label="Album lié (id)" value={tile.albumId} onChange={(value) => set(`gallery.tiles.${index}.albumId`, value)} />
              <NumberField label="Largeur (1 ou 2)" value={tile.span} onChange={(value) => set(`gallery.tiles.${index}.span`, Math.max(1, Math.min(2, value)))} />
              <MediaField label="Image" src={tile.image.src} path={`gallery.tiles.${index}.image.src`} onPick={openPicker} />
              <TextField label="Texte alternatif" value={tile.image.alt} onChange={(value) => set(`gallery.tiles.${index}.image.alt`, value)} />
            </div>
          </div>
        ))}
        <AdminButton onClick={() => addAt("gallery.tiles", { id: uid(), span: 1, albumId: "", title: "", image: newMedia(fallbackImage, "Nouvelle couverture") })}><Icon name="plus" />Ajouter une couverture</AdminButton>
      </Card>
      <Card title="Albums photographiques" description="Les photos sont regroupées par numéro de ligne. Les fichiers sont choisis dans la bibliothèque locale ou téléversés.">
        {draft.albums.map((album, albumIndex) => (
          <div className="admin-record" key={album.id}>
            <RecordHead title={album.title} subtitle={`${album.photos.length} photo${album.photos.length > 1 ? "s" : ""}`}>
              <AdminButton variant="danger" onClick={() => removeAt("albums", albumIndex)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid">
              <TextField label="Titre de l’album" value={album.title} onChange={(value) => set(`albums.${albumIndex}.title`, value)} />
              <TextField label="Identifiant (utilisé par les couvertures)" value={album.id} onChange={(value) => set(`albums.${albumIndex}.id`, value)} />
            </div>
            <div style={{ marginTop: 14 }}>
              {album.photos.map((photo, photoIndex) => (
                <div className="admin-record" key={photo.id} style={{ background: "#fff" }}>
                  <RecordHead title={`Photo ${photoIndex + 1}`}>
                    <AdminButton onClick={() => moveAt(`albums.${albumIndex}.photos`, photoIndex, -1)} disabled={photoIndex === 0}>↑</AdminButton>
                    <AdminButton onClick={() => moveAt(`albums.${albumIndex}.photos`, photoIndex, 1)} disabled={photoIndex === album.photos.length - 1}>↓</AdminButton>
                    <AdminButton variant="danger" onClick={() => removeAt(`albums.${albumIndex}.photos`, photoIndex)}><Icon name="trash" /></AdminButton>
                  </RecordHead>
                  <div className="admin-grid-3">
                    <MediaField label="Fichier" src={photo.src} path={`albums.${albumIndex}.photos.${photoIndex}.src`} onPick={openPicker} />
                    <TextField label="Texte alternatif" value={photo.alt} onChange={(value) => set(`albums.${albumIndex}.photos.${photoIndex}.alt`, value)} />
                    <TextField label="Légende" value={photo.caption} onChange={(value) => set(`albums.${albumIndex}.photos.${photoIndex}.caption`, value)} />
                    <NumberField label="Ligne" value={photo.row} onChange={(value) => set(`albums.${albumIndex}.photos.${photoIndex}.row`, value)} />
                    <NumberField label="Ratio" value={photo.ratio} onChange={(value) => set(`albums.${albumIndex}.photos.${photoIndex}.ratio`, value || 1)} />
                  </div>
                </div>
              ))}
              <AdminButton onClick={() => addAt(`albums.${albumIndex}.photos`, { ...newMedia(fallbackImage, album.title), row: 0, ratio: 1, caption: "" })}><Icon name="plus" />Ajouter une photo</AdminButton>
            </div>
          </div>
        ))}
        <AdminButton variant="primary" onClick={() => addAt("albums", { id: uid(), title: "Nouvel album", photos: [] })}><Icon name="plus" />Ajouter un album</AdminButton>
      </Card>
    </>
  );

  const renderContact = () => (
    <>
      <Card title="Introduction & coordonnées">
        <div className="admin-grid">
          <TextField label="Titre" value={draft.contact.title} onChange={(value) => set("contact.title", value)} />
          <TextField label="Titre du contact développement" value={draft.contact.colleaguesTitle} onChange={(value) => set("contact.colleaguesTitle", value)} />
          <TextField label="Accueil" value={draft.contact.welcome} onChange={(value) => set("contact.welcome", value)} />
          <TextField label="Phrase d’accroche" value={draft.contact.lead} multiline rows={2} onChange={(value) => set("contact.lead", value)} />
          <TextField label="Question" value={draft.contact.question} onChange={(value) => set("contact.question", value)} />
          <TextField label="Sujet mis en évidence" value={draft.contact.subject} onChange={(value) => set("contact.subject", value)} />
          <TextField label="Invitation" value={draft.contact.invitation} onChange={(value) => set("contact.invitation", value)} />
          <TextField label="Choix du moyen" value={draft.contact.choice} onChange={(value) => set("contact.choice", value)} />
          <MediaField label="Portrait de contact" src={draft.contact.portrait.src} path="contact.portrait.src" onPick={openPicker} />
        </div>
      </Card>
      <Card title="Sujets du formulaire">
        {draft.contact.topics.map((topic, index) => (
          <div className="admin-record" key={topic.id}>
            <RecordHead title={`Sujet ${index + 1}`}>
              <AdminButton variant="danger" onClick={() => removeAt("contact.topics", index)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <TextField label="Icône / caractère" value={topic.icon} onChange={(value) => set(`contact.topics.${index}.icon`, value)} />
              <TextField label="Intitulé" value={topic.title} multiline rows={2} onChange={(value) => set(`contact.topics.${index}.title`, value)} />
            </div>
          </div>
        ))}
        <AdminButton onClick={() => addAt("contact.topics", { id: uid(), icon: "?", title: "Nouveau\nsujet" })}><Icon name="plus" />Ajouter un sujet</AdminButton>
      </Card>
      <Card title="Canaux de contact">
        {draft.contact.channels.map((channel, index) => (
          <div className="admin-record" key={channel.id}>
            <RecordHead title={channel.title.replace(/\n/g, " ")}>
              <AdminButton variant="danger" onClick={() => removeAt("contact.channels", index)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <TextField label="Titre" value={channel.title} onChange={(value) => set(`contact.channels.${index}.title`, value)} />
              <TextField label="Texte" value={channel.text} onChange={(value) => set(`contact.channels.${index}.text`, value)} />
              <TextField label="Lien (https, mailto, tel)" value={channel.href} onChange={(value) => set(`contact.channels.${index}.href`, value)} />
              <TextField label="Libellé du bouton" value={channel.button} onChange={(value) => set(`contact.channels.${index}.button`, value)} />
              <TextField label="Icône" value={channel.icon} onChange={(value) => set(`contact.channels.${index}.icon`, value)} />
            </div>
          </div>
        ))}
        <AdminButton onClick={() => addAt("contact.channels", { id: uid(), icon: "globe", title: "Nouveau canal", text: "", href: "https://", button: "Ouvrir", additionalLinks: [] })}><Icon name="plus" />Ajouter un canal</AdminButton>
      </Card>
      <Card title="Contact développement">
        {draft.contact.colleagues.map((person, index) => (
          <div className="admin-record" key={person.id}>
            <RecordHead title={person.name}>
              <AdminButton variant="danger" onClick={() => removeAt("contact.colleagues", index)}><Icon name="trash" /></AdminButton>
            </RecordHead>
            <div className="admin-grid-3">
              <TextField label="Nom" value={person.name} onChange={(value) => set(`contact.colleagues.${index}.name`, value)} />
              <TextField label="Rôle" value={person.role} onChange={(value) => set(`contact.colleagues.${index}.role`, value)} />
              <TextField label="E-mail" value={person.email} onChange={(value) => set(`contact.colleagues.${index}.email`, value)} />
              <TextField label="Téléphone" value={person.phone} onChange={(value) => set(`contact.colleagues.${index}.phone`, value)} />
              <TextField label="Libellé e-mail" value={person.emailButton} onChange={(value) => set(`contact.colleagues.${index}.emailButton`, value)} />
              <TextField label="Libellé téléphone" value={person.phoneButton} onChange={(value) => set(`contact.colleagues.${index}.phoneButton`, value)} />
            </div>
          </div>
        ))}
        <AdminButton onClick={() => addAt("contact.colleagues", { id: uid(), name: "Nouveau contact", role: "Rôle", email: "contact@exemple.fr", phone: "00.00.00.00.00", emailButton: "Envoyer un e-mail", phoneButton: "Appeler" })}><Icon name="plus" />Ajouter un contact</AdminButton>
      </Card>
    </>
  );

  const renderHidden = () => (
    <Card title="Pages privées" description="Ces pages ne figurent pas dans la navigation tant que « Afficher dans le menu » reste décoché. Partagez uniquement le lien privé. Les PDF sont hébergés avec le site.">
      {(draft.hiddenPages ?? []).map((page, index) => (
        <div className="admin-record" key={page.id}>
          <RecordHead title={page.title} subtitle={`/p/${page.slug}`}>
            <AdminButton onClick={() => copyPrivateLink(page.slug)}><Icon name="copy" />Copier le lien</AdminButton>
            <AdminButton variant="danger" onClick={() => removeAt("hiddenPages", index)}><Icon name="trash" /></AdminButton>
          </RecordHead>
          <div className="admin-grid">
            <TextField label="Titre" value={page.title} onChange={(value) => set(`hiddenPages.${index}.title`, value)} />
            <TextField label="Slug privé" value={page.slug} onChange={(value) => set(`hiddenPages.${index}.slug`, value)} />
            <TextField label="Libellé de navigation" value={page.label} onChange={(value) => set(`hiddenPages.${index}.label`, value)} />
            <TextField label="Eyebrow" value={page.eyebrow} onChange={(value) => set(`hiddenPages.${index}.eyebrow`, value)} />
            <div style={{ display: "grid", alignContent: "center" }}>
              <Toggle label="Afficher dans le menu" checked={Boolean(page.showInNav)} onChange={(value) => set(`hiddenPages.${index}.showInNav`, value)} />
            </div>
            <MediaField label="Visuel" src={page.image?.src ?? ""} path={`hiddenPages.${index}.image.src`} onPick={openPicker} />
            <div style={{ gridColumn: "1 / -1" }}><TextField label="Texte" value={page.body} multiline rows={5} onChange={(value) => set(`hiddenPages.${index}.body`, value)} /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 12 }}>Documents téléchargeables</strong>
            {(page.documents ?? []).map((doc, docIndex) => (
              <div className="admin-record" key={doc.id} style={{ background: "#fff" }}>
                <RecordHead title={doc.title}>
                  <AdminButton variant="danger" onClick={() => removeAt(`hiddenPages.${index}.documents`, docIndex)}><Icon name="trash" /></AdminButton>
                </RecordHead>
                <div className="admin-grid">
                  <TextField label="Titre" value={doc.title} onChange={(value) => set(`hiddenPages.${index}.documents.${docIndex}.title`, value)} />
                  <TextField label="Description" value={doc.description} onChange={(value) => set(`hiddenPages.${index}.documents.${docIndex}.description`, value)} />
                  <MediaField label="Fichier PDF" src={doc.url} path={`hiddenPages.${index}.documents.${docIndex}.url`} kind="pdf" onPick={openPicker} />
                </div>
              </div>
            ))}
            <AdminButton onClick={() => addAt(`hiddenPages.${index}.documents`, { id: uid(), title: "Nouveau document", description: "Description", url: mediaUrls.pdfUrl })}><Icon name="plus" />Ajouter un document</AdminButton>
          </div>
        </div>
      ))}
      <AdminButton variant="primary" onClick={() => addAt("hiddenPages", {
        id: uid(), slug: `page-${uid()}`, label: "Nouvelle page", showInNav: false, eyebrow: "MATÉRIOSOL / PRIVÉ",
        title: "Nouvelle page privée", body: "Contenu réservé aux personnes disposant du lien.", image: newMedia(logoUrl, "Matériosol"), documents: [],
      })}><Icon name="plus" />Ajouter une page privée</AdminButton>
    </Card>
  );

  const renderMedia = () => (
    <>
      <Card title="Téléverser des fichiers" description="JPG, PNG, WebP, GIF, AVIF et PDF jusqu’à 15 Mo. Les fichiers sont stockés dans PostgreSQL et servis par le site : aucun lien externe.">
        <input className="admin-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif,application/pdf" onChange={uploadFiles} disabled={uploading} />
        {uploading && <p style={{ fontSize: 11, marginTop: 10, color: "#71847a" }}>Téléversement en cours…</p>}
      </Card>
      <Card title={`Bibliothèque du site (${staticMedia.length + media.length})`} description="Sélectionnez un média depuis n’importe quel champ via « Choisir ou téléverser ».">
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Médias intégrés</h3>
        <div className="admin-library-grid">
          {staticMedia.map((item) => (
            <div className="admin-library-item" key={item.url}>
              {item.kind === "pdf" ? <span className="pdf-thumb"><Icon name="file" /></span> : <img src={item.url} alt="" loading="lazy" />}
              <span>{item.name}</span>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#18736c", fontSize: 10, display: "block", marginTop: 5 }}>Ouvrir le fichier local</a>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize: 13, margin: "24px 0 10px" }}>Fichiers téléversés</h3>
        {media.length === 0 ? <p style={{ fontSize: 11, color: "#71847a" }}>Aucun fichier téléversé pour le moment.</p> : (
          <div className="admin-library-grid">
            {media.map((item) => (
              <div className="admin-library-item" key={item.id}>
                {item.kind === "pdf" ? <span className="pdf-thumb"><Icon name="file" /></span> : <img src={item.url} alt="" loading="lazy" />}
                <span>{item.name}</span>
                <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
                  <a className="admin-btn" href={`${item.url}?download=1`} download><Icon name="external" /></a>
                  <AdminButton variant="danger" onClick={() => deleteUploaded(item)}><Icon name="trash" /></AdminButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );

  const renderMessages = () => (
    <Card title={`Messages reçus (${messages.length})`} description="Les messages du formulaire public sont conservés ici, sans service e-mail payant.">
      {messages.length === 0 && <p style={{ fontSize: 12, color: "#71847a" }}>Aucun message pour le moment.</p>}
      {messages.map((message) => (
        <article className={`admin-message${message.isRead ? "" : ""}`} key={message.id}>
          <header>
            <strong>{message.name} {!message.isRead && <span className="admin-pill warning">Nouveau</span>}</strong>
            <time>{new Date(message.createdAt).toLocaleString("fr-FR")}</time>
          </header>
          <div style={{ fontSize: 11, color: "#71847a", lineHeight: 1.7 }}>
            {message.email} {message.phone && `· ${message.phone}`} {message.organization && `· ${message.organization}`} {message.topic && `· ${message.topic}`}
          </div>
          <p>{message.message}</p>
          <footer>
            <AdminButton onClick={() => toggleRead(message)}><Icon name="check" />{message.isRead ? "Marquer non lu" : "Marquer comme lu"}</AdminButton>
            <AdminButton variant="danger" onClick={() => removeMessage(message)}><Icon name="trash" />Supprimer</AdminButton>
          </footer>
        </article>
      ))}
    </Card>
  );

  const renderJson = () => (
    <Card title=" éditeur JSON complet" description="Ce champ donne accès à absolument toutes les propriétés, y compris l’ordre des sections et les liens additionnels. Les modifications ne sont appliquées au brouillon qu’après « Appliquer » et au site public après « Enregistrer ».">
      <textarea className="admin-json" value={jsonValue} spellCheck={false} onChange={(event) => setJsonDraft(event.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <AdminButton variant="primary" onClick={applyJson}><Icon name="check" />Appliquer au brouillon</AdminButton>
        <AdminButton onClick={() => setJsonDraft(null)}><Icon name="refresh" />Recharger depuis le brouillon</AdminButton>
        <AdminButton onClick={exportJson}><Icon name="save" />Exporter le JSON</AdminButton>
      </div>
    </Card>
  );

  const renderPublish = () => (
    <>
      <Card title="Modifier le site en direct" description="Le site public lit la version publiée dans PostgreSQL à chaque visite. Les modifications de l’éditeur restent invisibles jusqu’au clic sur « Enregistrer ».">
        <div className="admin-notice" style={{ marginBottom: 18 }}>
          <strong>Aucun redéploiement nécessaire.</strong> Cliquez sur « Enregistrer » : la base est mise à jour immédiatement, les nouveaux visiteurs voient le nouveau contenu et les pages déjà ouvertes se rafraîchissent automatiquement en moins de 12 secondes.
        </div>
        <div className="admin-notice" style={{ marginBottom: 18, background: "#eef5f1" }}>
          <strong>Votre dépôt suffit.</strong> Les images et le PDF sont restaurés automatiquement en base au premier lancement. Vous n’avez aucun fichier supplémentaire à ajouter.
        </div>
        <div className="admin-stat-grid">
          <div className="admin-stat"><strong>{dirty ? "Brouillon" : "À jour"}</strong><small>État de l’éditeur</small></div>
          <div className="admin-stat"><strong>{publishedAt ? new Date(publishedAt).toLocaleDateString("fr-FR") : "—"}</strong><small>Dernière publication</small></div>
          <div className="admin-stat"><strong>{media.length}</strong><small>Fichiers hébergés en base</small></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <AdminButton variant="primary" onClick={() => save(true)} disabled={saving}><Icon name="save" />Enregistrer et publier</AdminButton>
          <AdminButton onClick={() => save(false)} disabled={saving}><Icon name="file" />Enregistrer le brouillon</AdminButton>
          <AdminButton onClick={restorePublished}><Icon name="refresh" />Restaurer la version publiée</AdminButton>
          <a className="admin-btn" href="/" target="_blank" rel="noreferrer"><Icon name="external" />Voir le site publié</a>
        </div>
        <p style={{ fontSize: 11, color: "#71847a", marginTop: 16, lineHeight: 1.8 }}>
          « Enregistrer le brouillon » conserve votre travail sur le serveur sans rien changer au site public. « Enregistrer et publier » remplace la version visible par tous.
        </p>
      </Card>

      <Card title="Quand faut-il redéployer ?" description="La distinction importante entre le contenu et le code.">
        <div className="deploy-grid">
          <div className="deploy-box good">
            <strong><Icon name="check" />Sans redéploiement, via « Enregistrer »</strong>
            <p>Textes, titres, couleurs, logo, portrait, navigation, horaires, entreprises, galerie, albums, coordonnées, pages privées, libellés, photos et PDF téléversés depuis l’admin, messages reçus.</p>
          </div>
          <div className="deploy-box warn">
            <strong><Icon name="refresh" />Redéploiement uniquement pour le code</strong>
            <p>Modification du CSS, d’un composant React, changement de variables d’environnement ou mise à jour du projet. Dans ces cas : <code>git push</code> → Vercel redéploie automatiquement.</p>
          </div>
        </div>
      </Card>

      <Card title="Première publication sur Vercel — gratuit" description="À faire une seule fois. Ensuite, toutes vos modifications de contenu passent par l’admin sans toucher au déploiement.">
        <div className="deploy-steps">
          {[
            ["1", "Créer la base persistante", "Créez un compte gratuit chez Neon (ou Supabase), créez un projet PostgreSQL et copiez la chaîne de connexion. C’est cette base qui rend l’édition en direct possible."],
            ["2", "Mettre le projet sur GitHub", "Envoyez le dossier tel que vous l’avez téléchargé. N’ajoutez aucun autre fichier. Les secrets se saisissent directement dans Vercel à l’étape suivante."],
            ["3", "Importer dans Vercel", "Dans Vercel, « Add New… → Project », choisissez le dépôt, laissez le framework Next.js détecté et ajoutez les 3 variables ci-dessous avant de cliquer sur Deploy."],
            ["4", "Vérifier une seule fois", "Ouvrez /api/health puis /admin. Les tables et le contenu Matériosol sont créés automatiquement au premier accès. Changez ensuite ce que vous voulez et cliquez sur Enregistrer."],
          ].map(([number, title, text]) => (
            <div className="deploy-step" key={number}>
              <span>{number}</span>
              <div><strong>{title}</strong><p>{text}</p></div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0 12px" }}>
          <AdminButton variant="primary" onClick={copyEnvTemplate}><Icon name="copy" />Copier les 3 variables</AdminButton>
          <a className="admin-btn" href="https://neon.tech" target="_blank" rel="noreferrer"><Icon name="external" />Ouvrir Neon</a>
          <a className="admin-btn" href="https://vercel.com/new" target="_blank" rel="noreferrer"><Icon name="external" />Importer sur Vercel</a>
          <AdminButton onClick={checkDeployment} disabled={checking}><Icon name="check" />{checking ? "Vérification…" : "Vérifier ma configuration"}</AdminButton>
        </div>
        <pre className="deploy-code">{envTemplate}</pre>
        <p style={{ fontSize: 11, color: "#71847a", lineHeight: 1.8, marginTop: 12 }}>
          Générez la clé avec <code>openssl rand -hex 32</code>. Choisissez une phrase longue pour ADMIN_PASSWORD. Ces valeurs restent côté serveur et ne sont jamais envoyées au navigateur.
        </p>
      </Card>

      <Card title="Diagnostic de l’installation" description="Contrôle la connexion PostgreSQL, les variables serveur et la synchronisation en direct, sans afficher les secrets.">
        {diagnostic ? (
          <>
            <div className="deploy-checks">
              {diagnostic.checks.map((check) => (
                <div className="deploy-check" key={check.label}>
                  <span className={check.ok ? "ok" : "ko"}>{check.ok ? "✓" : "!"}</span>{check.label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#71847a", lineHeight: 1.9, marginTop: 14 }}>
              Hébergement détecté : <strong>{diagnostic.hosting}</strong><br />
              Stockage : {diagnostic.storage}<br />
              Médias intégrés : {diagnostic.media.embeddedAvailable}/{diagnostic.media.embeddedTotal} · Fichiers téléversés : {diagnostic.media.uploaded}<br />
              Version publiée : <code>{diagnostic.publishedVersion}</code><br />
              Synchronisation automatique des pages ouvertes : {diagnostic.liveSync ? "active" : "inactive"}
            </p>
          </>
        ) : <p style={{ fontSize: 12, color: "#71847a" }}>Cliquez sur « Vérifier ma configuration » pour contrôler votre installation.</p>}
      </Card>

      <Card title="Sauvegarde & portabilité" description="Le contenu est stocké dans PostgreSQL, ce qui permet un déploiement gratuit sur Vercel avec une base Neon.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <AdminButton onClick={exportJson}><Icon name="save" />Télécharger une sauvegarde JSON</AdminButton>
          <label className="admin-btn"><Icon name="upload" />Importer un JSON<input type="file" accept="application/json" style={{ display: "none" }} onChange={importJson} /></label>
          <AdminButton onClick={logout}><Icon name="lock" />Se déconnecter</AdminButton>
        </div>
      </Card>
    </>
  );

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><img src={logoUrl} alt="Matériosol" /><div><strong>Studio Matériosol</strong><small>Édition sécurisée</small></div></div>
        <nav className="admin-nav">
          {TABS.map((item) => (
            <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setJsonDraft(null); }}>
              <Icon name={item.icon} />{item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note">Les fichiers sont hébergés sur le site, sans URL externe. Les pages privées sont exclues du menu et des robots d’indexation.</div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div><h1>{activeTab.label}</h1><p>{draft.site.title}</p></div>
          <div className="admin-topbar-actions">
            <span className="admin-pill" title="Les contenus sont lus depuis PostgreSQL : aucun déploiement n’est nécessaire après Enregistrer.">● Base en direct</span>
            <span className={`admin-pill${dirty ? " warning" : ""}`}>{dirty ? "Modifications non publiées" : "Version publiée à jour"}</span>
            <AdminButton variant="primary" onClick={() => save(true)} disabled={saving}><Icon name="save" />Enregistrer</AdminButton>
            <AdminButton onClick={logout}><Icon name="lock" />Déconnexion</AdminButton>
          </div>
        </header>
        <main className="admin-content">
          {notice && <div className={`admin-notice${notice.error ? " error" : ""}`}>{notice.text}</div>}
          {tab === "identity" && renderIdentity()}
          {tab === "home" && renderHome()}
          {tab === "about" && renderAbout()}
          {tab === "network" && renderNetwork()}
          {tab === "gallery" && renderGallery()}
          {tab === "contact" && renderContact()}
          {tab === "hidden" && renderHidden()}
          {tab === "media" && renderMedia()}
          {tab === "messages" && renderMessages()}
          {tab === "json" && renderJson()}
          {tab === "publish" && renderPublish()}
        </main>
        <div className="admin-savebar">
          <div><strong>{dirty ? "Modifications en attente" : "Aucune modification en attente"}</strong><small>Le site public n’est modifié qu’en cliquant sur « Enregistrer ».</small></div>
          <div>
            <AdminButton onClick={restorePublished} disabled={!dirty}><Icon name="refresh" />Annuler</AdminButton>
            <AdminButton onClick={() => save(false)} disabled={saving || !dirty}><Icon name="file" />Brouillon</AdminButton>
            <AdminButton variant="primary" onClick={() => save(true)} disabled={saving}><Icon name="save" />{saving ? "Enregistrement…" : "Enregistrer"}</AdminButton>
          </div>
        </div>
      </div>

      {picker && (
        <div className="admin-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPicker(null); }}>
          <div className="admin-modal-card" role="dialog" aria-modal="true">
            <header>
              <div><h2>Bibliothèque de médias</h2><p style={{ color: "#71847a", fontSize: 11 }}>Sélectionnez un fichier local ou téléversez-le sur le site.</p></div>
              <AdminButton onClick={() => setPicker(null)}><Icon name="close" />Fermer</AdminButton>
            </header>
            <div style={{ marginBottom: 16 }}>
              <input className="admin-input" type="file" multiple={picker.kind === "image"} accept={picker.kind === "pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp,image/gif,image/avif"} onChange={uploadFiles} disabled={uploading} />
              {uploading && <p style={{ fontSize: 11, marginTop: 8 }}>Téléversement en cours…</p>}
            </div>
            <div className="admin-library-grid">
              {staticMedia.filter((item) => (picker.kind === "pdf" ? item.kind === "pdf" : item.kind === "image")).map((item) => (
                <button type="button" className="admin-library-item" key={item.url} onClick={() => chooseStatic(item.url)}>
                  {item.kind === "pdf" ? <span className="pdf-thumb"><Icon name="file" /></span> : <img src={item.url} alt="" loading="lazy" />}
                  <span>{item.name}</span>
                </button>
              ))}
              {media.filter((item) => (picker.kind === "pdf" ? item.kind === "pdf" : item.kind === "image")).map((item) => (
                <button type="button" className="admin-library-item" key={item.id} onClick={() => chooseStatic(item.url)}>
                  {item.kind === "pdf" ? <span className="pdf-thumb"><Icon name="file" /></span> : <img src={item.url} alt="" loading="lazy" />}
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminApp({
  authenticated,
  snapshot,
  setupRequired = false,
  blocked = false,
}: {
  authenticated: boolean;
  snapshot: AdminSnapshot | null;
  setupRequired?: boolean;
  blocked?: boolean;
}) {
  if (!authenticated || !snapshot) return <LoginPanel setupRequired={setupRequired} blocked={blocked} />;
  return <AdminStudio snapshot={snapshot} />;
}
