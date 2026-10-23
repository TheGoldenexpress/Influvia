"use client";
import {
  Suspense,
  useMemo,
  useRef,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, useTexture, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
function CreatorCard({
  index,
  position,
  rotation,
}: {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const atlas = useTexture("/creator-portraits.png");
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 900;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#fcfaf4";
    c.fillRect(0, 0, 640, 900);
    const image = atlas.image as HTMLImageElement;
    const w = image.width / 3;
    c.drawImage(image, index * w, 35, w, (w * 645) / 600, 20, 20, 600, 645);
    c.fillStyle = "#173e32";
    c.font = "500 35px sans-serif";
    c.fillText(["Kavya Reddy", "Sai Kiran", "Zoya Fatima"][index], 34, 728);
    c.font = "23px sans-serif";
    c.fillStyle = "#79836d";
    c.fillText(
      [
        "Food & everyday stories",
        "Places. People. Possibilities.",
        "Style with a point of view.",
      ][index],
      34,
      767,
    );
    c.fillStyle = "#eaf2dc";
    c.fillRect(33, 807, 245, 48);
    c.font = "21px sans-serif";
    c.fillStyle = "#48603b";
    c.fillText(
      ["Telugu · Hyderabad", "Hindi · Nizamabad", "Urdu · Sangareddy"][index],
      45,
      839,
    );
    c.fillStyle = "#819171";
    c.font = "18px sans-serif";
    c.fillText("SAMPLE PROFILE", 398, 838);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [atlas, index]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.03, 2.86, 0.09]} radius={0.13} smoothness={4}>
        <meshStandardMaterial color="#f4f1e7" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[1.94, 2.73]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}
function Constellation({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const targetX = reduced
      ? 0
      : Math.sin(t * 0.25) * 0.03 + state.pointer.y * 0.06;
    const targetY = reduced
      ? 0
      : Math.sin(t * 0.2) * 0.06 + state.pointer.x * 0.13;
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      targetX,
      3,
      delta,
    );
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      targetY,
      3,
      delta,
    );
    group.current.position.y = reduced ? 0 : Math.sin(t * 0.55) * 0.08;
  });
  return (
    <group ref={group}>
      <mesh rotation={[0.9, 0.15, 0.55]} position={[0, -0.2, -1.5]}>
        <torusGeometry args={[2.65, 0.035, 10, 120]} />
        <meshStandardMaterial
          color="#d2d8be"
          metalness={0.35}
          roughness={0.45}
        />
      </mesh>
      <mesh rotation={[0.7, -0.2, -0.2]} position={[0, 0, -1.8]}>
        <torusGeometry args={[3.06, 0.018, 8, 120]} />
        <meshStandardMaterial color="#d9dfca" metalness={0.4} roughness={0.5} />
      </mesh>
      <CreatorCard
        index={1}
        position={[1.15, 0.95, -0.7]}
        rotation={[-0.07, -0.17, -0.15]}
      />
      <CreatorCard
        index={2}
        position={[0.95, -1.55, -0.2]}
        rotation={[0.04, -0.12, 0.15]}
      />
      <CreatorCard
        index={0}
        position={[-0.85, 0.15, 0.8]}
        rotation={[0.02, 0.17, 0.11]}
      />
      <mesh position={[-2.5, 1.9, -0.4]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#a8c587" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[2.65, -0.7, 0.1]}>
        <sphereGeometry args={[0.08, 20, 20]} />
        <meshStandardMaterial color="#d8a98b" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <SceneFallback /> : this.props.children;
  }
}
function SceneFallback() {
  return (
    <div className="scene-fallback" aria-hidden="true">
      {[1, 0, 2].map((i) => (
        <div className={`fallback-card fc-${i}`} key={i}>
          <span
            className="portrait-atlas"
            style={{
              backgroundImage: "url(/creator-portraits.png)",
              backgroundPosition: `${i * 50}% center`,
            }}
          />
          <b>{["Kavya Reddy", "Sai Kiran", "Zoya Fatima"][i]}</b>
          <small>Sample creator · Telangana</small>
        </div>
      ))}
    </div>
  );
}
export default function CreatorScene() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    setReady(true);
  }, []);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) =>
      setVisible(e.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="three-scene"
      ref={host}
      role="img"
      aria-label="Interactive three-dimensional constellation of illustrative creator profile cards"
    >
      <div className="scene-circle" />
      {ready ? (
        <SceneBoundary>
          <Canvas
            frameloop={visible && !reduced ? "always" : "demand"}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 8.5], fov: 43 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          >
            <ambientLight intensity={2.1} />
            <directionalLight position={[4, 6, 5]} intensity={3.2} />
            <directionalLight
              position={[-4, -2, 4]}
              intensity={1.3}
              color="#c7dfb2"
            />
            <Suspense fallback={null}>
              <Constellation reduced={reduced} />
            </Suspense>
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              minPolarAngle={1.25}
              maxPolarAngle={1.85}
              minAzimuthAngle={-0.3}
              maxAzimuthAngle={0.3}
            />
          </Canvas>
        </SceneBoundary>
      ) : (
        <SceneFallback />
      )}
      <span className="scene-tag scene-tag-top">
        <i /> A whole world, closer to home.
      </span>
      <span className="scene-tag scene-tag-bottom">
        <span>↗</span>
        <b>
          Local voices.<small>Endless possibilities.</small>
        </b>
      </span>
      <span className="scene-caption">
        DRAG YOUR CURIOSITY. FIND YOUR PEOPLE.
        <small>Illustrative profiles · Sample data</small>
      </span>
    </div>
  );
}
