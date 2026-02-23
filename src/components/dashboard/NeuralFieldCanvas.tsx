import { useRef, useEffect } from "react";
import type { FieldNode } from "./useNeuralFieldData";

// ── Internal types ────────────────────────────────────────────────────────────

interface PhysicsNode extends FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  r: number;
  currentR: number;
}

interface Arc {
  segments: { x: number; y: number }[];
  ttl: number;
  maxTtl: number;
}

interface Star {
  // normalized 0–1 coords
  nx: number;
  ny: number;
  r: number;
  opacity: number;
  vx: number;
  vy: number;
}

// ── Base radii per type ───────────────────────────────────────────────────────

function baseRadius(type: FieldNode["type"]): number {
  if (type === "project") return 16;
  if (type === "session") return 10;
  return 7;
}

// ── Stable deterministic RNG ─────────────────────────────────────────────────

function stableRng(str: string, seed: number): number {
  let h = (seed * 2654435761) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9) >>> 0;
  }
  return h / 0xffffffff;
}

// ── Hex color → RGB ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NeuralFieldCanvas({
  nodes,
  onHoverNode,
}: {
  nodes: FieldNode[];
  onHoverNode: (node: FieldNode | null, screenX: number, screenY: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const physicsRef = useRef<Map<string, PhysicsNode>>(new Map());
  const starsRef = useRef<Star[]>([]);
  const arcsRef = useRef<Arc[]>([]);
  const hoveredIdRef = useRef<string | null>(null);
  const lastArcTsRef = useRef(0);
  const lastFrameTsRef = useRef(0);
  const onHoverRef = useRef(onHoverNode);
  onHoverRef.current = onHoverNode;

  // ── Canvas resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── Stars init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        nx: Math.random(),
        ny: Math.random(),
        r: 0.5 + Math.random() * 0.7,
        opacity: 0.2 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.000035,
        vy: (Math.random() - 0.5) * 0.000035,
      });
    }
    starsRef.current = stars;
  }, []);

  // ── Sync physics nodes with prop changes ──────────────────────────────────
  useEffect(() => {
    const physics = physicsRef.current;
    const newIds = new Set(nodes.map((n) => n.id));

    // Remove stale
    for (const id of Array.from(physics.keys())) {
      if (!newIds.has(id)) physics.delete(id);
    }

    // Pre-compute project cluster centers based on activity
    const canvas = canvasRef.current;
    const w = canvas?.offsetWidth ?? 800;
    const h = canvas?.offsetHeight ?? 600;

    // 1. Build activity score per project
    const projectActivity = new Map<string, number>();
    for (const node of nodes) {
      if (node.type === "project") projectActivity.set(node.id, 0);
    }
    for (const node of nodes) {
      if (!node.projectId || !node.isActive) continue;
      if (node.type === "session")
        projectActivity.set(node.projectId, (projectActivity.get(node.projectId) ?? 0) + 3);
      if (node.type === "agent")
        projectActivity.set(node.projectId, (projectActivity.get(node.projectId) ?? 0) + 1);
    }

    // 2. Sort project IDs by score descending → rank 0 = most active
    const projectIds = nodes.filter((n) => n.type === "project").map((n) => n.id);
    const sortedProjects = [...projectIds].sort(
      (a, b) => (projectActivity.get(b) ?? 0) - (projectActivity.get(a) ?? 0)
    );
    const N = sortedProjects.length;

    // 3. Compute stable home position + visual weight per project
    const projectCenters = new Map<string, { x: number; y: number; r: number; glow: number }>();
    sortedProjects.forEach((id, rank) => {
      const t = N <= 1 ? 0 : rank / (N - 1);
      const r1 = stableRng(id, 1);
      const r2 = stableRng(id, 2);
      const cx = (0.12 + r1 * 0.50 + (0.46 + r1 * 0.27 - 0.12 - r1 * 0.50) * t) * w;
      const cy = (0.10 + r2 * 0.35 + (0.45 + r2 * 0.33 - 0.10 - r2 * 0.35) * t) * h;
      projectCenters.set(id, {
        x: Math.max(60, Math.min(w - 60, cx)),
        y: Math.max(60, Math.min(h - 60, cy)),
        r: 20 - t * 10,       // 20 → 10
        glow: 0.7 - t * 0.5,  // 0.7 → 0.2
      });
    });

    // 4. Separate overlapping project home positions
    const MIN_PROJECT_GAP = 30; // px padding between node edges
    const pcEntries = Array.from(projectCenters.values());
    for (let iter = 0; iter < 12; iter++) {
      for (let i = 0; i < pcEntries.length; i++) {
        for (let j = i + 1; j < pcEntries.length; j++) {
          const a = pcEntries[i];
          const b = pcEntries[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r + MIN_PROJECT_GAP;
          if (d < minDist && d > 0.01) {
            const push = (minDist - d) / 2;
            const nx = dx / d;
            const ny = dy / d;
            a.x = Math.max(60, Math.min(w - 60, a.x - nx * push));
            a.y = Math.max(60, Math.min(h - 60, a.y - ny * push));
            b.x = Math.max(60, Math.min(w - 60, b.x + nx * push));
            b.y = Math.max(60, Math.min(h - 60, b.y + ny * push));
          }
        }
      }
    }

    // Add or update
    for (const node of nodes) {
      if (!physics.has(node.id)) {
        let homeX: number;
        let homeY: number;
        let nodeR: number;
        let glowOverride: number | undefined;

        if (node.type === "project") {
          const c = projectCenters.get(node.id) ?? { x: w / 2, y: h / 2, r: 16, glow: 0.4 };
          homeX = c.x;
          homeY = c.y;
          nodeR = c.r;
          glowOverride = c.glow;
        } else if (node.type === "session") {
          const pc = projectCenters.get(node.projectId ?? "") ?? { x: w / 2, y: h / 2, r: 16, glow: 0.4 };
          const angle = Math.random() * Math.PI * 2;
          const dist = 65 + Math.random() * 45;
          homeX = pc.x + Math.cos(angle) * dist;
          homeY = pc.y + Math.sin(angle) * dist;
          nodeR = baseRadius(node.type);
        } else {
          const parentNode = physics.get(node.parentId ?? "");
          const anchor = parentNode ?? (projectCenters.has(node.projectId ?? "")
            ? { homeX: projectCenters.get(node.projectId!)!.x, homeY: projectCenters.get(node.projectId!)!.y }
            : { homeX: w / 2, homeY: h / 2 });
          const angle = Math.random() * Math.PI * 2;
          const dist = 28 + Math.random() * 22;
          homeX = anchor.homeX + Math.cos(angle) * dist;
          homeY = anchor.homeY + Math.sin(angle) * dist;
          nodeR = baseRadius(node.type);
        }

        homeX = Math.max(60, Math.min(w - 60, homeX));
        homeY = Math.max(60, Math.min(h - 60, homeY));

        physics.set(node.id, {
          ...node,
          ...(glowOverride !== undefined ? { glowIntensity: glowOverride } : {}),
          x: homeX + (Math.random() - 0.5) * 20,
          y: homeY + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          homeX,
          homeY,
          r: nodeR,
          currentR: nodeR,
        });
      } else {
        // Intentional: physicsRef stores mutable physics objects used only by the animation loop.
        // These are NOT React state and must never be read in a render path.
        const p = physics.get(node.id)!;
        // project nodes get updated homes and sizing as activity changes
        if (node.type === "project") {
          const c = projectCenters.get(node.id);
          if (c) {
            p.homeX = c.x;
            p.homeY = c.y;
            p.r = c.r;
            p.glowIntensity = c.glow;
          }
        } else {
          p.glowIntensity = node.glowIntensity;
        }
        p.label = node.label;
        p.sublabel = node.sublabel;
        p.color = node.color;
        p.isActive = node.isActive;
        p.parentId = node.parentId;
        p.projectId = node.projectId;
      }
    }
  }, [nodes]);

  // ── Mouse interaction ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let closest: PhysicsNode | null = null;
      let closestDist = Infinity;

      for (const p of physicsRef.current.values()) {
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.r + 20 && dist < closestDist) {
          closestDist = dist;
          closest = p;
        }
      }

      const prevId = hoveredIdRef.current;
      hoveredIdRef.current = closest?.id ?? null;

      if (closest !== null) {
        onHoverRef.current(closest, e.clientX, e.clientY);
      } else if (prevId !== null) {
        onHoverRef.current(null, 0, 0);
      }
    };

    const handleMouseLeave = () => {
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        onHoverRef.current(null, 0, 0);
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;

    function tick(ts: number) {
      const rawDelta = lastFrameTsRef.current === 0 ? 16 : ts - lastFrameTsRef.current;
      const delta = Math.min(rawDelta, 50);
      lastFrameTsRef.current = ts;
      const dt = delta / 16.667; // normalized to 60fps

      const ctx = canvas!.getContext("2d");
      if (!ctx) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const w = canvas!.width;
      const h = canvas!.height;

      // ── Background ──
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.5);
      bg.addColorStop(0, "#090912");
      bg.addColorStop(1, "#000005");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── Stars ──
      for (const s of starsRef.current) {
        s.nx = (s.nx + s.vx * delta + 1) % 1;
        s.ny = (s.ny + s.vy * delta + 1) % 1;
        ctx.beginPath();
        ctx.arc(s.nx * w, s.ny * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,255,${s.opacity})`;
        ctx.fill();
      }

      // ── Physics ──
      const physNodes = Array.from(physicsRef.current.values());

      for (const p of physNodes) {
        // Spring toward home
        p.vx += (p.homeX - p.x) * 0.015 * dt;
        p.vy += (p.homeY - p.y) * 0.015 * dt;
        // Damping
        const damp = Math.pow(0.93, dt);
        p.vx *= damp;
        p.vy *= damp;
        // Speed clamp
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 1.8) {
          p.vx = (p.vx / spd) * 1.8;
          p.vy = (p.vy / spd) * 1.8;
        }
        // Edge repulsion
        const em = 40;
        if (p.x < em) p.vx += (em - p.x) * 0.05 * dt;
        if (p.x > w - em) p.vx -= (p.x - (w - em)) * 0.05 * dt;
        if (p.y < em) p.vy += (em - p.y) * 0.05 * dt;
        if (p.y > h - em) p.vy -= (p.y - (h - em)) * 0.05 * dt;
      }

      // Node-node repulsion
      for (let i = 0; i < physNodes.length; i++) {
        for (let j = i + 1; j < physNodes.length; j++) {
          const a = physNodes[i];
          const b = physNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 60 && d > 0.1) {
            const f = ((60 - d) / 60) * 0.08 * dt;
            a.vx -= (dx / d) * f;
            a.vy -= (dy / d) * f;
            b.vx += (dx / d) * f;
            b.vy += (dy / d) * f;
          }
        }
      }

      // Integrate + smooth radius
      for (const p of physNodes) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const targetR = hoveredIdRef.current === p.id ? p.r * 1.4 : p.r;
        p.currentR += (targetR - p.currentR) * 0.15 * dt;
      }

      // ── Arc generation ──
      if (ts - lastArcTsRef.current > 800 + Math.random() * 1200) {
        lastArcTsRef.current = ts;
        const eligible = physNodes.filter((p) => p.isActive && !!p.projectId);
        if (eligible.length >= 2 && arcsRef.current.length < 4) {
          const a = eligible[Math.floor(Math.random() * eligible.length)];
          if (a.projectId) {
            const peers = eligible.filter(
              (p) =>
                p !== a &&
                p.projectId === a.projectId &&
                (p.parentId === a.parentId || p.parentId === a.id || a.parentId === p.id)
            );
            if (peers.length > 0) {
              const b = peers[Math.floor(Math.random() * peers.length)];
              const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
              const segs: { x: number; y: number }[] = [];
              for (let i = 0; i <= 5; i++) {
                const t = i / 5;
                const bx = a.x + (b.x - a.x) * t;
                const by = a.y + (b.y - a.y) * t;
                const off = i > 0 && i < 5 ? (Math.random() - 0.5) * dist * 0.3 : 0;
                const nx = -(b.y - a.y) / Math.max(dist, 1);
                const ny = (b.x - a.x) / Math.max(dist, 1);
                segs.push({ x: bx + nx * off, y: by + ny * off });
              }
              arcsRef.current.push({ segments: segs, ttl: 350, maxTtl: 350 });
            }
          }
        }
      }

      // ── Connection lines ──
      ctx.save();
      for (const p of physNodes) {
        if (p.parentId) {
          const parent = physicsRef.current.get(p.parentId);
          if (parent) {
            ctx.beginPath();
            ctx.moveTo(parent.x, parent.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = "rgba(100,140,255,0.08)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // ── Arcs ──
      const aliveArcs: Arc[] = [];
      for (const arc of arcsRef.current) {
        arc.ttl -= delta;
        if (arc.ttl > 0) {
          aliveArcs.push(arc);
          const alpha = Math.min(1, arc.ttl / (arc.maxTtl * 0.3)) * 0.85;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(arc.segments[0].x, arc.segments[0].y);
          for (let i = 1; i < arc.segments.length; i++) {
            ctx.lineTo(arc.segments[i].x, arc.segments[i].y);
          }
          ctx.strokeStyle = `rgba(140,240,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(140,240,255,${alpha * 0.7})`;
          ctx.stroke();
          ctx.restore();
        }
      }
      arcsRef.current = aliveArcs;

      // ── Nodes ──
      for (const p of physNodes) {
        const r = p.currentR;
        const isHov = hoveredIdRef.current === p.id;
        const [cr, cg, cb] = hexToRgb(p.color);

        // Glow layers
        const glows = [
          { m: 3, o: 0.05 + p.glowIntensity * 0.03 },
          { m: 2, o: 0.12 + p.glowIntensity * 0.06 },
          { m: 1.5, o: 0.25 + p.glowIntensity * 0.15 },
        ];
        for (const g of glows) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * g.m, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${g.o})`;
          ctx.shadowBlur = r * 4 * p.glowIntensity;
          ctx.shadowColor = `rgba(${cr},${cg},${cb},0.5)`;
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Hover ring (expanding pulse)
        if (isHov) {
          const rp = (ts % 1200) / 1200;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + rp * 28, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(1 - rp) * 0.4})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Labels
        const la = isHov ? 0.9 : 0.35;
        ctx.fillStyle = `rgba(200,220,255,${la})`;
        ctx.font = `${isHov ? "bold " : ""}11px 'Courier New',monospace`;
        ctx.textAlign = "center";
        ctx.fillText(p.label, p.x, p.y + r + 14);
        if (p.sublabel) {
          ctx.fillStyle = `rgba(140,160,200,${la * 0.7})`;
          ctx.font = "9px 'Courier New',monospace";
          ctx.fillText(p.sublabel, p.x, p.y + r + 25);
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
