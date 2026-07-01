// ─────────────────────────────────────────────────────────
//  Interaction Controller
//
//  Handles all mouse / keyboard events on the SVG canvas:
//   • Select / drag components
//   • Wire drawing (click output pin → click input pin)
//   • Toggle switches on double-click
//   • Pan & zoom the canvas
//   • Delete selected component / wire (Delete / Backspace)
//   • Place new components from the toolbar
// ─────────────────────────────────────────────────────────

import type { EditorState, Point } from './types';
import { CircuitStore } from './simulation';
import { Renderer } from './renderer';
import { pixelToGrid, snapToGrid } from './utils';

export class InteractionController {
  private store: CircuitStore;
  private editor: EditorState;
  private renderer: Renderer;
  private svg: SVGSVGElement;
  private wrapper: HTMLDivElement;

  // Drag state
  private dragStartMouse: Point | null = null;
  private dragStartPos: Point | null = null;
  private draggingId: string | null = null;

  // Pan state
  private isPanning = false;
  private panStart: Point = { x: 0, y: 0 };

  constructor(
    wrapper: HTMLDivElement,
    store: CircuitStore,
    editor: EditorState,
    renderer: Renderer,
  ) {
    this.wrapper = wrapper;
    this.store = store;
    this.editor = editor;
    this.renderer = renderer;
    this.svg = renderer.getSvgElement();

    this.bindEvents();
  }

  // ─── Event binding ──────────────────────────────────

  private bindEvents(): void {
    this.svg.addEventListener('mousedown', this.onMouseDown);
    this.svg.addEventListener('mousemove', this.onMouseMove);
    this.svg.addEventListener('mouseup', this.onMouseUp);
    this.svg.addEventListener('dblclick', this.onDoubleClick);
    this.wrapper.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    this.svg.removeEventListener('mousedown', this.onMouseDown);
    this.svg.removeEventListener('mousemove', this.onMouseMove);
    this.svg.removeEventListener('mouseup', this.onMouseUp);
    this.svg.removeEventListener('dblclick', this.onDoubleClick);
    this.wrapper.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  // ─── Coordinate helpers ─────────────────────────────

  /** Convert page-space mouse coords → SVG canvas coords (accounting for pan & zoom) */
  private toCanvasCoords(e: MouseEvent): Point {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.editor.zoom,
      y: (e.clientY - rect.top) / this.editor.zoom,
    };
  }

  // ─── Mouse Down ─────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    const pos = this.toCanvasCoords(e);

    // ── Middle-click or Space+click → Pan ────────────
    if (e.button === 1) {
      this.startPan(e);
      return;
    }

    if (e.button !== 0) return; // left button only below

    // ── Tool: Place ────────────────────────────────
    if (this.editor.tool === 'place' && this.editor.placeType) {
      const gs = this.store.gridSize;
      const gx = pixelToGrid(pos.x, gs);
      const gy = pixelToGrid(pos.y, gs);
      this.store.addComponent(this.editor.placeType, { x: gx, y: gy });
      // Stay in place mode for rapid placement
      this.renderer.render();
      return;
    }

    // ── Tool: Wire ─────────────────────────────────
    if (this.editor.tool === 'wire') {
      const pin = this.store.findPinAtPixel(pos, 14);
      if (pin) {
        if (!this.editor.wiringFrom) {
          // Start wiring
          this.editor.wiringFrom = pin.id;
          this.editor.wiringTempEnd = pos;
        } else {
          // Complete wiring
          const fromId = this.editor.wiringFrom;
          this.editor.wiringFrom = null;
          this.editor.wiringTempEnd = null;
          const wire = this.store.addWire(fromId, pin.id);
          if (wire) {
            this.renderer.render();
          }
        }
        return;
      }

      // Click on empty space while wiring → cancel
      if (this.editor.wiringFrom) {
        this.editor.wiringFrom = null;
        this.editor.wiringTempEnd = null;
        this.renderer.render();
        return;
      }
    }

    // ── Tool: Select ───────────────────────────────
    // Check pin click first (for wiring even in select mode)
    const pinHit = this.store.findPinAtPixel(pos, 14);
    if (pinHit && this.editor.tool === 'select') {
      // Start quick-wire from pin
      this.editor.wiringFrom = pinHit.id;
      this.editor.wiringTempEnd = pos;
      return;
    }

    // Check component click
    const comp = this.store.findComponentAtPixel(pos);
    if (comp) {
      this.editor.selectedComponentId = comp.id;
      // Start dragging
      this.draggingId = comp.id;
      this.dragStartMouse = pos;
      this.dragStartPos = { ...comp.position };
      this.renderer.render();
      return;
    }

    // Check wire click
    const wire = this.store.findWireAtPixel(pos);
    if (wire) {
      // Select wire (for deletion)
      this.editor.selectedComponentId = null;
      this.renderer.render();
      return;
    }

    // Click on empty space → deselect & start pan
    this.editor.selectedComponentId = null;
    this.startPan(e);
    this.renderer.render();
  };

  // ─── Mouse Move ─────────────────────────────────────

  private onMouseMove = (e: MouseEvent): void => {
    const pos = this.toCanvasCoords(e);

    // Dragging a component
    if (this.draggingId && this.dragStartMouse && this.dragStartPos) {
      const gs = this.store.gridSize;
      const dx = (pos.x - this.dragStartMouse.x) / gs;
      const dy = (pos.y - this.dragStartMouse.y) / gs;
      const newX = Math.round(this.dragStartPos.x + dx);
      const newY = Math.round(this.dragStartPos.y + dy);

      this.store.moveComponent(this.draggingId, { x: newX, y: newY });
      this.renderer.render();
      return;
    }

    // Drawing a wire
    if (this.editor.wiringFrom) {
      this.editor.wiringTempEnd = pos;
      this.renderer.render();
      return;
    }

    // Panning
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.editor.panOffset.x += dx;
      this.editor.panOffset.y += dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.renderer.updateTransform();
      return;
    }

    // Cursor styling
    const pin = this.store.findPinAtPixel(pos, 14);
    if (pin) {
      this.svg.style.cursor = 'crosshair';
      return;
    }
    const comp = this.store.findComponentAtPixel(pos);
    if (comp) {
      this.svg.style.cursor = this.editor.tool === 'select' ? 'grab' : 'pointer';
      return;
    }
    this.svg.style.cursor = this.editor.tool === 'place' ? 'copy' : 'default';
  };

  // ─── Mouse Up ───────────────────────────────────────

  private onMouseUp = (e: MouseEvent): void => {
    // Finish wire on mouse up (in select mode quick-wire)
    if (this.editor.wiringFrom && this.editor.tool === 'select') {
      const pos = this.toCanvasCoords(e);
      const pin = this.store.findPinAtPixel(pos, 14);
      if (pin && pin.id !== this.editor.wiringFrom) {
        this.store.addWire(this.editor.wiringFrom, pin.id);
      }
      this.editor.wiringFrom = null;
      this.editor.wiringTempEnd = null;
      this.renderer.render();
    }

    // Finish drag
    if (this.draggingId) {
      this.draggingId = null;
      this.dragStartMouse = null;
      this.dragStartPos = null;
    }

    // Finish pan
    if (this.isPanning) {
      this.isPanning = false;
    }
  };

  // ─── Double Click (toggle switches) ─────────────────

  private onDoubleClick = (e: MouseEvent): void => {
    const pos = this.toCanvasCoords(e);
    const comp = this.store.findComponentAtPixel(pos);
    if (comp && comp.type === 'SWITCH') {
      this.store.toggleSwitch(comp.id);
      this.renderer.render();
    }
  };

  // ─── Wheel (zoom) ──────────────────────────────────

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.editor.zoom = Math.max(0.2, Math.min(3, this.editor.zoom + delta));
    this.renderer.updateTransform();
  };

  // ─── Keyboard ──────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    // Delete selected component
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.editor.selectedComponentId) {
      // Don't delete if focus is on an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      this.store.removeComponent(this.editor.selectedComponentId);
      this.editor.selectedComponentId = null;
      this.renderer.render();
    }

    // Escape → cancel current action
    if (e.key === 'Escape') {
      this.editor.wiringFrom = null;
      this.editor.wiringTempEnd = null;
      this.editor.selectedComponentId = null;
      this.editor.tool = 'select';
      this.editor.placeType = null;
      this.renderer.render();
    }
  };

  // ─── Pan helpers ───────────────────────────────────

  private startPan(e: MouseEvent): void {
    this.isPanning = true;
    this.panStart = { x: e.clientX, y: e.clientY };
  }
}
