/**
 * MobiusZoom.ts — Hyperbolic Möbius zoom for the Poincaré disk
 *
 * Instead of scaling the camera (Euclidean zoom), this applies
 * a true Möbius automorphism of the unit disk:
 *
 *   T_a(z) = (z - a) / (1 - ā·z)
 *
 * This translates the "center of gravity" to point `a` without distorting
 * the hyperbolic geometry — moving the viewpoint inside the manifold itself.
 *
 * Usage:
 *   const zoom = new MobiusZoom();
 *   // On wheel event:
 *   const newNodes = zoom.applyScroll(nodes, mouseWorldPos, deltaY);
 */

// ==========================================
// TYPES
// ==========================================

export interface Point2D {
  x: number;
  y: number;
}

export interface MobiusZoomOptions {
  /** Translation speed multiplier. Default: 0.001 */
  speed?: number;
  /** Maximum |a| (prevents going to disk boundary). Default: 0.97 */
  maxRadius?: number;
}

// ==========================================
// COMPLEX ARITHMETIC HELPERS
// ==========================================

/** Complex multiply: (a + bi)(c + di) */
function cmul(ar: number, ai: number, br: number, bi: number): [number, number] {
  return [ar * br - ai * bi, ar * bi + ai * br];
}

/** Complex divide: (a + bi) / (c + di) */
function cdiv(ar: number, ai: number, br: number, bi: number): [number, number] {
  const denom = br * br + bi * bi;
  return [(ar * br + ai * bi) / denom, (ai * br - ar * bi) / denom];
}

/** Clamp a complex number to |z| < maxR */
function clampDisk(x: number, y: number, maxR: number): [number, number] {
  const r = Math.sqrt(x * x + y * y);
  if (r > maxR) {
    const scale = maxR / r;
    return [x * scale, y * scale];
  }
  return [x, y];
}

// ==========================================
// MAIN CLASS
// ==========================================

export class MobiusZoom {
  private speed: number;
  private maxRadius: number;

  /** Current hyperbolic "camera center" in Poincaré coordinates */
  public center: Point2D = { x: 0, y: 0 };

  constructor({ speed = 0.001, maxRadius = 0.97 }: MobiusZoomOptions = {}) {
    this.speed = speed;
    this.maxRadius = maxRadius;
  }

  /**
   * Apply a Möbius translation: move `center` toward `target` by `amount`.
   *
   * Instead of moving all node positions, we update `this.center` and
   * the caller is responsible for projecting all nodes through T_center.
   *
   * @param target  The world-space point the user scrolled toward
   * @param delta   Scroll delta (positive = zoom in = move toward target)
   */
  translate(target: Point2D, delta: number): void {
    // Direction vector from current center toward target
    const dx = target.x - this.center.x;
    const dy = target.y - this.center.y;

    // Move center toward target by speed * delta
    const step = this.speed * delta;
    const newCx = this.center.x + dx * step;
    const newCy = this.center.y + dy * step;

    // Clamp to Poincaré disk
    const [cx, cy] = clampDisk(newCx, newCy, this.maxRadius);
    this.center = { x: cx, y: cy };
  }

  /**
   * Apply the Möbius transform T_{-center}(z) to a single point.
   * This "re-centers" the disk at the current `center`.
   *
   * T_a(z) = (z - a) / (1 - ā·z)  where a = -center (inverse translation)
   */
  project(point: Point2D): Point2D {
    const ax = -this.center.x;
    const ay = -this.center.y;
    const zx = point.x;
    const zy = point.y;

    // Numerator: z - a
    const numR = zx - ax;
    const numI = zy - ay;

    // Denominator: 1 - ā·z  (ā = conjugate of a = (ax, -ay))
    const [conj_a_times_z_R, conj_a_times_z_I] = cmul(ax, -ay, zx, zy);
    const denR = 1 - conj_a_times_z_R;
    const denI = -conj_a_times_z_I;

    const [rx, ry] = cdiv(numR, numI, denR, denI);
    return { x: rx, y: ry };
  }

  /**
   * Project all nodes through the current Möbius transform.
   * Returns new x,y coordinates for each node (z unchanged).
   */
  projectAll<T extends Point2D>(nodes: T[]): T[] {
    return nodes.map(n => {
      const projected = this.project(n);
      return { ...n, x: projected.x, y: projected.y };
    });
  }

  /** Reset center to origin (reset zoom/pan) */
  reset(): void {
    this.center = { x: 0, y: 0 };
  }
}
