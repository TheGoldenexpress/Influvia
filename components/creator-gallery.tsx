"use client";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Pause,
  Play,
} from "lucide-react";
import * as THREE from "three";
import { Portrait, Platform, samplePortrait, type Creator } from "./shared";

function PhotoPanel({
  creator,
  index,
  count,
  active,
  reduced,
  onSelect,
  onOpen,
}: {
  creator: Creator;
  index: number;
  count: number;
  active: number;
  reduced: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const artwork = samplePortrait(creator);
  const source = useTexture(
    artwork?.src || creator.photo || "/creator-editorial-v3.png",
  );
  const group = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 900;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.roundRect(0, 0, 480, 900, 30);
    ctx.clip();
    ctx.fillStyle = "#e8eddf";
    ctx.fillRect(0, 0, 480, 900);
    const image = source.image as HTMLImageElement;
    if (artwork) {
      const w = image.width / artwork.cells;
      const h = image.height / artwork.cells;
      const cropWidth = Math.min(w, (h * 480) / 900);
      const cropHeight = Math.min(h, (w * 900) / 480);
      ctx.drawImage(
        image,
        (artwork.index % artwork.cells) * w + (w - cropWidth) / 2,
        Math.floor(artwork.index / artwork.cells) * h + (h - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        480,
        900,
      );
    } else if (creator.photo) {
      const scale = Math.max(480 / image.width, 900 / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (480 - w) / 2, (900 - h) / 2, w, h);
    } else {
      ctx.fillStyle = "#222820";
      ctx.font = "500 140px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        creator.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join(""),
        240,
        430,
      );
      ctx.textAlign = "left";
    }
    const gradient = ctx.createLinearGradient(0, 540, 0, 900);
    gradient.addColorStop(0, "#141a1900");
    gradient.addColorStop(1, "#141a19ef");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 540, 480, 360);
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 29px Manrope, sans-serif";
    const label =
      creator.name.length > 22 ? creator.name.slice(0, 21) + "…" : creator.name;
    ctx.fillText(label, 27, 782);
    ctx.font = "400 20px Manrope, sans-serif";
    ctx.fillStyle = "#e8eedf";
    ctx.fillText(creator.city || creator.region || "Creator profile", 27, 826);
    ctx.font = "400 15px Manrope, sans-serif";
    ctx.fillText(
      (creator.platforms || [])
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join(" · "),
      27,
      860,
    );
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [source, creator]);
  useEffect(() => () => texture.dispose(), [texture]);
  const middle = (count - 1) / 2;
  const selected = index === active;
  const targetX =
    (index - middle) * 0.61 +
    (active >= 0 ? (index < active ? -0.7 : index > active ? 0.7 : 0) : 0);
  const targetY =
    -0.1 + Math.cos(((index - middle) / Math.max(middle, 1)) * 1.2) * 0.12;
  const targetZ = selected ? 0.7 : -0.15 - Math.abs(index - middle) * 0.055;
  const targetRotation = selected ? 0 : index <= middle ? 1.16 : -1.16;
  const targetScale = selected ? 1.04 : 1 - Math.abs(index - middle) * 0.035;
  useFrame((_, delta) => {
    if (!group.current) return;
    const g = group.current;
    if (reduced) {
      g.position.set(targetX, targetY, targetZ);
      g.rotation.y = targetRotation;
      g.scale.setScalar(targetScale);
      return;
    }
    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, 7, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 7, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, targetZ, 7, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRotation, 7, delta);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, targetScale, 7, delta));
  });
  return (
    <group
      ref={group}
      position={[targetX, targetY, targetZ]}
      rotation={[0, targetRotation, 0]}
      scale={targetScale}
    >
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (selected) onOpen();
          else onSelect();
        }}
      >
        <planeGeometry args={[1.58, 2.96]} />
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
function Scene({
  creators,
  active,
  reduced,
  onSelect,
  onOpen,
  onReady,
}: {
  creators: Creator[];
  active: number;
  reduced: boolean;
  onSelect: (i: number) => void;
  onOpen: (c: Creator) => void;
  onReady: (ready: boolean) => void;
}) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    onReady(true);
  }, [onReady]);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const width = creators.length * 0.61 + 2.5;
    cam.position.z = Math.max(
      6.9,
      width /
        (2 *
          Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) *
          (size.width / size.height)),
    );
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, creators.length, invalidate]);
  useEffect(() => {
    invalidate();
  }, [active, reduced, invalidate]);
  return (
    <>
      {creators.map((c, i) => (
        <PhotoPanel
          key={c.id}
          creator={c}
          index={i}
          count={creators.length}
          active={active}
          reduced={reduced}
          onSelect={() => onSelect(i)}
          onOpen={() => onOpen(c)}
        />
      ))}
    </>
  );
}
function Fallback({
  creators,
  onOpen,
}: {
  creators: Creator[];
  onOpen: (c: Creator) => void;
}) {
  return (
    <div className="gallery-fallback">
      {creators.map((c) => (
        <button key={c.id} onClick={() => onOpen(c)}>
          <Portrait creator={c} />
          <b>{c.name}</b>
        </button>
      ))}
    </div>
  );
}
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function CreatorGallery({
  creators,
  onOpen,
  compact = false,
  autoPlay = false,
  openLabel = "View profile",
}: {
  creators: Creator[];
  onOpen?: (c: Creator) => void;
  compact?: boolean;
  autoPlay?: boolean;
  openLabel?: string;
}) {
  const [active, setActive] = useState(-1);
  const [mobile, setMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(autoPlay);
  const [engaged, setEngaged] = useState(false);
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => setPlaying(autoPlay), [autoPlay]);
  useEffect(() => {
    const narrow = matchMedia("(max-width: 640px)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setMobile(narrow.matches);
      setReduced(motion.matches);
    };
    update();
    narrow.addEventListener("change", update);
    motion.addEventListener("change", update);
    const observer = new IntersectionObserver(([e]) =>
      setVisible(e.isIntersecting),
    );
    if (host.current) observer.observe(host.current);
    return () => {
      narrow.removeEventListener("change", update);
      motion.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => setActive(-1), [creators]);
  useEffect(() => {
    if (!playing || !visible || reduced || engaged || creators.length < 2)
      return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % creators.length),
      2600,
    );
    return () => clearInterval(timer);
  }, [playing, visible, reduced, engaged, creators.length]);
  if (!creators.length) return null;
  const selectedIndex = active >= 0 ? Math.min(active, creators.length - 1) : 0;
  const selected = creators[selectedIndex];
  const start =
    Math.floor(selectedIndex / (mobile ? 5 : 12)) * (mobile ? 5 : 12);
  const shown = creators.slice(start, start + (mobile ? 5 : 12));
  const open = (c: Creator) =>
    onOpen ? onOpen(c) : window.location.assign("/demo");
  const fallback = <Fallback creators={shown} onOpen={open} />;
  return (
    <div
      className={`creator-gallery ${compact ? "gallery-compact" : ""}`}
      ref={host}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setEngaged(false);
      }}
    >
      <div className="gallery-canvas" onPointerLeave={() => setActive(-1)}>
        {!ready ? (
          <div
            className="gallery-poster"
            aria-label="Loading interactive gallery"
          >
            {fallback}
          </div>
        ) : null}
        <Boundary fallback={fallback}>
          <Canvas
            camera={{ fov: 32, position: [0, 0, 6.9] }}
            dpr={[1, 1.5]}
            frameloop={visible && !reduced ? "always" : "demand"}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          >
            <Suspense fallback={null}>
              <Scene
                creators={shown}
                active={active < 0 ? -1 : active - start}
                reduced={reduced}
                onSelect={(i) => setActive(i + start)}
                onOpen={open}
                onReady={setReady}
              />
            </Suspense>
          </Canvas>
        </Boundary>
      </div>
      <div className="gallery-controls">
        <div className="gallery-selected">
          <Platform type={selected.platforms?.[0]} />
          <div>
            <b>{selected.name}</b>
            <small>
              <MapPin size={11} />
              {selected.city || selected.region}
              {selected.isDemo
                ? " · Sample profile"
                : !selected.photo
                  ? " · Placeholder image"
                  : ""}
            </small>
          </div>
        </div>
        <span className="gallery-hint">Hover to explore. Select to view.</span>
        <div className="gallery-actions">
          <button
            aria-label="Previous creator"
            onClick={() =>
              setActive((selectedIndex - 1 + creators.length) % creators.length)
            }
          >
            <ArrowLeft size={18} />
          </button>
          <span>
            {String(selectedIndex + 1).padStart(2, "0")} /{" "}
            {String(creators.length).padStart(2, "0")}
          </span>
          <button
            aria-label="Next creator"
            onClick={() => setActive((selectedIndex + 1) % creators.length)}
          >
            <ArrowRight size={18} />
          </button>
          <button className="gallery-open" onClick={() => open(selected)}>
            {openLabel} <ArrowUpRight size={16} />
          </button>
          {autoPlay && !reduced ? (
            <button
              aria-label={
                playing ? "Pause gallery animation" : "Play gallery animation"
              }
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="gallery-accessible-profiles"
        aria-label="Choose a creator"
      >
        {creators.map((c, i) => (
          <button
            aria-pressed={active === i}
            key={c.id}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
