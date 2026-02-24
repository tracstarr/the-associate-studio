import { useState, useCallback, useEffect, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTeams } from "@/hooks/useClaudeData";
import { useNeuralFieldData, type FieldNode } from "./useNeuralFieldData";
import { NeuralFieldCanvas } from "./NeuralFieldCanvas";

// ── HUD counters ──────────────────────────────────────────────────────────────

function HUD() {
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const { data: teams } = useTeams();

  const sessionCount = Object.values(knownSessions).filter(Boolean).length;
  const teamCount = (teams ?? []).length;
  const agentCount = Object.values(activeSubagents).reduce((s, a) => s + a.length, 0);

  return (
    <div
      className="absolute top-6 right-8 flex flex-col items-end gap-2 pointer-events-none select-none"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {[
        { label: "sessions", value: sessionCount },
        { label: "teams", value: teamCount },
        { label: "agents", value: agentCount },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-2">
          <span
            style={{
              fontSize: 22,
              color: value > 0 ? "rgba(212,168,83,0.9)" : "rgba(212,168,83,0.25)",
              textShadow: value > 0 ? "0 0 12px rgba(212,168,83,0.6)" : "none",
              transition: "color 0.3s, text-shadow 0.3s",
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 10, color: "rgba(140,160,200,0.4)", letterSpacing: "0.12em" }}>
            {label.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Hover readout ─────────────────────────────────────────────────────────────

function HoverReadout({
  node,
  screenX,
  screenY,
}: {
  node: FieldNode;
  screenX: number;
  screenY: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: screenX + 20, y: screenY - 10 });

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = screenX + 20;
    let y = screenY - 10;
    if (x + rect.width > vw - 8) x = screenX - rect.width - 12;
    if (y + rect.height > vh - 8) y = screenY - rect.height - 4;
    setPos({ x, y });
  }, [screenX, screenY]);

  const typeColors: Record<FieldNode["type"], string> = {
    project: "rgba(212,168,83,0.7)",
    session: "rgba(74,202,98,0.7)",
    agent: "rgba(188,140,255,0.7)",
  };

  const statusDot = node.isActive
    ? { color: "#98c379", label: "active" }
    : { color: "#5c6370", label: "idle" };

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-[60] px-3 py-2 rounded-xl"
      style={{
        left: pos.x,
        top: pos.y,
        background: "rgba(20,20,25,0.85)",
        border: "1px solid rgba(212,168,83,0.15)",
        backdropFilter: "blur(8px)",
        fontFamily: "'Courier New', monospace",
        minWidth: 140,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontSize: 13, color: "rgba(220,230,255,0.95)", fontWeight: 600 }}>
        {node.label}
      </div>
      {node.sublabel && (
        <div style={{ fontSize: 10, color: "rgba(140,160,200,0.6)", marginTop: 1 }}>
          {node.sublabel}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <span
          style={{
            fontSize: 9,
            color: typeColors[node.type],
            border: `1px solid ${typeColors[node.type]}`,
            padding: "0 4px",
            borderRadius: 2,
            letterSpacing: "0.1em",
          }}
        >
          {node.type.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: "rgba(140,160,200,0.5)" }}>
          <span style={{ color: statusDot.color, marginRight: 4 }}>●</span>
          {statusDot.label}
        </span>
      </div>
    </div>
  );
}

// ── Overlay shell ─────────────────────────────────────────────────────────────

export function NeuralFieldOverlay() {
  const neuralFieldOpen = useUIStore((s) => s.neuralFieldOpen);
  const toggleNeuralField = useUIStore((s) => s.toggleNeuralField);
  const nodes = useNeuralFieldData();

  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<FieldNode | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // Entrance animation
  useEffect(() => {
    if (neuralFieldOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [neuralFieldOpen]);

  const handleHoverNode = useCallback((node: FieldNode | null, sx: number, sy: number) => {
    setHoveredNode(node);
    if (node) setHoverPos({ x: sx, y: sy });
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.97)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
      onClick={toggleNeuralField}
    >
      {/* Canvas (fills overlay, pointer events pass through for backdrop click) */}
      <div
        className="absolute inset-0"
        onClick={(e) => e.stopPropagation()}
      >
        <NeuralFieldCanvas nodes={nodes} onHoverNode={handleHoverNode} />
      </div>

      {/* HUD — top right */}
      <HUD />

      {/* Dismiss hint — bottom center */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none select-none"
        style={{
          fontSize: 10,
          color: "rgba(140,160,200,0.25)",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "0.12em",
        }}
      >
        NEURAL FIELD · ESC TO CLOSE
      </div>

      {/* Hover readout */}
      {hoveredNode && (
        <HoverReadout
          node={hoveredNode}
          screenX={hoverPos.x}
          screenY={hoverPos.y}
        />
      )}
    </div>
  );
}
