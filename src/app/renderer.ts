// ─────────────────────────────────────────────────────────
//  SVG Renderer
//
//  Renders the entire circuit (components, pins, wires,
//  grid, selection highlights) as SVG elements inside a
//  container div. Updates every animation frame.
// ─────────────────────────────────────────────────────────

import type { CircuitComponent, EditorState, Pin, Point, Wire } from './types';
import { CircuitStore } from './simulation';
import { getPinPosition } from './components';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── Colour Palette ──────────────────────────────────

const COLORS = {
  gridDot:        '#2a2d35',
  gridDotMajor:   '#3a3d45',
  componentBody:  '#1e2028',
  componentBodySelected: '#2a2d45',
  componentStroke:'#4a4e5a',
  componentStrokeSelected: '#6c8cff',
  pinOff:         '#555',
  pinOn:          '#4cff72',
  wireOff:        '#555a66',
  wireOn:         '#4cff72',
  wireOnGlow:     '#4cff7244',
  wireDrawing:    '#6c8cff',
  labelText:      '#c8cad0',
  switchOff:      '#8b3a3a',
  switchOn:       '#3a8b4a',
  bulbOff:        '#444',
  bulbOn:         '#ffe066',
  bulbGlow:       '#ffe06644',
  background:     '#14161c',
};

// Unicode / symbol gate labels
const GATE_SYMBOLS: Record<string, string> = {
  AND: '&',
  OR: '≥1',
  XOR: '=1',
  NOT: '1',
  NAND: '&',
  NOR: '≥1',
};

export class Renderer {
  private svg!: SVGSVGElement;
  private gridLayer!: SVGGElement;
  private wireLayer!: SVGGElement;
  private componentLayer!: SVGGElement;
  private overlayLayer!: SVGGElement;

  private store: CircuitStore;
  private editor: EditorState;
  private container: HTMLDivElement;
  private _gridDrawn = false;

  constructor(
    container: HTMLDivElement,
    store: CircuitStore,
    editor: EditorState,
  ) {
    this.container = container;
    this.store = store;
    this.editor = editor;
    this.initSvg();
  }

  // ─── Initialisation ──────────────────────────────────

  private initSvg(): void {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('width', `${this.store.canvasWidth}`);
    this.svg.setAttribute('height', `${this.store.canvasHeight}`);
    this.svg.setAttribute('viewBox', `0 0 ${this.store.canvasWidth} ${this.store.canvasHeight}`);
    this.svg.style.background = COLORS.background;
    this.svg.id = 'circuit-svg';

    // Create layers in drawing order
    this.gridLayer = this.createGroup('grid-layer');
    this.wireLayer = this.createGroup('wire-layer');
    this.componentLayer = this.createGroup('component-layer');
    this.overlayLayer = this.createGroup('overlay-layer');

    this.svg.appendChild(this.gridLayer);
    this.svg.appendChild(this.wireLayer);
    this.svg.appendChild(this.componentLayer);
    this.svg.appendChild(this.overlayLayer);

    // Defs for filters (glow effects)
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Wire glow filter
    const wireGlow = this.createGlowFilter('wire-glow', '#4cff72', 4);
    defs.appendChild(wireGlow);

    // Bulb glow filter
    const bulbGlow = this.createGlowFilter('bulb-glow', '#ffe066', 12);
    defs.appendChild(bulbGlow);

    this.svg.appendChild(defs);
    this.container.appendChild(this.svg);
  }

  private createGroup(id: string): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g');
    g.id = id;
    return g;
  }

  private createGlowFilter(id: string, color: string, radius: number): SVGFilterElement {
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = id;
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', `${radius}`);
    blur.setAttribute('result', 'blur');

    const flood = document.createElementNS(SVG_NS, 'feFlood');
    flood.setAttribute('flood-color', color);
    flood.setAttribute('flood-opacity', '0.6');
    flood.setAttribute('result', 'color');

    const composite = document.createElementNS(SVG_NS, 'feComposite');
    composite.setAttribute('in', 'color');
    composite.setAttribute('in2', 'blur');
    composite.setAttribute('operator', 'in');
    composite.setAttribute('result', 'glow');

    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const m1 = document.createElementNS(SVG_NS, 'feMergeNode');
    m1.setAttribute('in', 'glow');
    const m2 = document.createElementNS(SVG_NS, 'feMergeNode');
    m2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(m1);
    merge.appendChild(m2);

    filter.appendChild(blur);
    filter.appendChild(flood);
    filter.appendChild(composite);
    filter.appendChild(merge);
    return filter;
  }

  getSvgElement(): SVGSVGElement {
    return this.svg;
  }

  // ─── Full repaint ────────────────────────────────────

  render(): void {
    if (!this._gridDrawn) {
      this.drawGrid();
      this._gridDrawn = true;
    }
    this.drawWires();
    this.drawComponents();
    this.drawOverlay();
  }

  // ─── Grid ────────────────────────────────────────────

  private drawGrid(): void {
    this.gridLayer.innerHTML = '';
    const gs = this.store.gridSize;
    const w = this.store.canvasWidth;
    const h = this.store.canvasHeight;

    // Use a pattern for performance
    const patternId = 'grid-pattern';
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    // Remove old pattern if exists
    const old = defs.querySelector(`#${patternId}`);
    if (old) old.remove();

    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.id = patternId;
    pattern.setAttribute('width', `${gs}`);
    pattern.setAttribute('height', `${gs}`);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', '0.5');
    dot.setAttribute('cy', '0.5');
    dot.setAttribute('r', '0.8');
    dot.setAttribute('fill', COLORS.gridDot);
    pattern.appendChild(dot);
    defs.appendChild(pattern);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', `${w}`);
    rect.setAttribute('height', `${h}`);
    rect.setAttribute('fill', `url(#${patternId})`);
    this.gridLayer.appendChild(rect);

    // Major grid lines every 5 cells
    for (let x = 0; x <= w; x += gs * 5) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', `${x}`);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', `${x}`);
      line.setAttribute('y2', `${h}`);
      line.setAttribute('stroke', COLORS.gridDotMajor);
      line.setAttribute('stroke-width', '0.3');
      line.setAttribute('stroke-dasharray', '2 8');
      this.gridLayer.appendChild(line);
    }
    for (let y = 0; y <= h; y += gs * 5) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', `${y}`);
      line.setAttribute('x2', `${w}`);
      line.setAttribute('y2', `${y}`);
      line.setAttribute('stroke', COLORS.gridDotMajor);
      line.setAttribute('stroke-width', '0.3');
      line.setAttribute('stroke-dasharray', '2 8');
      this.gridLayer.appendChild(line);
    }
  }

  // ─── Wires ──────────────────────────────────────────

  private drawWires(): void {
    this.wireLayer.innerHTML = '';

    for (const wire of this.store.state.wires.values()) {
      this.drawWire(wire);
    }
  }

  private drawWire(wire: Wire): void {
    if (wire.path.length < 2) return;

    const points = wire.path.map((p) => `${p.x},${p.y}`).join(' ');
    const color = wire.value ? COLORS.wireOn : COLORS.wireOff;

    // Glow layer (behind) when active
    if (wire.value) {
      const glow = document.createElementNS(SVG_NS, 'polyline');
      glow.setAttribute('points', points);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', COLORS.wireOnGlow);
      glow.setAttribute('stroke-width', '8');
      glow.setAttribute('stroke-linecap', 'round');
      glow.setAttribute('stroke-linejoin', 'round');
      glow.setAttribute('filter', 'url(#wire-glow)');
      this.wireLayer.appendChild(glow);
    }

    // Main wire
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '2.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.dataset.wireId = wire.id;
    this.wireLayer.appendChild(polyline);

    // Junction dots at corners
    for (let i = 1; i < wire.path.length - 1; i++) {
      const p = wire.path[i];
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', `${p.x}`);
      dot.setAttribute('cy', `${p.y}`);
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', color);
      this.wireLayer.appendChild(dot);
    }
  }

  // ─── Components ──────────────────────────────────────

  private drawComponents(): void {
    this.componentLayer.innerHTML = '';

    for (const comp of this.store.state.components.values()) {
      this.drawComponent(comp);
    }
  }

  private drawComponent(comp: CircuitComponent): void {
    const gs = this.store.gridSize;
    const x = comp.position.x * gs;
    const y = comp.position.y * gs;
    const w = comp.size.width * gs;
    const h = comp.size.height * gs;
    const selected = comp.id === this.editor.selectedComponentId;

    const g = document.createElementNS(SVG_NS, 'g');
    g.dataset.componentId = comp.id;
    g.setAttribute('class', 'component');

    // ── Component body ───────────────────────────────
    if (comp.type === 'SWITCH') {
      this.drawSwitch(g, comp, x, y, w, h, selected);
    } else if (comp.type === 'LIGHTBULB') {
      this.drawLightbulb(g, comp, x, y, w, h, selected);
    } else if (comp.type === 'CLOCK') {
      this.drawClock(g, comp, x, y, w, h, selected);
    } else {
      this.drawGate(g, comp, x, y, w, h, selected);
    }

    // ── Pins ─────────────────────────────────────────
    for (const pinId of [...comp.inputPinIds, ...comp.outputPinIds]) {
      const pin = this.store.state.pins.get(pinId);
      if (!pin) continue;
      this.drawPin(g, pin, comp);
    }

    this.componentLayer.appendChild(g);
  }

  // ── Gate body (AND, OR, XOR, NOT, NAND, NOR) ──────

  private drawGate(
    g: SVGGElement,
    comp: CircuitComponent,
    x: number, y: number, w: number, h: number,
    selected: boolean,
  ): void {
    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', `${x}`);
    body.setAttribute('y', `${y}`);
    body.setAttribute('width', `${w}`);
    body.setAttribute('height', `${h}`);
    body.setAttribute('rx', '6');
    body.setAttribute('ry', '6');
    body.setAttribute('fill', selected ? COLORS.componentBodySelected : COLORS.componentBody);
    body.setAttribute('stroke', selected ? COLORS.componentStrokeSelected : COLORS.componentStroke);
    body.setAttribute('stroke-width', selected ? '2' : '1.5');
    g.appendChild(body);

    // Symbol
    const sym = GATE_SYMBOLS[comp.type] ?? comp.type;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', `${x + w / 2}`);
    text.setAttribute('y', `${y + h / 2 - 4}`);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', COLORS.labelText);
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'monospace');
    text.textContent = sym;
    g.appendChild(text);

    // Label below symbol
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', `${x + w / 2}`);
    label.setAttribute('y', `${y + h / 2 + 12}`);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('fill', '#888');
    label.setAttribute('font-size', '9');
    label.setAttribute('font-family', 'monospace');
    label.textContent = comp.type;
    g.appendChild(label);

    // Negation bubble for NOT / NAND / NOR
    if (comp.type === 'NOT' || comp.type === 'NAND' || comp.type === 'NOR') {
      const bubble = document.createElementNS(SVG_NS, 'circle');
      bubble.setAttribute('cx', `${x + w + 4}`);
      bubble.setAttribute('cy', `${y + h / 2}`);
      bubble.setAttribute('r', '4');
      bubble.setAttribute('fill', COLORS.componentBody);
      bubble.setAttribute('stroke', COLORS.componentStroke);
      bubble.setAttribute('stroke-width', '1.5');
      g.appendChild(bubble);
    }
  }

  // ── Switch ─────────────────────────────────────────

  private drawSwitch(
    g: SVGGElement,
    comp: CircuitComponent,
    x: number, y: number, w: number, h: number,
    selected: boolean,
  ): void {
    const on = !!comp.on;

    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', `${x}`);
    body.setAttribute('y', `${y}`);
    body.setAttribute('width', `${w}`);
    body.setAttribute('height', `${h}`);
    body.setAttribute('rx', '8');
    body.setAttribute('ry', '8');
    body.setAttribute('fill', on ? COLORS.switchOn : COLORS.switchOff);
    body.setAttribute('stroke', selected ? COLORS.componentStrokeSelected : COLORS.componentStroke);
    body.setAttribute('stroke-width', selected ? '2' : '1.5');
    g.appendChild(body);

    // Toggle circle (slides left/right)
    const toggle = document.createElementNS(SVG_NS, 'circle');
    const cx = on ? x + w - h / 2 : x + h / 2;
    toggle.setAttribute('cx', `${cx}`);
    toggle.setAttribute('cy', `${y + h / 2}`);
    toggle.setAttribute('r', `${h / 2 - 6}`);
    toggle.setAttribute('fill', '#fff');
    toggle.setAttribute('opacity', '0.9');
    g.appendChild(toggle);

    // Label
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', `${x + w / 2}`);
    text.setAttribute('y', `${y - 6}`);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', COLORS.labelText);
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'monospace');
    text.textContent = on ? 'ON' : 'OFF';
    g.appendChild(text);
  }

  // ── Lightbulb ──────────────────────────────────────

  private drawLightbulb(
    g: SVGGElement,
    comp: CircuitComponent,
    x: number, y: number, w: number, h: number,
    selected: boolean,
  ): void {
    const on = !!comp.on;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2 - 2;

    // Glow
    if (on) {
      const glow = document.createElementNS(SVG_NS, 'circle');
      glow.setAttribute('cx', `${cx}`);
      glow.setAttribute('cy', `${cy}`);
      glow.setAttribute('r', `${r + 10}`);
      glow.setAttribute('fill', COLORS.bulbGlow);
      glow.setAttribute('filter', 'url(#bulb-glow)');
      g.appendChild(glow);
    }

    // Bulb body
    const bulb = document.createElementNS(SVG_NS, 'circle');
    bulb.setAttribute('cx', `${cx}`);
    bulb.setAttribute('cy', `${cy}`);
    bulb.setAttribute('r', `${r}`);
    bulb.setAttribute('fill', on ? COLORS.bulbOn : COLORS.bulbOff);
    bulb.setAttribute('stroke', selected ? COLORS.componentStrokeSelected : COLORS.componentStroke);
    bulb.setAttribute('stroke-width', selected ? '2' : '1.5');
    g.appendChild(bulb);

    // Bulb icon
    const icon = document.createElementNS(SVG_NS, 'text');
    icon.setAttribute('x', `${cx}`);
    icon.setAttribute('y', `${cy}`);
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('dominant-baseline', 'central');
    icon.setAttribute('font-size', '18');
    icon.textContent = '💡';
    g.appendChild(icon);
  }

  // ── Clock ──────────────────────────────────────────

  private drawClock(
    g: SVGGElement,
    comp: CircuitComponent,
    x: number, y: number, w: number, h: number,
    selected: boolean,
  ): void {
    const on = !!comp.on;

    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('x', `${x}`);
    body.setAttribute('y', `${y}`);
    body.setAttribute('width', `${w}`);
    body.setAttribute('height', `${h}`);
    body.setAttribute('rx', '6');
    body.setAttribute('ry', '6');
    body.setAttribute('fill', on ? '#2a3a2a' : COLORS.componentBody);
    body.setAttribute('stroke', selected ? COLORS.componentStrokeSelected : COLORS.componentStroke);
    body.setAttribute('stroke-width', selected ? '2' : '1.5');
    g.appendChild(body);

    // Square wave icon
    const waveY = y + h / 2;
    const sw = w * 0.6;
    const sx = x + w * 0.2;
    const sh = h * 0.3;
    const wave = document.createElementNS(SVG_NS, 'polyline');
    wave.setAttribute('points',
      `${sx},${waveY + sh} ${sx},${waveY - sh} ` +
      `${sx + sw / 3},${waveY - sh} ${sx + sw / 3},${waveY + sh} ` +
      `${sx + 2 * sw / 3},${waveY + sh} ${sx + 2 * sw / 3},${waveY - sh} ` +
      `${sx + sw},${waveY - sh}`
    );
    wave.setAttribute('fill', 'none');
    wave.setAttribute('stroke', on ? COLORS.wireOn : '#888');
    wave.setAttribute('stroke-width', '1.5');
    g.appendChild(wave);

    // Label
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', `${x + w / 2}`);
    text.setAttribute('y', `${y - 6}`);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', COLORS.labelText);
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'monospace');
    text.textContent = 'CLK';
    g.appendChild(text);
  }

  // ── Pin ────────────────────────────────────────────

  private drawPin(g: SVGGElement, pin: Pin, comp: CircuitComponent): void {
    const gs = this.store.gridSize;
    const pos = getPinPosition(pin, comp);
    const px = pos.x * gs;
    const py = pos.y * gs;
    const color = pin.value ? COLORS.pinOn : COLORS.pinOff;

    // Connection line stub
    const stubLen = 6;
    const dx = pin.direction === 'input' ? -stubLen : stubLen;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', `${px}`);
    line.setAttribute('y1', `${py}`);
    line.setAttribute('x2', `${px + dx}`);
    line.setAttribute('y2', `${py}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '2');
    g.appendChild(line);

    // Pin dot
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', `${px}`);
    circle.setAttribute('cy', `${py}`);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#222');
    circle.setAttribute('stroke-width', '1');
    circle.dataset.pinId = pin.id;
    circle.setAttribute('class', 'pin');
    g.appendChild(circle);
  }

  // ─── Overlay (wire drawing in progress, selection box, etc.) ──

  private drawOverlay(): void {
    this.overlayLayer.innerHTML = '';

    // Wire currently being drawn
    if (this.editor.wiringFrom && this.editor.wiringTempEnd) {
      const pin = this.store.state.pins.get(this.editor.wiringFrom);
      if (pin) {
        const comp = this.store.state.components.get(pin.componentId);
        if (comp) {
          const gs = this.store.gridSize;
          const pos = getPinPosition(pin, comp);
          const sx = pos.x * gs;
          const sy = pos.y * gs;
          const ex = this.editor.wiringTempEnd.x;
          const ey = this.editor.wiringTempEnd.y;

          // Simple L-shape preview
          const mid = `${ex},${sy}`;
          const line = document.createElementNS(SVG_NS, 'polyline');
          line.setAttribute('points', `${sx},${sy} ${mid} ${ex},${ey}`);
          line.setAttribute('fill', 'none');
          line.setAttribute('stroke', COLORS.wireDrawing);
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '6 4');
          line.setAttribute('stroke-linecap', 'round');
          this.overlayLayer.appendChild(line);
        }
      }
    }
  }

  // ─── Pan / Zoom ──────────────────────────────────────

  updateTransform(): void {
    const { panOffset, zoom } = this.editor;
    const transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`;
    this.svg.style.transform = transform;
    this.svg.style.transformOrigin = '0 0';
  }

  destroy(): void {
    this.svg.remove();
  }
}
