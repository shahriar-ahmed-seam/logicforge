// ─────────────────────────────────────────────────────────
//  Simulation Engine
//
//  Maintains the circuit state and runs the boolean
//  evaluation "tick" at 60 fps via requestAnimationFrame.
//  Implements real-time graph traversal to propagate
//  signals from switches / clocks through gates to bulbs.
// ─────────────────────────────────────────────────────────

import type {
  CircuitComponent,
  CircuitState,
  ComponentType,
  Id,
  Pin,
  Point,
  Rect,
  Wire,
} from './types';
import { createComponent, getComponentRect, getPinPosition } from './components';
import { routeWire } from './pathfinding';
import { uid } from './utils';

// ─── Circuit Store ─────────────────────────────────────

export class CircuitStore {
  state: CircuitState;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;

  /** Callback fired after every tick so the renderer can repaint */
  onTick: (() => void) | null = null;

  private _running = false;
  private _rafId = 0;
  private _tickCount = 0;

  constructor(gridSize = 20, canvasWidth = 3000, canvasHeight = 2000) {
    this.gridSize = gridSize;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.state = {
      components: new Map(),
      pins: new Map(),
      wires: new Map(),
    };
  }

  // ─── Mutation helpers ────────────────────────────────

  addComponent(type: ComponentType, gridPos: Point): CircuitComponent {
    const { component, pins } = createComponent(type, gridPos);
    this.state.components.set(component.id, component);
    for (const pin of pins) {
      this.state.pins.set(pin.id, pin);
    }
    return component;
  }

  removeComponent(id: Id): void {
    const comp = this.state.components.get(id);
    if (!comp) return;

    // Collect all pin ids
    const allPinIds = [...comp.inputPinIds, ...comp.outputPinIds];

    // Remove all wires connected to any of these pins
    for (const wire of this.state.wires.values()) {
      if (allPinIds.includes(wire.fromPinId) || allPinIds.includes(wire.toPinId)) {
        // Disconnect the other end
        const otherPinId =
          allPinIds.includes(wire.fromPinId) ? wire.toPinId : wire.fromPinId;
        const otherPin = this.state.pins.get(otherPinId);
        if (otherPin) otherPin.wireId = null;
        this.state.wires.delete(wire.id);
      }
    }

    // Remove pins
    for (const pid of allPinIds) {
      this.state.pins.delete(pid);
    }

    this.state.components.delete(id);
  }

  moveComponent(id: Id, newGridPos: Point): void {
    const comp = this.state.components.get(id);
    if (!comp) return;
    comp.position = { ...newGridPos };

    // Re-route connected wires
    this.rerouteWiresForComponent(id);
  }

  toggleSwitch(id: Id): void {
    const comp = this.state.components.get(id);
    if (comp && comp.type === 'SWITCH') {
      comp.on = !comp.on;
    }
  }

  /** Create a wire between an output pin and an input pin */
  addWire(fromPinId: Id, toPinId: Id): Wire | null {
    const fromPin = this.state.pins.get(fromPinId);
    const toPin = this.state.pins.get(toPinId);
    if (!fromPin || !toPin) return null;

    // Validate directions
    if (fromPin.direction !== 'output' || toPin.direction !== 'input') {
      // Try swapping
      if (fromPin.direction === 'input' && toPin.direction === 'output') {
        return this.addWire(toPinId, fromPinId);
      }
      return null;
    }

    // Don't allow connecting a pin to itself or same component
    if (fromPin.componentId === toPin.componentId) return null;

    // Don't double-connect an input pin
    if (toPin.wireId) return null;

    const wire: Wire = {
      id: uid(),
      fromPinId,
      toPinId,
      path: [],
      value: false,
    };

    // Compute path
    wire.path = this.computeWirePath(fromPinId, toPinId);

    fromPin.wireId = wire.id;
    toPin.wireId = wire.id;
    this.state.wires.set(wire.id, wire);
    return wire;
  }

  removeWire(id: Id): void {
    const wire = this.state.wires.get(id);
    if (!wire) return;

    const fromPin = this.state.pins.get(wire.fromPinId);
    const toPin = this.state.pins.get(wire.toPinId);
    if (fromPin) fromPin.wireId = null;
    if (toPin) toPin.wireId = null;
    this.state.wires.delete(id);
  }

  // ─── Wire routing ───────────────────────────────────

  private computeWirePath(fromPinId: Id, toPinId: Id): Point[] {
    const fromPin = this.state.pins.get(fromPinId)!;
    const toPin = this.state.pins.get(toPinId)!;
    const fromComp = this.state.components.get(fromPin.componentId)!;
    const toComp = this.state.components.get(toPin.componentId)!;

    const startPx: Point = {
      x: (fromComp.position.x + fromPin.offset.x) * this.gridSize,
      y: (fromComp.position.y + fromPin.offset.y) * this.gridSize,
    };
    const endPx: Point = {
      x: (toComp.position.x + toPin.offset.x) * this.gridSize,
      y: (toComp.position.y + toPin.offset.y) * this.gridSize,
    };

    // Collect obstacles (all components except the two connected ones)
    const obstacles: Rect[] = [];
    for (const comp of this.state.components.values()) {
      if (comp.id === fromPin.componentId || comp.id === toPin.componentId) continue;
      obstacles.push(getComponentRect(comp));
    }

    return routeWire(startPx, endPx, obstacles, this.gridSize, this.canvasWidth, this.canvasHeight);
  }

  rerouteWiresForComponent(compId: Id): void {
    const comp = this.state.components.get(compId);
    if (!comp) return;

    const allPinIds = new Set([...comp.inputPinIds, ...comp.outputPinIds]);

    for (const wire of this.state.wires.values()) {
      if (allPinIds.has(wire.fromPinId) || allPinIds.has(wire.toPinId)) {
        wire.path = this.computeWirePath(wire.fromPinId, wire.toPinId);
      }
    }
  }

  rerouteAllWires(): void {
    for (const wire of this.state.wires.values()) {
      wire.path = this.computeWirePath(wire.fromPinId, wire.toPinId);
    }
  }

  // ─── Simulation tick ────────────────────────────────

  /**
   * Evaluate the entire circuit for one timestep.
   *
   *  1. Set output pins of source components (switches, clocks).
   *  2. Propagate values forward through wires.
   *  3. Evaluate each gate's logic function.
   *  4. Repeat propagation until stable (max 10 iterations to avoid infinite loops).
   */
  tick(): void {
    this._tickCount++;

    // ── Phase 0: Clocks ────────────────────────────
    for (const comp of this.state.components.values()) {
      if (comp.type === 'CLOCK') {
        comp.clockCounter = (comp.clockCounter ?? 0) + 1;
        if (comp.clockCounter >= (comp.clockPeriod ?? 30)) {
          comp.on = !comp.on;
          comp.clockCounter = 0;
        }
      }
    }

    // Multiple propagation passes to allow deep chains to settle
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;

      // ── Phase 1: source outputs (switches / clocks) ─
      for (const comp of this.state.components.values()) {
        if (comp.type === 'SWITCH' || comp.type === 'CLOCK') {
          for (const pinId of comp.outputPinIds) {
            const pin = this.state.pins.get(pinId)!;
            const newVal = !!comp.on;
            if (pin.value !== newVal) {
              pin.value = newVal;
              changed = true;
            }
          }
        }
      }

      // ── Phase 2: propagate wires ─────────────────
      for (const wire of this.state.wires.values()) {
        const fromPin = this.state.pins.get(wire.fromPinId)!;
        const toPin = this.state.pins.get(wire.toPinId)!;

        if (toPin.value !== fromPin.value) {
          toPin.value = fromPin.value;
          changed = true;
        }
        wire.value = fromPin.value;
      }

      // ── Phase 3: evaluate gate logic ─────────────
      for (const comp of this.state.components.values()) {
        const result = this.evaluateGate(comp);
        if (result === null) continue; // not a gate or lightbulb

        for (let i = 0; i < comp.outputPinIds.length; i++) {
          const pin = this.state.pins.get(comp.outputPinIds[i])!;
          const newVal = Array.isArray(result) ? result[i] : result;
          if (pin.value !== newVal) {
            pin.value = newVal;
            changed = true;
          }
        }

        // For lightbulb, store state on the component for rendering
        if (comp.type === 'LIGHTBULB') {
          const inPin = this.state.pins.get(comp.inputPinIds[0]);
          comp.on = inPin ? inPin.value : false;
        }
      }

      if (!changed) break; // circuit is stable
    }
  }

  /** Evaluate a gate component and return its output value(s) */
  private evaluateGate(comp: CircuitComponent): boolean | boolean[] | null {
    const getInputs = (): boolean[] =>
      comp.inputPinIds.map((pid) => this.state.pins.get(pid)?.value ?? false);

    switch (comp.type) {
      case 'AND': {
        const ins = getInputs();
        return ins.length > 0 ? ins.every(Boolean) : false;
      }
      case 'OR': {
        const ins = getInputs();
        return ins.some(Boolean);
      }
      case 'XOR': {
        const ins = getInputs();
        return ins.filter(Boolean).length % 2 === 1;
      }
      case 'NOT': {
        const ins = getInputs();
        return !ins[0];
      }
      case 'NAND': {
        const ins = getInputs();
        return ins.length > 0 ? !ins.every(Boolean) : true;
      }
      case 'NOR': {
        const ins = getInputs();
        return !ins.some(Boolean);
      }
      case 'LIGHTBULB':
        return null; // handled separately
      case 'SWITCH':
      case 'CLOCK':
        return null; // source components
      default:
        return null;
    }
  }

  // ─── Animation loop ─────────────────────────────────

  get running(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  stop(): void {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  private _loop = (): void => {
    if (!this._running) return;
    this.tick();
    this.onTick?.();
    this._rafId = requestAnimationFrame(this._loop);
  };

  // ─── Query helpers ──────────────────────────────────

  /** Find the pin (if any) at a given pixel position, within a tolerance */
  findPinAtPixel(px: Point, tolerance = 12): Pin | null {
    for (const pin of this.state.pins.values()) {
      const comp = this.state.components.get(pin.componentId);
      if (!comp) continue;
      const pos = getPinPosition(pin, comp);
      const ppx = pos.x * this.gridSize;
      const ppy = pos.y * this.gridSize;
      const d = Math.hypot(ppx - px.x, ppy - px.y);
      if (d <= tolerance) return pin;
    }
    return null;
  }

  /** Find the component (if any) at a pixel position */
  findComponentAtPixel(px: Point): CircuitComponent | null {
    for (const comp of this.state.components.values()) {
      const rect = getComponentRect(comp);
      const rx = rect.x * this.gridSize;
      const ry = rect.y * this.gridSize;
      const rw = rect.width * this.gridSize;
      const rh = rect.height * this.gridSize;

      if (px.x >= rx && px.x <= rx + rw && px.y >= ry && px.y <= ry + rh) {
        return comp;
      }
    }
    return null;
  }

  /** Find wire near a pixel position */
  findWireAtPixel(px: Point, tolerance = 8): Wire | null {
    for (const wire of this.state.wires.values()) {
      for (let i = 0; i < wire.path.length - 1; i++) {
        const a = wire.path[i];
        const b = wire.path[i + 1];
        const d = distToSegment(px, a, b);
        if (d <= tolerance) return wire;
      }
    }
    return null;
  }

  /** Get all component rects (for A* obstacles) */
  getObstacleRects(): Rect[] {
    return Array.from(this.state.components.values()).map(getComponentRect);
  }
}

// ─── Utility ─────────────────────────────────────────

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
