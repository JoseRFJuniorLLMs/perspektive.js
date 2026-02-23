/**
 * Export System Types for perspektive.js
 *
 * Shared interfaces used by all export modules (PNG, SVG, JSON, GraphML, Clipboard).
 * These types define the contract between the visualization engine and the export layer.
 */

/**
 * Configuration options for image/file exports.
 * All fields are optional and fall back to sensible defaults.
 */
export interface ExportOptions {
  /** Output filename (without extension). Defaults to `perspektive-{timestamp}`. */
  filename?: string;
  /** Width in pixels for raster exports (PNG/JPEG). Defaults to current canvas width. */
  width?: number;
  /** Height in pixels for raster exports (PNG/JPEG). Defaults to current canvas height. */
  height?: number;
  /** Background color as CSS string. Defaults to '#000000'. */
  background?: string;
  /** Device pixel ratio multiplier for high-DPI export (2 = retina, 4 = 4K). Defaults to 1. */
  scale?: number;
  /** Whether to include HUD overlay text in the export. Defaults to false. */
  includeHUD?: boolean;
  /** JPEG quality from 0 to 1. Only used by exportToJPEG. Defaults to 0.92. */
  quality?: number;
}

/**
 * Structured graph data ready for serialization (JSON, GraphML, CSV).
 * Mirrors the internal NodeData/EdgeData but with all fields explicit
 * and an optional metadata block for provenance tracking.
 */
export interface GraphExportData {
  /** All nodes in the graph with their positions and attributes. */
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    energy: number;
    node_type: string;
    valence?: number;
    arousal?: number;
    embedding?: number[];
    /** Allow arbitrary extra properties from extensions. */
    [key: string]: any;
  }>;
  /** All edges in the graph with source, target, and weight. */
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    /** Allow arbitrary extra properties from extensions. */
    [key: string]: any;
  }>;
  /** Optional metadata block for provenance and context. */
  metadata?: {
    /** The manifold/projection used (e.g., 'poincare', 'riemann'). */
    manifold: string;
    /** NietzscheDB collection name. */
    collection: string;
    /** ISO-8601 timestamp of when the export was created. */
    exportedAt: string;
    /** Version of perspektive.js that produced this export. */
    perspektiveVersion: string;
  };
}

/**
 * Color palette for node types, matching the WebGL cyberpunk aesthetic.
 * Used by both SVG export and the ExportPanel legend.
 */
export const NODE_TYPE_COLORS: Record<string, string> = {
  Semantic: '#00ff66',
  Episodic: '#00f0ff',
  Concept: '#f59e0b',
  DreamSnapshot: '#8b5cf6',
  Pruned: '#1e293b',
};

/** Color used for Ubermensch nodes (energy > 0.8). */
export const UBERMENSCH_COLOR = '#ff00ff';

/** The current library version, injected into export metadata. */
export const PERSPEKTIVE_VERSION = '0.1.0';
