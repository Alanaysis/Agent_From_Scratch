import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ROI, Point } from '../../state/types';

export class WaferRenderer {
  private app: Application | null = null;
  private container: HTMLElement;
  private worldContainer: Container | null = null;
  private waferContainer: Container | null = null;
  private gridContainer: Container | null = null;
  private roiContainer: Container | null = null;
  private defectContainer: Container | null = null;
  private alignmentContainer: Container | null = null;
  private coordinateContainer: Container | null = null;
  private isDragging = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init() {
    this.app = new Application();
    await this.app.init({
      background: 0x080c12,
      resizeTo: this.container,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.container.appendChild(this.app.canvas as HTMLCanvasElement);

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.coordinateContainer = new Container();
    this.waferContainer = new Container();
    this.gridContainer = new Container();
    this.roiContainer = new Container();
    this.defectContainer = new Container();
    this.alignmentContainer = new Container();

    this.worldContainer.addChild(this.coordinateContainer);
    this.worldContainer.addChild(this.waferContainer);
    this.worldContainer.addChild(this.gridContainer);
    this.worldContainer.addChild(this.roiContainer);
    this.worldContainer.addChild(this.defectContainer);
    this.worldContainer.addChild(this.alignmentContainer);

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.worldContainer.x = w / 2;
    this.worldContainer.y = h / 2;

    this.drawCoordinateSystem();
    this.drawWaferOutline();
    this.drawDieGrid();
    this.drawDefects();
    this.setupInteraction();
  }

  private drawCoordinateSystem() {
    if (!this.coordinateContainer) return;
    const g = new Graphics();
    const radius = 280;

    for (let i = -300; i <= 300; i += 50) {
      const x = (i / 300) * radius;

      g.moveTo(x, -radius - 10);
      g.lineTo(x, -radius);
      g.moveTo(x, radius);
      g.lineTo(x, radius + 10);
      g.moveTo(-radius - 10, x);
      g.lineTo(-radius, x);
      g.moveTo(radius, x);
      g.lineTo(radius + 10, x);
    }

    g.stroke({ width: 0.5, color: 0x1e293b });

    for (let i = -300; i <= 300; i += 100) {
      const x = (i / 300) * radius;

      const xLabel = new Text({
        text: `${i}`,
        style: new TextStyle({
          fontSize: 8,
          fill: 0x475569,
          fontFamily: 'JetBrains Mono, monospace',
        }),
      });
      xLabel.anchor.set(0.5, 0);
      xLabel.x = x;
      xLabel.y = radius + 12;
      this.coordinateContainer.addChild(xLabel);

      const yLabel = new Text({
        text: `${i}`,
        style: new TextStyle({
          fontSize: 8,
          fill: 0x475569,
          fontFamily: 'JetBrains Mono, monospace',
        }),
      });
      yLabel.anchor.set(1, 0.5);
      yLabel.x = -radius - 12;
      yLabel.y = x;
      this.coordinateContainer.addChild(yLabel);
    }

    this.coordinateContainer.addChild(g);
  }

  private drawWaferOutline() {
    if (!this.waferContainer) return;
    const g = new Graphics();
    const radius = 280;

    g.circle(0, 0, radius);
    g.stroke({ width: 1.5, color: 0x334155 });

    const notch = new Graphics();
    notch.moveTo(-8, radius - 2);
    notch.lineTo(0, radius + 6);
    notch.lineTo(8, radius - 2);
    notch.stroke({ width: 1, color: 0x334155 });

    this.waferContainer.addChild(g);
    this.waferContainer.addChild(notch);

    for (let r = 50; r < radius; r += 50) {
      const ring = new Graphics();
      ring.circle(0, 0, r);
      ring.stroke({ width: 0.3, color: 0x1e293b });
      this.waferContainer.addChild(ring);
    }
  }

  private drawDieGrid() {
    if (!this.gridContainer) return;
    const dieSize = 14;
    const radius = 278;

    const g = new Graphics();

    for (let x = -radius; x < radius; x += dieSize) {
      for (let y = -radius; y < radius; y += dieSize) {
        const cx = x + dieSize / 2;
        const cy = y + dieSize / 2;
        if (Math.sqrt(cx * cx + cy * cy) + dieSize / 2 > radius) continue;

        g.rect(x + 0.5, y + 0.5, dieSize - 1, dieSize - 1);
      }
    }

    g.fill({ color: 0x111827 });
    g.stroke({ width: 0.3, color: 0x1e293b });

    this.gridContainer.addChild(g);
  }

  private drawDefects() {
    if (!this.defectContainer) return;
    this.defectContainer.removeChildren();

    const defects = [
      { x: -80, y: -60, intensity: 0.9 },
      { x: 40, y: -100, intensity: 0.6 },
      { x: -30, y: 30, intensity: 0.8 },
      { x: 100, y: 50, intensity: 0.4 },
      { x: -120, y: 80, intensity: 0.7 },
      { x: 60, y: 120, intensity: 0.5 },
      { x: 20, y: -30, intensity: 0.85 },
      { x: -60, y: -120, intensity: 0.3 },
    ];

    for (const d of defects) {
      const color = d.intensity > 0.7 ? 0xef4444 : d.intensity > 0.4 ? 0xf59e0b : 0x22c55e;
      const size = 3 + d.intensity * 4;

      const glow = new Graphics();
      glow.circle(d.x, d.y, size * 2);
      glow.fill({ color, alpha: 0.15 });
      this.defectContainer.addChild(glow);

      const dot = new Graphics();
      dot.circle(d.x, d.y, size);
      dot.fill({ color, alpha: 0.7 });
      this.defectContainer.addChild(dot);
    }
  }

  updateROI(rois: ROI[]) {
    if (!this.roiContainer) return;
    this.roiContainer.removeChildren();

    const scale = 280 / 300;

    for (const roi of rois) {
      const x = (roi.bounds.x - 300) * scale;
      const y = (roi.bounds.y - 300) * scale;
      const w = roi.bounds.width * scale;
      const h = roi.bounds.height * scale;
      const color = parseInt(roi.color.replace('#', ''), 16);

      const bg = new Graphics();
      bg.rect(x, y, w, h);
      bg.fill({ color, alpha: 0.12 });
      this.roiContainer.addChild(bg);

      const border = new Graphics();
      border.rect(x, y, w, h);
      border.stroke({ width: 1, color, alpha: 0.6 });
      this.roiContainer.addChild(border);

      const label = new Text({
        text: roi.label,
        style: new TextStyle({
          fontSize: 9,
          fill: color,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: '600',
        }),
      });
      label.x = x + 4;
      label.y = y + 2;
      this.roiContainer.addChild(label);
    }
  }

  updateAlignment(markers: Point[]) {
    if (!this.alignmentContainer) return;
    this.alignmentContainer.removeChildren();

    const scale = 280 / 300;

    for (const marker of markers) {
      const x = (marker.x - 300) * scale;
      const y = (marker.y - 300) * scale;
      const size = 12;

      const crosshair = new Graphics();
      crosshair.moveTo(x - size, y);
      crosshair.lineTo(x + size, y);
      crosshair.moveTo(x, y - size);
      crosshair.lineTo(x, y + size);
      crosshair.stroke({ width: 1, color: 0x06b6d4, alpha: 0.8 });
      this.alignmentContainer.addChild(crosshair);

      const circle = new Graphics();
      circle.circle(x, y, 4);
      circle.stroke({ width: 0.8, color: 0x06b6d4, alpha: 0.6 });
      this.alignmentContainer.addChild(circle);
    }
  }

  setZoom(zoom: number) {
    if (!this.worldContainer) return;
    this.worldContainer.scale.set(zoom);
  }

  private setupInteraction() {
    if (!this.app || !this.worldContainer) return;
    const canvas = this.app.canvas as HTMLCanvasElement;

    canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.worldContainer) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.worldContainer.x += dx;
      this.worldContainer.y += dy;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('pointerleave', () => {
      this.isDragging = false;
      canvas.style.cursor = 'default';
    });
  }

  destroy() {
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }
}
