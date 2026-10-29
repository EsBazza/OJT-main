"use client";

import { useEffect, useRef } from "react";

// Decorative WebGL background for the sign-in page: a network globe, orbit rings, and a wave grid.
// Three.js loads lazily, pauses in hidden tabs, renders one still frame under reduced motion,
// and leaves the CSS gradient in place when WebGL is unavailable.
export function LoginScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cleanup = () => {};
    let cancelled = false;

    import("three").then((THREE) => {
      if (cancelled) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = window.innerWidth < 768;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050d24, 0.055);
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 0, 9);

      const disposables: { dispose: () => void }[] = [];
      const track = <T extends { dispose: () => void }>(item: T) => { disposables.push(item); return item; };

      // Soft round sprite so points render as glowing dots instead of squares.
      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = spriteCanvas.height = 64;
      const context = spriteCanvas.getContext("2d")!;
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.65)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
      const sprite = track(new THREE.CanvasTexture(spriteCanvas));

      const blue = new THREE.Color(0x4da3ff);
      const gold = new THREE.Color(0xf5b700);
      const white = new THREE.Color(0xdbe8ff);

      // Globe: points on a Fibonacci sphere, a few highlighted in gold.
      const world = new THREE.Group();
      scene.add(world);
      const count = small ? 420 : 720;
      const radius = 2.6;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const points: InstanceType<typeof THREE.Vector3>[] = [];
      for (let index = 0; index < count; index++) {
        const y = 1 - (index / (count - 1)) * 2;
        const ring = Math.sqrt(1 - y * y);
        const theta = index * Math.PI * (3 - Math.sqrt(5));
        const point = new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(radius);
        points.push(point);
        point.toArray(positions, index * 3);
        (Math.random() < 0.08 ? gold : Math.random() < 0.3 ? white : blue).toArray(colors, index * 3);
      }
      const globeGeometry = track(new THREE.BufferGeometry());
      globeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      globeGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const globeMaterial = track(new THREE.PointsMaterial({ size: 0.09, map: sprite, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      world.add(new THREE.Points(globeGeometry, globeMaterial));

      // Network lines between nearby points, computed once.
      const linePositions: number[] = [];
      const maxDistance = small ? 0.62 : 0.5;
      for (let a = 0; a < count; a++) {
        for (let b = a + 1; b < count; b++) {
          if (points[a].distanceTo(points[b]) < maxDistance && Math.random() < 0.55) linePositions.push(...points[a].toArray(), ...points[b].toArray());
        }
      }
      const lineGeometry = track(new THREE.BufferGeometry());
      lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const lineMaterial = track(new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      world.add(new THREE.LineSegments(lineGeometry, lineMaterial));

      // Inner glow core.
      const coreMaterial = track(new THREE.SpriteMaterial({ map: sprite, color: 0x1d4ed8, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      const core = new THREE.Sprite(coreMaterial);
      core.scale.setScalar(radius * 3.2);
      world.add(core);

      // Tilted orbit rings, each carrying a "data packet".
      const rings = [
        { radius: 3.4, tilt: [1.15, 0.2, 0], speed: 0.5, color: 0xf5b700 },
        { radius: 3.9, tilt: [1.5, -0.6, 0.4], speed: -0.32, color: 0x60a5fa },
      ].map((config) => {
        const group = new THREE.Group();
        group.rotation.set(config.tilt[0], config.tilt[1], config.tilt[2]);
        const curve = new THREE.EllipseCurve(0, 0, config.radius, config.radius);
        const ringGeometry = track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160).map((point) => new THREE.Vector3(point.x, point.y, 0))));
        const ringMaterial = track(new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
        group.add(new THREE.LineLoop(ringGeometry, ringMaterial));
        const packetMaterial = track(new THREE.SpriteMaterial({ map: sprite, color: config.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const packet = new THREE.Sprite(packetMaterial);
        packet.scale.setScalar(0.42);
        group.add(packet);
        world.add(group);
        return { packet, radius: config.radius, speed: config.speed, offset: Math.random() * Math.PI * 2 };
      });

      // Wave grid floor.
      const columns = small ? 60 : 110;
      const rows = small ? 28 : 40;
      const gridPositions = new Float32Array(columns * rows * 3);
      const spacing = 0.42;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = (row * columns + column) * 3;
          gridPositions[index] = (column - columns / 2) * spacing;
          gridPositions[index + 2] = -row * spacing + 4;
        }
      }
      const gridGeometry = track(new THREE.BufferGeometry());
      gridGeometry.setAttribute("position", new THREE.BufferAttribute(gridPositions, 3));
      const gridMaterial = track(new THREE.PointsMaterial({ size: 0.05, map: sprite, color: 0x3b82f6, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      const grid = new THREE.Points(gridGeometry, gridMaterial);
      grid.position.y = -3.6;
      scene.add(grid);

      // Distant star dust.
      const dustCount = small ? 250 : 500;
      const dust = new Float32Array(dustCount * 3);
      for (let index = 0; index < dustCount * 3; index += 3) {
        dust[index] = (Math.random() - 0.5) * 40;
        dust[index + 1] = (Math.random() - 0.3) * 22;
        dust[index + 2] = -Math.random() * 25 - 2;
      }
      const dustGeometry = track(new THREE.BufferGeometry());
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      const dustMaterial = track(new THREE.PointsMaterial({ size: 0.08, map: sprite, color: 0xc9d6ee, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      const stars = new THREE.Points(dustGeometry, dustMaterial);
      scene.add(stars);

      // Layout: globe sits left of the sign-in card on wide screens, above it on narrow ones.
      const layout = () => {
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        const visibleWidth = visibleHeight * camera.aspect;
        const wide = camera.aspect > 1.15;
        world.position.set(wide ? -visibleWidth * 0.2 : 0, wide ? 0.2 : visibleHeight * 0.3, 0);
        world.scale.setScalar(wide ? 1 : 0.85);
      };
      layout();
      const resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(container);

      // Pointer parallax eases toward the cursor instead of snapping to it.
      const pointer = { x: 0, y: 0 };
      const tilt = { x: 0, y: 0 };
      const onPointer = (event: PointerEvent) => {
        pointer.x = event.clientX / window.innerWidth - 0.5;
        pointer.y = event.clientY / window.innerHeight - 0.5;
      };
      if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

      const clock = new THREE.Clock();
      let frame = 0;
      const render = () => {
        const time = clock.getElapsedTime();
        world.rotation.y = time * 0.08 + tilt.x * 0.6;
        world.rotation.x = 0.25 + tilt.y * 0.35;
        rings.forEach((ring) => {
          const angle = time * ring.speed + ring.offset;
          ring.packet.position.set(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0);
        });
        const attribute = gridGeometry.getAttribute("position") as InstanceType<typeof THREE.BufferAttribute>;
        for (let index = 0; index < gridPositions.length; index += 3) {
          const x = gridPositions[index];
          const z = gridPositions[index + 2];
          gridPositions[index + 1] = Math.sin(x * 0.45 + time * 0.9) * 0.28 + Math.cos(z * 0.5 + time * 0.6) * 0.22;
        }
        attribute.needsUpdate = true;
        stars.rotation.y = time * 0.006;
        camera.position.x += (tilt.x * 1.2 - camera.position.x) * 0.05;
        camera.position.y += (-tilt.y * 0.8 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      const loop = () => {
        tilt.x += (pointer.x - tilt.x) * 0.04;
        tilt.y += (pointer.y - tilt.y) * 0.04;
        render();
        frame = requestAnimationFrame(loop);
      };
      const start = () => { if (!frame && !reduceMotion) { clock.start(); frame = requestAnimationFrame(loop); } };
      const stop = () => { cancelAnimationFrame(frame); frame = 0; };
      const onVisibility = () => (document.hidden ? stop() : start());

      if (reduceMotion) render();
      else start();
      document.addEventListener("visibilitychange", onVisibility);
      requestAnimationFrame(() => container.classList.add("is-ready"));

      cleanup = () => {
        stop();
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        disposables.forEach((item) => item.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {});

    return () => { cancelled = true; cleanup(); };
  }, []);

  return <div ref={host} className="login-scene" aria-hidden="true" />;
}
