// ─────────────────────────────────────────────────────────
//  Utility helpers shared across the simulator
// ─────────────────────────────────────────────────────────

import type { Id, Point, Rect } from './types';

let _nextId = 1;

/** Generate a unique id string */
export function uid(): Id {
  return `id_${_nextId++}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Snap a pixel coordinate to the nearest grid position */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Snap a Point to the grid */
export function snapPointToGrid(p: Point, gridSize: number): Point {
  return {
    x: snapToGrid(p.x, gridSize),
    y: snapToGrid(p.y, gridSize),
  };
}

/** Manhattan distance */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Check if a point lies inside a rect */
export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Check if two rects overlap */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

/** Clamp a number between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Deep-clone a plain object via structuredClone */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/** Check if two Points are equal */
export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Convert grid units to pixel units */
export function gridToPixel(gridPos: number, gridSize: number): number {
  return gridPos * gridSize;
}

/** Convert pixel units to grid units */
export function pixelToGrid(pixelPos: number, gridSize: number): number {
  return Math.round(pixelPos / gridSize);
}
