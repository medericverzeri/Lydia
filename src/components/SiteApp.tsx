"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { contentVersion, type Album, type AlbumPhoto, type Channel, type HiddenPage, type MediaItem, type NavigationItem, type SiteContent } from "@/lib/content";

type LightboxState = { items: MediaItem[]; index: number } | null;
type DialogState = "legal" | "hours" | "form" | null;
type FormState = {
  name: string;
  email: string;
  organization: string;
  phone: string;
  message: string;
  topic: string;
  website: string;
};

const emptyForm: FormState = {
  name: "", email: "", organization: "", phone: "", message: "", topic: "", website: "",
};

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function safeHref(value: string): string {
  const href = (value ?? "").trim();
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href) ? href : "#";
}

function formatTime(value: string): string {
  return (value ?? "").replace(":", "h");
}

function MediaImg({ media, className, priority }: { media: MediaItem; className?: string; priority?: boolean }) {
  if (!media?.src) return null;
  return (
    <img
      src={media.src}
      alt={media.alt ?? ""}
      className={className}
      loading={priority ? "eager" : "lazy"}
      style={{ objectFit: media.fit ?? "cover", objectPosition: media.position ?? "50% 50%" }}
    />
  );
}

function TextBlocks({ text, missions = false }: { text: string; missions?: boolean }) {
  const [first = "", ...rest] = (text ?? "").trimEnd().split(/\n\s*\n/);
  return (
    <div className={`original-block${missions ? " missions-block" : ""}`}>
      {first && <h3 style={{ whiteSpace: "pre-line" }}>{first}</h3>}
      {missions ? (
        <ul>
          {rest.join("\n").split("\n").filter((line) => line.trim()).map((line, index) => (
            <li key={index}>
              <span className="mission-marker">{String(index + 1).padStart(2, "0")}</span>
              <span>{line.trim()}</span>
            </li>
          ))}
        </ul>
      ) : rest.filter((line) => line.trim()).map((paragraph, index) => (
        <p key={index}>{paragraph.trim()}</p>
      ))}
    </div>
  );
}

function IconForChannel({ name }: { name: string }) {
  const allowed: IconName[] = ["globe", "phone", "mail", "grid", "clock", "diagonal"];
  const icon = (allowed.includes(name as IconName) ? name : "globe") as IconName;
  return <Icon name={icon} />;
}

function ChannelCard({ channel }: { channel: Channel }) {
  if (channel.additionalLinks?.length) {
    const links = [
      { id: channel.id, text: channel.text, href: channel.href, button: channel.button },
      ...channel.additionalLinks,
    ];
    return (
      <div className="channel-card channel-multi">
        <span className="channel-icon"><IconForChannel name={channel.icon} /></span>
        <h4>{channel.title}</h4>
        <div className="channel-phone-list">
          {links.map((link) => (
            <a key={link.id} href={safeHref(link.href)} aria-label={`${link.button ?? "Ouvrir"} ${link.text}`}>
              <span>{link.text}</span><Icon name="diagonal" />
            </a>
          ))}
        </div>
      </div>
    );
  }
  const external = channel.href.startsWith("http");
  return (
    <a
      className="channel-card"
      href={safeHref(channel.href)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      <span className="channel-icon"><IconForChannel name={channel.icon} /></span>
      <h4>{channel.title}</h4>
      <p>{channel.text}</p>
      <span className="channel-button">{channel.button}<Icon name="diagonal" /></span>
    </a>
  );
}

/**
 * Synchronisation « en direct » sans redéploiement :
 * le navigateur compare la version publiée en base avec celle de la page.
 * Si l'administrateur a cliqué sur Enregistrer, la page se rafraîchit seule.
 */
function useLiveContent(currentContent: SiteContent) {
  const router = useRouter();
  const versionRef = useRef(contentVersion(currentContent));
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    versionRef.current = contentVersion(currentContent);
  }, [currentContent]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!active || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/content/version", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { version?: string };
        if (!active || !data.version || data.version === versionRef.current) return;
        versionRef.current = data.version;
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 4000);
        router.refresh();
      } catch {
        // Une indisponibilité ponctuelle ne doit jamais casser la page publique.
      }
    };
    const timer = window.setInterval(check, 12000);
    const onVisible = () => { void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return justUpdated;
}

export function SiteApp({
  content,
  privateMode = false,
  hiddenPage,
  sectionOnly,
}: {
  content: SiteContent;
  privateMode?: boolean;
  hiddenPage?: HiddenPage;
  sectionOnly?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(sectionOnly ?? hiddenPage?.slug ?? "accueil");
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [slide, setSlide] = useState(0);
  const justUpdated = useLiveContent(content);

  const labels = content.site.labels;
  const hiddenPages = content.hiddenPages ?? [];
  const navItems = useMemo(() => content.site.sectionOrder
    .map((id) => content.site.navigation.find((item) => item.id === id))
    .filter((item): item is NavigationItem => Boolean(item))
    .filter((item) => item.visible !== false && !item.hidden), [content.site.sectionOrder, content.site.navigation]);
  const visibleIds = navItems.map((item) => item.id);
  const visibleIdKey = visibleIds.join(",");
  const currentAlbum: Album | null = content.albums.find((album) => album.id === albumId) ?? null;
  const companySlides = useMemo(() => {
    const result = [];
    for (let index = 0; index < content.companies.length; index += 3) {
      result.push(content.companies.slice(index, index + 3));
    }
    return result;
  }, [content.companies]);

  const rootStyle = {
    "--accent": content.site.theme.accent,
    "--accent-dark": content.site.theme.accentDark,
    "--ink": content.site.theme.ink,
    "--paper": content.site.theme.background,
    "--surface": content.site.theme.surface,
    "--muted": content.site.theme.muted,
    "--line": content.site.theme.line,
    "--portrait-bg": content.site.theme.portraitBackground,
    "--radius": `${content.site.design.rounded}px`,
    "--content-width": `${content.site.design.contentWidth}px`,
    "--site-font": `${content.site.design.font}, sans-serif`,
    "--background-opacity": content.site.design.backgroundOpacity,
  } as CSSProperties;

  const sectionTitle = (id: string) => {
    if (id === "apropos") return content.about.title;
    if (id === "galerie") return content.gallery.title;
    if (id === "contact") return content.contact.title;
    return navTitle(id);
  };
  const navTitle = (id: string) => content.site.navigation.find((item) => item.id === id)?.label ?? id;
  const sectionNumber = (id: string) => String(content.site.sectionOrder.indexOf(id) + 1).padStart(2, "0");

  const sectionHref = (id: string) => {
    const item = content.site.navigation.find((entry) => entry.id === id);
    if (item?.hidden || item?.visible === false) return `/p/${item.slug || id}`;
    return privateMode ? `/#${id}` : `#${id}`;
  };
  const albumHref = (id: string) => (privateMode ? `/#album/${id}` : `#album/${id}`);
  const galleryHref = () => (privateMode ? "/#galerie" : "#galerie");

  const daysLabel = () => {
    const days = content.hours.days ?? [];
    if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) return "Du lundi au vendredi";
    if (days.length === 3 && [1, 3, 5].every((day) => days.includes(day))) return labels.allHours ?? "Lundi, mercredi et vendredi";
    return days.map((day) => DAY_NAMES[day]).filter(Boolean).join(", ");
  };

  const openForm = (topic = "") => {
    setForm({ ...emptyForm, topic });
    setFormStatus("idle");
    setDialog("form");
  };

  const closeOverlays = () => {
    setDialog(null);
    setLightbox(null);
    setMenuOpen(false);
  };

  useEffect(() => {
    const readHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash.startsWith("album/")) {
        const id = hash.slice(6);
        if (content.albums.some((album) => album.id === id)) {
          setAlbumId(id);
          setActive("galerie");
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
          return;
        }
      }
      setAlbumId(null);
      if (hash && visibleIdKey.split(",").includes(hash)) {
        setActive(hash);
        if (!privateMode) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }));
        }
      }
      setMenuOpen(false);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [content.albums, privateMode, visibleIdKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlays();
      if (lightbox && event.key === "ArrowRight") {
        setLightbox((state) => state ? { ...state, index: (state.index + 1) % state.items.length } : state);
      }
      if (lightbox && event.key === "ArrowLeft") {
        setLightbox((state) => state ? { ...state, index: (state.index - 1 + state.items.length) % state.items.length } : state);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("send failed");
      setFormStatus("sent");
      setForm(emptyForm);
    } catch {
      setFormStatus("error");
    }
  }

  const chapterHeading = (id: string) => (
    <div className="chapter-heading">
      <span className="chapter-number">{sectionNumber(id)}<i /></span>
      <h2>{sectionTitle(id)}</h2>
      <div className="chapter-rule" />
    </div>
  );

  const openingStrip = (
    <button type="button" className="opening-strip" style={{ width: "100%", textAlign: "left" }} onClick={() => setDialog("hours")}>
      <span className="hours-title"><Icon name="clock" />{labels.hoursTitle}</span>
      <strong>{daysLabel()}</strong>
      <span className="hours-times">
        <span>{formatTime(content.hours.morningStart)} <i>—</i> {formatTime(content.hours.morningEnd)}</span>
        <span className="hours-separator" />
        <span>{formatTime(content.hours.afternoonStart)} <i>—</i> {formatTime(content.hours.afternoonEnd)}</span>
      </span>
    </button>
  );

  const renderHome = () => {
    const currentIndex = Math.max(0, visibleIds.indexOf("accueil"));
    const next = visibleIds[(currentIndex + 1) % Math.max(1, visibleIds.length)] ?? "apropos";
    return (
      <section id="accueil" className="home-page">
        <div className="container home-inner">
          <div className="home-copy">
            <p className="page-eyebrow"><span />{sectionNumber("accueil")} <i>/</i> {navTitle("accueil")}</p>
            <h1 className="home-title">
              {content.home.text.trimEnd().split("\n").map((line, index) => (
                <span key={index} className={index === 1 ? "role-second-line" : ""}>{line}</span>
              ))}
            </h1>
            <MediaImg media={content.home.logo} className="home-logo" priority />
            <div className="home-buttons">
              <a href={sectionHref("contact")} className="button button-teal">{labels.heroButton}<Icon name="diagonal" /></a>
              <a href={sectionHref("apropos")} className="home-about-link">{labels.homeNext}<Icon name="down" /></a>
            </div>
          </div>
          <div className="home-portrait-area">
            <div className="portrait-frame">
              <div className="portrait-orbit" />
              <MediaImg media={content.home.portrait} className="home-portrait" priority />
              <div className="portrait-signature">
                <span>{content.site.firstName}</span><strong>{content.site.lastName}</strong><i />
              </div>
            </div>
            <span className="portrait-side-label">{content.site.lastName} {content.site.firstName}</span>
          </div>
        </div>
        <div className="container">
          {openingStrip}
          <div className="page-turn">
            <span>{sectionNumber("accueil")} <i>/</i> {String(content.site.sectionOrder.length).padStart(2, "0")}</span>
            <a href={sectionHref(next)}>{navTitle(next)}<span className="round-button"><Icon name="down" /></span></a>
          </div>
        </div>
      </section>
    );
  };

  const renderAbout = () => (
    <section className="chapter about-page" id="apropos">
      <div className="container">
        {chapterHeading("apropos")}
        <div className="about-layout">
          <div className="about-writing">
            <TextBlocks text={content.about.introduction} />
            <TextBlocks text={content.about.missions} missions />
          </div>
          <div className="about-pictures">
            {content.about.images.map((image, index) => (
              <button
                key={`${image.id}-${index}`}
                type="button"
                className={`about-image${index === 0 ? " about-logo" : ""}`}
                aria-label={`${labels.openPhoto} : ${image.alt}`}
                onClick={() => setLightbox({ items: content.about.images, index })}
              >
                <MediaImg media={image} />
                <span className="image-zoom"><Icon name="zoom" /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const renderCompanies = () => (
    <section className="chapter companies-page" id="entreprises">
      <div className="container">
        {chapterHeading("entreprises")}
        <div className="company-carousel">
          <div
            className="company-window"
            onTouchStart={(event) => {
              const start = event.touches[0].clientX;
              (event.currentTarget as HTMLElement).dataset.touchStart = String(start);
            }}
            onTouchEnd={(event) => {
              const start = Number((event.currentTarget as HTMLElement).dataset.touchStart ?? 0);
              const delta = event.changedTouches[0].clientX - start;
              if (Math.abs(delta) > 65) setSlide((value) => Math.min(Math.max(value + (delta < 0 ? 1 : -1), 0), companySlides.length - 1));
            }}
          >
            <div className="company-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
              {companySlides.map((group, groupIndex) => (
                <div className="company-slide" style={{ minWidth: "100%" }} key={groupIndex} aria-hidden={slide !== groupIndex}>
                  {group.map((company) => (
                    <a className="company-card" key={company.id} href={safeHref(company.href)} target="_blank" rel="noreferrer">
                      <div className="company-photo">
                        <MediaImg media={company.image} />
                        <span className="company-open"><Icon name="diagonal" /></span>
                      </div>
                      <div className="company-info">
                        <div><h3>{company.name}</h3><p>{company.category}</p></div>
                        <div className="company-logos">
                          {company.logos.map((logo, index) => <MediaImg key={`${logo.id}-${index}`} media={logo} />)}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="carousel-footer">
            <div className="pagination-dots">
              {companySlides.map((_, index) => (
                <button key={index} aria-label={`${navTitle("entreprises")} · ${index + 1}`} aria-current={slide === index ? "true" : undefined} className={slide === index ? "active" : ""} onClick={() => setSlide(index)}><span /></button>
              ))}
            </div>
            <div className="carousel-actions">
              <span className="page-fraction">{String(slide + 1).padStart(2, "0")} <i>/</i> {String(companySlides.length).padStart(2, "0")}</span>
              <button className="round-button" type="button" onClick={() => setSlide((value) => Math.max(0, value - 1))} disabled={slide === 0} aria-label={labels.previous}><Icon name="back" /></button>
              <button className="round-button" type="button" onClick={() => setSlide((value) => Math.min(companySlides.length - 1, value + 1))} disabled={slide === companySlides.length - 1} aria-label={labels.next}><Icon name="next" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderGallery = () => (
    <section className="chapter gallery-page" id="galerie">
      <div className="container">
        {chapterHeading("galerie")}
        <div className="gallery-covers">
          {content.gallery.tiles.map((tile, index) => {
            const inner = (
              <>
                <MediaImg media={tile.image} />
                <div className="cover-gradient" />
                <div className="cover-title">
                  {tile.title && <h3>{tile.title}</h3>}
                  <span className="cover-icon"><Icon name={tile.albumId ? "diagonal" : "zoom"} /></span>
                </div>
              </>
            );
            return tile.albumId ? (
              <a key={tile.id} className={`gallery-cover cover-span-${tile.span}`} href={albumHref(tile.albumId)} aria-label={`${labels.openAlbum} : ${tile.title}`}>{inner}</a>
            ) : (
              <button key={tile.id} className={`gallery-cover cover-span-${tile.span}`} type="button" aria-label={`${labels.openPhoto} : ${tile.image.alt}`} onClick={() => setLightbox({ items: content.gallery.tiles.map((item) => item.image), index })}>{inner}</button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderContact = () => (
    <section className="chapter contact-page" id="contact">
      <div className="container">
        {chapterHeading("contact")}
        <div className="contact-layout">
          <div className="contact-intro">
            <div className="contact-avatar"><MediaImg media={content.contact.portrait} /></div>
            <p className="contact-welcome">{content.contact.welcome}</p>
            <h3>{content.contact.lead}</h3>
          </div>
          <div className="contact-main">
            <h3 className="contact-question"><span>{content.contact.question}</span><strong>{content.contact.subject}</strong></h3>
            <div className="contact-topics">
              {content.contact.topics.map((topic) => (
                <button key={topic.id} type="button" onClick={() => openForm(topic.title.replace(/\n/g, " ").trim())}>
                  <span className="topic-icon">{topic.icon}</span><span>{topic.title}</span>
                </button>
              ))}
            </div>
            <div className="contact-invitation">
              <h3>{content.contact.invitation}</h3>
              <p>{content.contact.choice}</p>
              <button type="button" className="button button-teal" style={{ marginTop: 18 }} onClick={() => openForm()}>{labels.formTitle}<Icon name="diagonal" /></button>
            </div>
            <div className="contact-channels">
              {content.contact.channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}
            </div>
            {content.contact.colleagues.length > 0 && (
              <section className="colleague-section" aria-labelledby="colleagues-title">
                <h3 id="colleagues-title">{content.contact.colleaguesTitle}</h3>
                <div className="colleague-list">
                  {content.contact.colleagues.map((person) => (
                    <article className="colleague-card" key={person.id}>
                      <div className="colleague-identity">
                        <span className="colleague-initials" aria-hidden="true">{person.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>
                        <div><h4>{person.name}</h4><p>{person.role}</p></div>
                      </div>
                      <div className="colleague-links">
                        <a href={`mailto:${person.email}`} aria-label={`${person.emailButton} : ${person.email}`}><Icon name="mail" /><span>{person.email}</span><Icon name="diagonal" /></a>
                        <a href={`tel:${person.phone.replace(/[^+\d]/g, "")}`} aria-label={`${person.phoneButton} ${person.phone}`}><Icon name="phone" /><span>{person.phone}</span><Icon name="diagonal" /></a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const renderAlbum = (album: Album) => {
    const rows = [...new Set(album.photos.map((photo) => photo.row))].sort((a, b) => a - b);
    return (
      <section className="album-page">
        <div className="container">
          <a className="back-to-gallery" href={galleryHref()}><Icon name="back" />{labels.backGallery}</a>
          <div className="album-heading">
            <div>
              <p className="page-eyebrow"><span />{content.gallery.title}</p>
              <h1>{album.title}</h1>
            </div>
            <span className="album-count">{album.photos.length} {album.photos.length === 1 ? labels.photo : labels.photos}</span>
          </div>
          <div className="album-rows">
            {rows.map((row) => (
              <div className="album-row" key={row}>
                {album.photos.filter((photo) => photo.row === row).map((photo: AlbumPhoto, index) => (
                  <button
                    className="album-photo"
                    key={`${photo.id}-${index}`}
                    type="button"
                    aria-label={`${labels.openPhoto} : ${photo.alt}`}
                    style={{ flex: `${photo.ratio || 1} 1 0`, aspectRatio: String(photo.ratio || 1) }}
                    onClick={() => setLightbox({ items: album.photos, index: album.photos.indexOf(photo) })}
                  >
                    <MediaImg media={photo} />
                    <span className="album-photo-index">{String(album.photos.indexOf(photo) + 1).padStart(2, "0")}</span>
                    <span className="image-zoom"><Icon name="zoom" /></span>
                    {photo.caption && <span className="album-caption">{photo.caption}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="album-bottom">
            <a href={galleryHref()}><Icon name="grid" />{labels.backGallery}</a>
            <span>{content.site.lastName} {content.site.firstName}</span>
          </div>
        </div>
      </section>
    );
  };

  const renderSection = (id: string) => {
    if (id === "accueil") return renderHome();
    if (id === "apropos") return renderAbout();
    if (id === "entreprises") return renderCompanies();
    if (id === "galerie") return renderGallery();
    if (id === "contact") return renderContact();
    return null;
  };

  const renderPrivatePage = (page: HiddenPage) => (
    <section className="hidden-page">
      <div className="container">
        <div className="hidden-page-hero">
          <div>
            <span className="private-note"><Icon name="lock" />Page non référencée dans la navigation</span>
            <p className="page-eyebrow" style={{ marginTop: 22 }}><span />{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <p className="hidden-page-body">{page.body}</p>
          </div>
          <MediaImg media={page.image} className="hidden-page-logo" />
        </div>
        <div className="document-grid">
          {page.documents.map((doc) => {
            const isHostedPdf = doc.url.startsWith("/api/media/");
            const href = isHostedPdf ? `${doc.url}?download=1` : doc.url;
            return (
              <a className="document-card" key={doc.id} href={safeHref(href)} target="_blank" rel="noreferrer" download={isHostedPdf || doc.url.endsWith(".pdf") ? "" : undefined}>
                <Icon name="file" />
                <span><strong>{doc.title}</strong><small>{doc.description}</small></span>
                <Icon name="diagonal" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );

  const publicNavLinks = hiddenPages.filter((page) => page.showInNav);
  const navLink = (item: NavigationItem) => (
    <a key={item.id} className={active === item.id ? "active" : ""} href={sectionHref(item.id)} aria-current={active === item.id ? "page" : undefined} onClick={() => { setActive(item.id); setMenuOpen(false); }}>{item.label}</a>
  );

  const header = (
    <header className="portfolio-header">
      <div className="container header-inner">
        <nav className="nav-left" aria-label="Navigation principale">{navItems.slice(0, 3).map(navLink)}</nav>
        <a href={sectionHref("accueil")} className="name-logo" aria-label={`${content.site.lastName} ${content.site.firstName}`}>
          <strong>{content.site.lastName}</strong><span>{content.site.firstName}</span><i />
        </a>
        <nav className="nav-right" aria-label="Galerie et contact">
          {navItems.slice(3).map(navLink)}
          {publicNavLinks.map((page) => (
            <a key={page.id} href={`/p/${page.slug}`} className={active === page.slug ? "active" : ""}>{page.label}</a>
          ))}
          <a className="header-contact-arrow" href={sectionHref("contact")} aria-label={content.contact.title}><Icon name="diagonal" /></a>
        </nav>
        <button className="round-button menu-button" type="button" aria-label={menuOpen ? labels.closeMenu : labels.menu} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
      {menuOpen && (
        <nav className="mobile-navigation" aria-label="Navigation mobile">
          {navItems.map(navLink)}
          {publicNavLinks.map((page) => <a key={page.id} href={`/p/${page.slug}`} onClick={() => setMenuOpen(false)}>{page.label}</a>)}
        </nav>
      )}
    </header>
  );

  const footer = (
    <footer className="portfolio-footer">
      <div className="container footer-inner">
        <a href={sectionHref("accueil")} className="footer-name"><strong>{content.site.lastName}</strong> {content.site.firstName}<span className="footer-dot" /></a>
        <div className="footer-actions">
          <button type="button" onClick={() => setDialog("legal")}>{labels.legal}</button>
          <a href="/admin" rel="nofollow"><Icon name="lock" />{labels.admin}</a>
          <a href={sectionHref("accueil")} className="round-button" aria-label={labels.top}><Icon name="up" className="rotate-up" /></a>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="portfolio" style={rootStyle}>
      {content.site.design.backgroundImage && <div className="page-texture" aria-hidden="true" style={{ backgroundImage: `url("${content.site.design.backgroundImage}")` }} />}
      {header}
      <main id="main-content">
        {privateMode && hiddenPage ? renderPrivatePage(hiddenPage) :
          privateMode && sectionOnly ? renderSection(sectionOnly) :
            currentAlbum ? renderAlbum(currentAlbum) :
              visibleIds.map((id) => <div key={id}>{renderSection(id)}</div>)}
      </main>
      {footer}
      {justUpdated && (
        <div className="live-toast" role="status" aria-live="polite">
          <span className="live-toast-dot" />Site mis à jour
        </div>
      )}

      {dialog && (
        <div className="dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <div className="dialog-panel" role="dialog" aria-modal="true" style={{ maxHeight: "90vh", overflow: "auto" }}>
            <button className="modal-close" type="button" aria-label={labels.close} onClick={() => setDialog(null)}><Icon name="close" /></button>
            {dialog === "legal" && (
              <>
                <p className="dialog-eyebrow">MATÉRIOSOL</p>
                <h2 className="dialog-title">{labels.legal}</h2>
                <p className="legal-copy">{content.site.legal}</p>
              </>
            )}
            {dialog === "hours" && (
              <>
                <p className="dialog-eyebrow">MATÉRIOSOL</p>
                <h2 className="dialog-title">{labels.hoursTitle}</h2>
                <div className="hours-dialog">
                  <span className="hours-title"><Icon name="clock" />{labels.hoursTitle}</span>
                  <strong>{daysLabel()}</strong>
                  <div className="hours-times">
                    <span>{labels.morning} · {formatTime(content.hours.morningStart)} <i>—</i> {formatTime(content.hours.morningEnd)}</span>
                    <span className="hours-separator" />
                    <span>{labels.afternoon} · {formatTime(content.hours.afternoonStart)} <i>—</i> {formatTime(content.hours.afternoonEnd)}</span>
                  </div>
                </div>
              </>
            )}
            {dialog === "form" && (
              <>
                <p className="dialog-eyebrow">MATÉRIOSOL</p>
                <h2 className="dialog-title">{labels.formTitle}</h2>
                {formStatus === "sent" ? (
                  <p className="form-result">{labels.sent}</p>
                ) : (
                  <form className="public-form" onSubmit={submitForm}>
                    <label>{labels.formName}<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                    <label>{labels.formEmail}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                    <label>{labels.formOrganization}<input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} /></label>
                    <label>{labels.formPhone}<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
                    <label className="form-wide">Sujet<input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /></label>
                    <label className="form-wide">{labels.formMessage}<textarea required rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
                    <input tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
                    <p className="form-wide form-privacy">{labels.formPrivacy}</p>
                    <div className="form-wide form-end">
                      <span className={`form-result${formStatus === "error" ? " error" : ""}`}>
                        {formStatus === "error" ? labels.formError : formStatus === "sending" ? labels.sending : ""}
                      </span>
                      <button className="button button-teal" type="submit" disabled={formStatus === "sending"}>{labels.send}<Icon name="diagonal" /></button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {lightbox && lightbox.items[lightbox.index] && (
        <div className="dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className="lightbox-panel" role="dialog" aria-modal="true" aria-label={labels.openPhoto}>
            <button className="modal-close" type="button" aria-label={labels.close} onClick={() => setLightbox(null)}><Icon name="close" /></button>
            <figure className="lightbox-figure">
              <img src={lightbox.items[lightbox.index].src} alt={lightbox.items[lightbox.index].alt ?? ""} />
              <figcaption>
                <span>{lightbox.items[lightbox.index].alt}</span>
                <span><i>·</i>{lightbox.index + 1} / {lightbox.items.length}</span>
              </figcaption>
            </figure>
            <div className="lightbox-controls">
              <button className="round-button" type="button" aria-label={labels.previousPhoto} onClick={() => setLightbox((state) => state ? { ...state, index: (state.index - 1 + state.items.length) % state.items.length } : state)}><Icon name="back" /></button>
              <button className="round-button" type="button" aria-label={labels.nextPhoto} onClick={() => setLightbox((state) => state ? { ...state, index: (state.index + 1) % state.items.length } : state)}><Icon name="next" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
