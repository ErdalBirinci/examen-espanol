import { useEffect, useRef } from "react";

/**
 * A small WebGL still-life used as the centrepiece of the candidate entrance:
 * a translucent certification medallion with a brushed-gold rim. It stays
 * intentionally abstract and pauses when it is off screen.
 */
export default function HeroStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = host;

    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import(
          "three/examples/jsm/environments/RoomEnvironment.js"
        );
        if (disposed) return;

        const canvas = document.createElement("canvas");
        canvas.className = "hero-scene-canvas";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
        camera.position.set(0, 0.15, 8.4);

        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = environment;

        scene.add(new THREE.AmbientLight(0xffffff, 1.3));

        const key = new THREE.DirectionalLight(0xffffff, 2.9);
        key.position.set(4, 6, 7);
        scene.add(key);

        const cool = new THREE.PointLight(0x8ab4ff, 26, 24, 2);
        cool.position.set(-6, -3, 4);
        scene.add(cool);

        const warm = new THREE.PointLight(0xffd9a8, 24, 22, 2);
        warm.position.set(5.5, -4.5, 3);
        scene.add(warm);

        const group = new THREE.Group();
        group.rotation.set(0.06, -0.26, -0.02);
        scene.add(group);

        const glass = new THREE.MeshPhysicalMaterial({
          color: 0xeaf1ff,
          metalness: 0.08,
          roughness: 0.075,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          transmission: 0.56,
          thickness: 1.6,
          ior: 1.44,
          envMapIntensity: 1.55,
          transparent: true,
          opacity: 0.94,
        });

        const gold = new THREE.MeshPhysicalMaterial({
          color: 0xc9a464,
          metalness: 0.82,
          roughness: 0.2,
          clearcoat: 0.7,
          envMapIntensity: 1.6,
        });

        const pearl = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.05,
          roughness: 0.12,
          clearcoat: 1,
          transmission: 0.25,
          thickness: 1.2,
          envMapIntensity: 1.35,
          transparent: true,
          opacity: 0.96,
        });

        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(1.62, 1.62, 0.18, 96, 1, false),
          glass,
        );
        disc.rotation.x = Math.PI / 2;
        group.add(disc);

        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.63, 0.038, 18, 180), gold);
        rim.position.z = 0.015;
        group.add(rim);

        const inner = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.009, 12, 180), gold);
        inner.position.z = 0.1;
        group.add(inner);

        const innerTwo = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.005, 10, 160), gold);
        innerTwo.position.z = 0.115;
        innerTwo.material = gold.clone();
        (innerTwo.material as import("three").MeshPhysicalMaterial).opacity = 0.55;
        (innerTwo.material as import("three").MeshPhysicalMaterial).transparent = true;
        group.add(innerTwo);

        const studs: import("three").Mesh[] = [];
        const studGeometry = new THREE.SphereGeometry(1, 18, 18);
        for (let index = 0; index < 16; index += 1) {
          const angle = (index / 16) * Math.PI * 2;
          const stud = new THREE.Mesh(studGeometry, index % 4 === 0 ? gold : pearl);
          const isGold = index % 4 === 0;
          stud.scale.setScalar(isGold ? 0.052 : 0.038);
          stud.position.set(Math.cos(angle) * 1.39, Math.sin(angle) * 1.39, isGold ? 0.08 : 0.02);
          group.add(stud);
          studs.push(stud);
        }

        const halo = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.012, 10, 200), gold);
        halo.rotation.set(1.18, 0.1, 0.42);
        halo.position.set(0.15, -0.05, -0.28);
        halo.material = gold.clone();
        (halo.material as import("three").MeshPhysicalMaterial).opacity = 0.56;
        (halo.material as import("three").MeshPhysicalMaterial).transparent = true;
        group.add(halo);

        const pearls = [
          { radius: 0.13, x: 2.05, y: 0.96, z: 0.5, speed: 0.5 },
          { radius: 0.075, x: -2.16, y: 0.62, z: 0.15, speed: -0.42 },
          { radius: 0.055, x: -1.72, y: -1.4, z: 0.7, speed: 0.35 },
        ].map((item) => {
          const mesh = new THREE.Mesh(studGeometry, item.radius > 0.1 ? pearl : gold);
          mesh.scale.setScalar(item.radius);
          mesh.position.set(item.x, item.y, item.z);
          group.add(mesh);
          return { mesh, ...item };
        });

        const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let elapsed = 0;
        let visible = true;
        let inView = true;
        let lastFrame = performance.now();

        function resize() {
          const bounds = stage.getBoundingClientRect();
          const width = Math.max(1, bounds.width);
          const height = Math.max(1, bounds.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }

        function onPointerMove(event: PointerEvent) {
          pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
          pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
        }

        function onVisibility() {
          visible = !document.hidden;
          lastFrame = performance.now();
        }

        function render() {
          frame = window.requestAnimationFrame(render);
          if (!visible || !inView) return;

          const now = performance.now();
          const delta = Math.min((now - lastFrame) / 1000, 0.05);
          lastFrame = now;
          elapsed += delta;
          pointer.x += (pointer.tx - pointer.x) * Math.min(1, delta * 2.6);
          pointer.y += (pointer.ty - pointer.y) * Math.min(1, delta * 2.6);

          if (!reducedMotion) {
            group.rotation.y = -0.26 + pointer.x * 0.24 + Math.sin(elapsed * 0.24) * 0.12;
            group.rotation.x = 0.06 + pointer.y * 0.1 + Math.sin(elapsed * 0.32) * 0.02;
            group.position.y = Math.sin(elapsed * 0.62) * 0.045;
            halo.rotation.z = 0.42 + elapsed * 0.055;
            for (const item of pearls) {
              item.mesh.position.y = item.y + Math.sin(elapsed * item.speed + item.x) * 0.09;
            }
          }

          renderer.render(scene, camera);
        }

        resize();
        renderer.render(scene, camera);
        render();

        const observer = new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          lastFrame = performance.now();
        });
        observer.observe(host);

        window.addEventListener("resize", resize, { passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);

        cleanup = () => {
          observer.disconnect();
          window.cancelAnimationFrame(frame);
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("visibilitychange", onVisibility);
          scene.traverse((object) => {
            const mesh = object as import("three").Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const material = mesh.material as import("three").Material | import("three").Material[];
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material?.dispose();
          });
          environment.dispose();
          pmrem.dispose();
          renderer.dispose();
          canvas.remove();
        };
      } catch {
        // The CSS medallion behind the canvas is the fallback.
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="hero-scene" aria-hidden="true" />;
}
