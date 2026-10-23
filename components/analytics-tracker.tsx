"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function track(kind: "page_view" | "click" | "share", label = "") {
  if (
    typeof window === "undefined" ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl ||
    location.pathname.startsWith("/owner")
  )
    return;
  try {
    if (localStorage.getItem("influvia-analytics") === "off") return;
  } catch {
    return;
  }
  let source =
    new URLSearchParams(location.search).get("utm_source") || "Direct";
  try {
    if (
      source === "Direct" &&
      document.referrer &&
      new URL(document.referrer).origin !== location.origin
    )
      source = new URL(document.referrer).hostname;
  } catch {}
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      kind,
      path: location.pathname,
      label,
      source,
    }),
    keepalive: true,
  }).catch(() => {});
}
export function AnalyticsTracker() {
  const path = usePathname();
  useEffect(() => {
    track("page_view");
  }, [path]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest?.("a,button");
      if (!el || el.closest("form,dialog") || el.closest(".admin-workspace"))
        return;
      const link = el as HTMLAnchorElement;
      let label =
        el.getAttribute("data-analytics") ||
        el.getAttribute("aria-label") ||
        el.textContent?.trim() ||
        "Click";
      if (link.tagName === "A")
        try {
          const u = new URL(link.href);
          label = u.origin === location.origin ? u.pathname : "External link";
        } catch {}
      track("click", label.slice(0, 80));
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}
export function AnalyticsPreference() {
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setDisabled(localStorage.getItem("influvia-analytics") === "off");
    } catch {}
  }, []);
  return (
    <div>
      <button
        className="commerce-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/analytics/preference", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: disabled }),
            });
            if (!r.ok)
              throw new Error(
                "Your preference could not be saved. Please try again.",
              );
            localStorage.setItem("influvia-analytics", disabled ? "on" : "off");
            setDisabled(!disabled);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {disabled
          ? "Enable usage analytics on this browser"
          : "Disable usage analytics on this browser"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
