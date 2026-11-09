"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

export type MediaKind = "image" | "pdf";
export type PickMediaHandler = (path: string, kind: MediaKind) => void;

export function Card({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}

export function TextField({
  label, value, onChange, multiline = false, rows = 4, type = "text", placeholder = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea className="admin-textarea" rows={rows} value={String(value ?? "")} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="admin-input" type={type} value={String(value ?? "")} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}

export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <TextField label={label} type="number" value={value} onChange={(next) => onChange(Number(next) || 0)} />;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#1ca39c"} onChange={(event) => onChange(event.target.value)} style={{ width: 44, height: 40, border: 0, background: "none", padding: 0 }} />
        <input className="admin-input" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="admin-check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function MediaField({
  label, src, path, kind = "image", onPick,
}: {
  label: string;
  src: string;
  path: string;
  kind?: MediaKind;
  onPick: PickMediaHandler;
}) {
  return (
    <Field label={label}>
      <div className="admin-media-preview" style={{ display: "grid", placeItems: "center" }}>
        {kind === "image" && src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Icon name={kind === "pdf" ? "file" : "image"} />}
      </div>
      <button type="button" className="admin-btn" onClick={() => onPick(path, kind)}>
        <Icon name={kind === "pdf" ? "file" : "image"} />Choisir ou téléverser
      </button>
      <small style={{ color: "#71847a", fontSize: 10, wordBreak: "break-all" }}>{src || "Aucun fichier"}</small>
    </Field>
  );
}

export function AdminButton({
  children, onClick, variant = "default", disabled = false, type = "button", title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button type={type} className={`admin-btn${variant === "primary" ? " admin-btn-primary" : variant === "danger" ? " admin-btn-danger" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function RecordHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="admin-record-head">
      <div><strong>{title}</strong>{subtitle && <span style={{ display: "block" }}>{subtitle}</span>}</div>
      <div className="admin-record-tools">{children}</div>
    </div>
  );
}
