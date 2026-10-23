import { useEffect, useRef } from "react";

/**
 * One shared WebGL scene for the whole app. Objects are deliberately abstract:
 * pearl/glass forms drifting behind the interface, with a soft studio
 * environment and a restrained pointer parallax.
 */
export default function Scene3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import(
          "three/examples/jsm/environments/RoomEnvironment.js"
        );
        const { RoundedBoxGeometry } = await import(
          "three/examples/jsm/geometries/RoundedBoxGeometry.js"
        );
        if (disposed) return;

        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        canvas.className = "scene3d-canvas";
        host.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
        camera.position.set(0, 0, 12.5);

        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = environment;

        scene.add(new THREE.AmbientLight(0xffffff, 1.45));

        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(5, 8, 7);
        scene.add(key);

        const blueFill = new THREE.PointLight(0x7aa8ff, 42, 26, 2);
        blueFill.position.set(-8, -5, 4);
        scene.add(blueFill);

        const warmFill = new THREE.PointLight(0xffd6a1, 30, 24, 2);
        warmFill.position.set(7, -6, 3);
        scene.add(warmFill);

        const group = new THREE.Group();
        group.position.set(0, 0.15, 0);
        group.scale.setScalar(0.88);
        scene.add(group);

        const makeGlass = (color: number, transmission = 0.38) =>
          new THREE.MeshPhysicalMaterial({
            color,
            metalness: 0.02,
            roughness: 0.16,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            transmission,
            thickness: 0.9,
            ior: 1.46,
            envMapIntensity: 1.15,
            transparent: true,
            opacity: 0.94,
          });

        const knot = new THREE.Mesh(
          new THREE.TorusKnotGeometry(2.05, 0.5, 180, 32, 2, 3),
          makeGlass(0xdbe7ff, 0.44),
        );
        knot.position.set(4.55, 2.35, -1.2);
        knot.rotation.set(0.45, -0.4, 0.25);
        group.add(knot);

        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(1.72, 64, 64),
          makeGlass(0xffffff, 0.3),
        );
        orb.position.set(-4.75, 2.2, -2.2);
        group.add(orb);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.58, 0.4, 36, 120),
          makeGlass(0xf0dcc2, 0.32),
        );
        ring.position.set(-2.6, -2.8, -2.4);
        ring.rotation.set(1.02, 0.35, -0.4);
        group.add(ring);

        const pebble = new THREE.Mesh(
          new RoundedBoxGeometry(1.8, 1.8, 1.8, 8, 0.58),
          makeGlass(0xe7e1ff, 0.4),
        );
        pebble.position.set(4.15, -2.9, -3.3);
        pebble.rotation.set(0.35, -0.55, 0.2);
        group.add(pebble);

        const smallSpheres: Array<{ mesh: import("three").Mesh; baseY: number; speed: number }> = [];
        const sphereGeometry = new THREE.SphereGeometry(1, 24, 24);
        const sphereMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xd8b887,
          metalness: 0.55,
          roughness: 0.24,
          clearcoat: 1,
          envMapIntensity: 1.5,
        });
        const positions = [
          [-1.2, 4.4, -3.5, 0.22],
          [2.1, 4.9, -5.2, 0.16],
          [-5.9, -0.9, -4.1, 0.13],
          [6.1, 0.3, -4.4, 0.18],
          [0.7, -4.1, -5.6, 0.12],
        ];
        for (const [x, y, z, scale] of positions) {
          const dot = new THREE.Mesh(sphereGeometry, sphereMaterial);
          dot.position.set(x, y, z);
          dot.scale.setScalar(scale);
          group.add(dot);
          smallSpheres.push({ mesh: dot, baseY: y, speed: 0.5 + Math.random() * 0.5 });
        }

        const dustGeometry = new THREE.BufferGeometry();
        const dustCount = 120;
        const dustPositions = new Float32Array(dustCount * 3);
        for (let index = 0; index < dustCount; index += 1) {
          dustPositions[index * 3] = (Math.random() - 0.5) * 22;
          dustPositions[index * 3 + 1] = (Math.random() - 0.5) * 14;
          dustPositions[index * 3 + 2] = -2 - Math.random() * 9;
        }
        dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
        const dust = new THREE.Points(
          dustGeometry,
          new THREE.PointsMaterial({
            color: 0x9db8e8,
            size: 0.035,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          }),
        );
        group.add(dust);

        const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let visible = !document.hidden;
        let elapsed = 0;
        let lastFrame = performance.now();

        function resize() {
          const width = window.innerWidth;
          const height = window.innerHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();

          const compact = width < 760;
          knot.visible = !compact;
          pebble.visible = !compact;
          dust.visible = !compact;
          group.position.x = compact ? 1.3 : 0;
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
          if (!visible) return;

          const now = performance.now();
          const delta = Math.min((now - lastFrame) / 1000, 0.05);
          lastFrame = now;
          elapsed += delta;
          pointer.x += (pointer.tx - pointer.x) * Math.min(1, delta * 3.2);
          pointer.y += (pointer.ty - pointer.y) * Math.min(1, delta * 3.2);

          camera.position.x = pointer.x * 0.65;
          camera.position.y = -pointer.y * 0.42;
          camera.lookAt(0, 0, 0);

          if (!reducedMotion) {
            group.rotation.y = pointer.x * 0.075 + Math.sin(elapsed * 0.11) * 0.055;
            group.rotation.x = pointer.y * 0.045 + Math.sin(elapsed * 0.16) * 0.025;
            knot.rotation.z += delta * 0.075;
            knot.rotation.y += delta * 0.045;
            ring.rotation.z -= delta * 0.1;
            pebble.rotation.y += delta * 0.055;
            orb.position.y = 2.2 + Math.sin(elapsed * 0.55) * 0.12;
            ring.position.y = -2.8 + Math.sin(elapsed * 0.42 + 1) * 0.14;
            pebble.position.y = -2.9 + Math.sin(elapsed * 0.5 + 2) * 0.12;
            knot.position.y = 2.35 + Math.sin(elapsed * 0.38) * 0.14;
            for (const dot of smallSpheres) {
              dot.mesh.position.y = dot.baseY + Math.sin(elapsed * dot.speed + dot.baseY) * 0.18;
            }
            dust.rotation.z = Math.sin(elapsed * 0.035) * 0.03;
          }

          renderer.render(scene, camera);
        }

        resize();
        render();

        window.addEventListener("resize", resize, { passive: true });
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);

        cleanup = () => {
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
        // CSS gradients remain as a graceful fallback when WebGL is unavailable.
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="scene3d-host" aria-hidden="true" />;
}
