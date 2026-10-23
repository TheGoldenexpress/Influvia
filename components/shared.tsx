"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Video, Camera, X } from "lucide-react";
export type Creator = {
  id: string;
  name: string;
  city: string;
  region: string;
  district: string;
  niche: string;
  language: string;
  followers: number;
  engagement: number;
  rate: number;
  photo: string;
  photoIndex?: number;
  instagram?: string;
  youtube?: string;
  facebook?: string;
  email?: string;
  phone?: string;
  isDemo?: boolean;
  acceptsFreeCollab: boolean;
  bio?: string;
  platforms: string[];
  locked?: boolean;
};
export type Account = {
  id: string;
  name: string;
  email: string;
  company: string;
  paid: boolean;
  owner: boolean;
  accessUntil: number | null;
  createdAt: number;
  packageId?: string;
  plan?: {
    id?: string;
    name: string;
    searchLimit: number | null;
    resultLimit: number | null;
  };
  searchesUsed?: number;
};
export const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const currencyMoney=(minor:number,currency="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:2}).format((minor||0)/100);
export const compact = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
export const date = (n: number) =>
  new Date(n).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
export const signIn = (p = "/brand") =>
  `/signin-with-chatgpt?return_to=${encodeURIComponent(p)}`;
export async function api(path: string, options?: RequestInit): Promise<any> {
  const r = await fetch(`/api/${path}`, options);
  const d = (await r.json()) as any;
  if (!r.ok) throw new Error(d.error || "Please try again.");
  return d;
}
export const post = (d: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(d),
});
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`wordmark ${light ? "light" : ""}`}
      href="/"
      aria-label="INFLUVIA home"
    >
      <svg className="brand-symbol" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" />
        <path
          d="M10 12h5v16h-5zm9 0h5l3 9 3-9h4l-6 16h-3z"
          fill="var(--logo-cutout,white)"
        />
        <circle cx="12.5" cy="8" r="2" fill="var(--logo-cutout,white)" />
      </svg>
      <span className="brand-name">INFLUVIA</span>
    </a>
  );
}
export function Platform({ type = "instagram" }: { type?: string }) {
  return (
    <span className={`platform ${type}`} title={type} aria-label={type}>
      {type === "youtube" ? (
        <Video size={14} />
      ) : type === "facebook" ? (
        <b style={{ fontSize: 16, lineHeight: 1 }}>f</b>
      ) : (
        <Camera size={13} />
      )}
    </span>
  );
}
export function Portrait({
  creator,
  className = "",
}: {
  creator: Creator;
  className?: string;
}) {
  const [failedPhoto, setFailedPhoto] = useState("");
  const artwork = samplePortrait(
    failedPhoto === creator.photo ? { ...creator, photo: "" } : creator,
  );
  return artwork ? (
    <span
      className={`portrait-atlas ${className}`}
      role="img"
      aria-label={`${creator.isDemo ? "Sample" : "Placeholder"} portrait for ${creator.name}`}
    >
      <svg
        viewBox={`${artwork.index % artwork.cells} ${Math.floor(artwork.index / artwork.cells) * 1.25} 1 1.25`}
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <image
          href={artwork.src}
          x="0"
          y="0"
          width={artwork.cells}
          height={artwork.cells * 1.25}
        />
      </svg>
    </span>
  ) : creator.photo ? (
    <img
      className={className}
      src={creator.photo}
      alt={creator.name}
      loading="lazy"
      onError={() => setFailedPhoto(creator.photo)}
    />
  ) : (
    <span className={`initial-avatar ${className}`}>
      {creator.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function samplePortrait(creator: Creator) {
  if (creator.photo && creator.photoIndex === undefined) return null;
  const hash = [...creator.id].reduce(
    (a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0,
    0,
  );
  return {
    src: "/sample-influencers-color.png",
    index: creator.photoIndex ?? hash % 100,
    cells: 10,
  };
}
export function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 1440 210" aria-hidden="true">
      <g fill="#a58f74" opacity=".21" stroke="#a58f74" strokeWidth=".6">
        <path d="M0 210V166h36v-15h32v28h26v-63h49v-12h21v69h42v-25h53v33h50v-29h48v58z" />
        <path d="M114 210V86h9V72h5V54l6-17 6 17v18h5v14h9v124zm113 0V86h9V72h5V54l6-17 6 17v18h5v14h9v124z" />
        <path d="M145 210v-95h91v95h-22v-46c0-30-48-30-48 0v46zm0-111h91v17h-91zm24 0V88a21 21 0 0142 0v11z" />
        <path d="M340 210v-44h14v-23h8v23h41v-23h8v23h14v44zm112 0v-68h12v-16h58v16h12v68zm12-84a29 29 0 0158 0zm113 84v-47h64v47zm95 0v-27h23v-41h12v-33h5v33h12v41h23v27z" />
        <path d="M740 210v-39h54v-37h33v37h26v-21h48v60zm198 0v-58h13v-34h7v-22l5-9 5 9v22h7v34h13v58zm71 0v-48h35v-15h43v63zm111 0v-23h46v-54h55v54h39v23zm59-77a19 19 0 0138 0zm119 77v-53h48v-22h42v75z" />
      </g>
    </svg>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>Local voices. Real possibilities.</p>
      </div>
      <div className="footer-links">
        <a href="/demo">Discover</a>
        <a href="/#membership">Membership</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
      <span>
        Made for local. Starting in Hyderabad.
        <br />
        <small>© {new Date().getFullYear()} INFLUVIA</small>
      </span>
    </footer>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
