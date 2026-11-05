/** x, y = world pixel at the screen's top-left corner. zoom = CSS pixels per world pixel. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 2;
  static readonly MIN_ZOOM = 0.08;
  static readonly MAX_ZOOM = 6;

  toWorld(sx: number, sy: number): [number, number] {
    return [this.x + sx / this.zoom, this.y + sy / this.zoom];
  }

  /** Zoom by `factor`, keeping the world point under the cursor fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.min(Camera.MAX_ZOOM, Math.max(Camera.MIN_ZOOM, this.zoom * factor));
    this.x = wx - sx / this.zoom;
    this.y = wy - sy / this.zoom;
  }

  centerOn(wx: number, wy: number, viewW: number, viewH: number) {
    this.x = wx - viewW / 2 / this.zoom;
    this.y = wy - viewH / 2 / this.zoom;
  }
}
