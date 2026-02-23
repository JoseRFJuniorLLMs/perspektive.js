/**
 * ExportToolbar.tsx — HUD export buttons for perspektive.js
 *
 * Renders inside the HTML overlay layer (not inside R3F Canvas).
 * Uses refs passed from PerspektiveEngine to access WebGL renderer.
 */

import { useCallback, useState } from "react";
import type * as THREE from "three";
import { exportToJSON } from "../../export/json";
import { exportToGraphML } from "../../export/graphml";
import type { NodeData, EdgeData } from "../PerspektiveEngine";

// ==========================================
// TYPES
// ==========================================

export interface ExportToolbarProps {
  /** Ref to the Three.js WebGLRenderer (obtained via R3F useThree gl) */
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  /** Graph data to export */
  nodes: NodeData[];
  edges: EdgeData[];
}

const btnBase: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  color: "#94a3b8",
  fontFamily: "monospace",
  fontSize: 10,
  padding: "4px 10px",
  borderRadius: 3,
  cursor: "pointer",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  border: "1px solid #00f0ff",
  color: "#00f0ff",
  boxShadow: "0 0 6px rgba(0,240,255,0.2)",
};

// ==========================================
// Component
// ==========================================

export const ExportToolbar = ({
  rendererRef,
  nodes,
  edges,
}: ExportToolbarProps) => {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportPNG = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || busy) return;
    setBusy(true);

    const canvas = renderer.domElement;
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.drawImage(canvas, 0, 0);

    offscreen.toBlob((blob) => {
      if (!blob) {
        setBusy(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `perspektive-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setBusy(false);
    }, "image/png");
  }, [rendererRef, busy]);

  const exportJSON = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const graphNodes = nodes.map((n) => ({
      id: n.id,
      node_type: n.node_type,
      energy: n.energy,
      embedding: n.embedding,
      valence: n.valence,
      arousal: n.arousal,
    }));
    const graphEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    exportToJSON(graphNodes as any, graphEdges as any, {
      filename: `perspektive-${Date.now()}`,
    });
    setBusy(false);
  }, [nodes, edges, busy]);

  const exportGML = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const graphNodes = nodes.map((n) => ({
      id: n.id,
      node_type: n.node_type,
      energy: n.energy,
      embedding: n.embedding,
    }));
    const graphEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    exportToGraphML(graphNodes as any, graphEdges as any, {
      filename: `perspektive-${Date.now()}`,
    });
    setBusy(false);
  }, [nodes, edges, busy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          ...btnBase,
          border: `1px solid ${expanded ? "#00f0ff" : "#334155"}`,
          color: expanded ? "#00f0ff" : "#94a3b8",
        }}
      >
        ⬇ EXPORT {expanded ? "▲" : "▼"}
      </button>

      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "rgba(2,6,23,0.9)",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: 8,
          }}
        >
          <button
            onClick={exportPNG}
            style={busy ? btnBase : btnActive}
            disabled={busy}
            title="Capture WebGL canvas as PNG"
          >
            📷 PNG
          </button>
          <button
            onClick={exportJSON}
            style={busy ? btnBase : btnActive}
            disabled={busy}
            title="Export graph data as JSON"
          >
            📄 JSON
          </button>
          <button
            onClick={exportGML}
            style={busy ? btnBase : btnActive}
            disabled={busy}
            title="Export graph as GraphML"
          >
            🔗 GraphML
          </button>
        </div>
      )}
    </div>
  );
};
