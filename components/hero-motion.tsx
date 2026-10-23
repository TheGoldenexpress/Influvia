"use client";
import { useEffect, type RefObject } from "react";

function SocialSymbol({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {kind === "instagram" ? (
        <>
          <rect x="11" y="11" width="42" height="42" rx="13" />
          <circle cx="32" cy="32" r="10" />
          <circle cx="45" cy="19" r="2" fill="currentColor" stroke="none" />
        </>
      ) : kind === "youtube" ? (
        <>
          <rect x="7" y="16" width="50" height="32" rx="10" />
          <path d="m27 24 15 8-15 8Z" fill="currentColor" stroke="none" />
        </>
      ) : kind === "facebook" ? (
        <path d="M37 54V34h8l2-9H37v-5c0-3 1-5 6-5h5V7h-7c-10 0-15 5-15 14v4h-8v9h8v20" />
      ) : kind === "camera" ? (
        <>
          <rect x="7" y="19" width="50" height="34" rx="8" />
          <path d="m20 19 4-9h16l4 9" />
          <circle cx="32" cy="36" r="10" />
          <path d="M47 27h3" />
        </>
      ) : kind === "growth" ? (
        <>
          <path d="M10 51h44M15 43V31m13 12V24m13 19V13M10 23 26 12l12 4 15-9M43 7h10v10" />
        </>
      ) : kind === "megaphone" ? (
        <>
          <path d="m10 25 35-13v35L10 34Zm6 11 5 18h10l-6-15M45 24l10-4m-10 16 10 4" />
          <path d="M11 25H6v9h5" />
        </>
      ) : kind === "store" ? (
        <>
          <path d="M10 27v27h44V27M7 27l7-17h36l7 17M6 27c0 9 12 9 13 0 1 9 12 9 13 0 1 9 12 9 13 0 1 9 12 9 13 0M25 54V38h14v16" />
        </>
      ) : (
        <>
          <path d="M13 51V13h38M23 40l9-10 9 4 12-17M44 17h9v9" />
        </>
      )}
    </svg>
  );
}

export function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere" aria-hidden="true">
      <div className="hero-ambient-light ambient-one" />
      <div className="hero-ambient-light ambient-two" />
      <div className="hero-perspective-grid" />
      <div className="hero-motion-stage">
        <svg
          className="hero-connection-map"
          viewBox="0 0 1440 1100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            className="connection-track"
            d="M-90 350C250 120 400 610 780 380S1200 30 1540 240M-100 800C280 1080 460 310 890 580s450 370 680 140"
          />
          <path
            className="connection-signal"
            d="M-90 350C250 120 400 610 780 380S1200 30 1540 240M-100 800C280 1080 460 310 890 580s450 370 680 140"
          />
          <circle cx="265" cy="315" r="5" />
          <circle cx="800" cy="368" r="4" />
          <circle cx="1235" cy="190" r="6" />
          <circle cx="1120" cy="700" r="4" />
        </svg>
        {[
          "instagram",
          "youtube",
          "camera",
          "facebook",
          "growth",
          "megaphone",
          "store",
          "analytics",
        ].map((kind, i) => (
          <div className={`hero-motion-object object-${i + 1}`} key={kind}>
            <div className="motion-object-face">
              <SocialSymbol kind={kind} />
            </div>
            <span className="motion-object-shadow" />
          </div>
        ))}
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-signal-bars">
          {Array.from({ length: 15 }, (_, i) => (
            <span
              key={i}
              style={{
                height: `${18 + ((i * 17) % 52)}px`,
                animationDelay: `${i * -0.18}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="hero-type-protection" />
    </div>
  );
}

export function useLandingMotion(
  scope: RefObject<HTMLDivElement | null>,
  paused: boolean,
) {
  useEffect(() => {
    const root = scope.current;
    if (!root || paused) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // GSAP starts its ticker at import time. Workers reject those global timers,
    // so load the animation runtime only after the browser mounts the page.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        dispose = () => media.revert();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const select = gsap.utils.selector(root);
          const hero = root.querySelector<HTMLElement>(".mono-hero")!;
          const float = gsap.to(select(".hero-motion-object"), {
            y: (i) => (i % 2 ? -27 : 32),
            x: (i) => (i % 3 ? -13 : 22),
            rotation: (i) => (i % 2 ? 9 : -7),
            duration: (i) => 5 + i * 0.7,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            stagger: 0.18,
          });
          const background = gsap.to(select(".hero-motion-stage"), {
            y: 160,
            rotate: 2,
            ease: "none",
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 1.2,
            },
          });
          gsap.to(select(".mono-hero-gallery"), {
            y: -40,
            scale: 0.96,
            ease: "none",
            scrollTrigger: {
              trigger: hero,
              start: "55% top",
              end: "bottom top",
              scrub: 1,
            },
          });

          const words = select(".scroll-word");
          if (words.length)
            gsap.fromTo(
              words,
              { opacity: 0.18 },
              {
                opacity: 1,
                stagger: 0.15,
                ease: "none",
                scrollTrigger: {
                  trigger: root.querySelector(".mono-lead"),
                  start: "top 85%",
                  end: "bottom 48%",
                  scrub: 0.6,
                },
              },
            );

          root
            .querySelectorAll<HTMLElement>(".mono-story-photo")
            .forEach((frame) => {
              const photo = frame.querySelector(".editorial-photo");
              if (!photo) return;
              gsap
                .timeline({
                  scrollTrigger: {
                    trigger: frame,
                    start: "top 95%",
                    end: "bottom 5%",
                    scrub: 0.8,
                  },
                })
                .fromTo(
                  photo,
                  { scale: 0.9, yPercent: 5, opacity: 0.4 },
                  {
                    scale: 1,
                    yPercent: 0,
                    opacity: 1,
                    duration: 0.5,
                    ease: "power1.out",
                  },
                )
                .to(
                  photo,
                  {
                    scale: 1.06,
                    yPercent: -5,
                    opacity: 0.4,
                    duration: 0.35,
                    ease: "power1.in",
                  },
                  0.8,
                );
            });
          [".mono-process-grid", ".mono-plan-grid"].forEach((selector) => {
            const grid = root.querySelector(selector);
            if (!grid) return;
            gsap.fromTo(
              grid.children,
              { y: 65, opacity: 0.2, rotateX: 5 },
              {
                y: 0,
                opacity: 1,
                rotateX: 0,
                duration: 1.1,
                stagger: 0.14,
                ease: "power3.out",
                scrollTrigger: { trigger: grid, start: "top 87%", once: true },
              },
            );
          });
          const wall = root.querySelector(".mono-wall-columns");
          if (wall)
            gsap.fromTo(
              wall,
              { rotation: -6, scale: 1.1 },
              {
                rotation: 0,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: wall,
                  start: "top bottom",
                  end: "center center",
                  scrub: 1.2,
                },
              },
            );

          const observer = new IntersectionObserver(([entry]) =>
            float.paused(!entry.isIntersecting || document.hidden),
          );
          observer.observe(hero);
          const onVisibility = () =>
            float.paused(
              document.hidden || hero.getBoundingClientRect().bottom < 0,
            );
          document.addEventListener("visibilitychange", onVisibility);
          const refresh = () => {
            if (!cancelled) ScrollTrigger.refresh();
          };
          document.fonts.ready.then(refresh);
          window.addEventListener("load", refresh, { once: true });
          return () => {
            observer.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("load", refresh);
            float.kill();
            background.kill();
          };
        });
      })
      .catch(() => {
        if (!cancelled)
          console.error("INFLUVIA could not load scroll animations.");
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [scope, paused]);
}
