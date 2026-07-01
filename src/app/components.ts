// ─────────────────────────────────────────────────────────
//  Component Factory
//
//  Creates logic gate, switch, lightbulb and clock
//  components with their associated pins.
// ─────────────────────────────────────────────────────────

import type { CircuitComponent, ComponentType, Id, Pin, Point } from './types';
import { uid } from './utils';

/** Standard sizes per component type (in grid cells) */
const COMPONENT_SIZES: Record<ComponentType, { width: number; height: number }> = {
  AND:       { width: 4, height: 3 },
  OR:        { width: 4, height: 3 },
  XOR:       { width: 4, height: 3 },
  NOT:       { width: 3, height: 2 },
  NAND:      { width: 4, height: 3 },
  NOR:       { width: 4, height: 3 },
  SWITCH:    { width: 3, height: 2 },
  LIGHTBULB: { width: 3, height: 2 },
  CLOCK:     { width: 3, height: 2 },
};

/** How many input/output pins each type has */
const PIN_COUNTS: Record<ComponentType, { inputs: number; outputs: number }> = {
  AND:       { inputs: 2, outputs: 1 },
  OR:        { inputs: 2, outputs: 1 },
  XOR:       { inputs: 2, outputs: 1 },
  NOT:       { inputs: 1, outputs: 1 },
  NAND:      { inputs: 2, outputs: 1 },
  NOR:       { inputs: 2, outputs: 1 },
  SWITCH:    { inputs: 0, outputs: 1 },
  LIGHTBULB: { inputs: 1, outputs: 0 },
  CLOCK:     { inputs: 0, outputs: 1 },
};

/** Human-readable labels */
const LABELS: Record<ComponentType, string> = {
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
  NOT: 'NOT',
  NAND: 'NAND',
  NOR: 'NOR',
  SWITCH: 'SW',
  LIGHTBULB: '💡',
  CLOCK: 'CLK',
};

export interface ComponentCreationResult {
  component: CircuitComponent;
  pins: Pin[];
}

/**
 * Create a new component of the given type at the given grid position,
 * together with its input and output Pin objects.
 */
export function createComponent(
  type: ComponentType,
  gridPosition: Point,
): ComponentCreationResult {
  const componentId: Id = uid();
  const size = COMPONENT_SIZES[type];
  const { inputs, outputs } = PIN_COUNTS[type];

  const pins: Pin[] = [];
  const inputPinIds: Id[] = [];
  const outputPinIds: Id[] = [];

  // ── Create input pins (left edge) ──────────────────
  for (let i = 0; i < inputs; i++) {
    const pinId = uid();
    const yOffset = inputs === 1
      ? size.height / 2
      : (i + 1) * (size.height / (inputs + 1));

    pins.push({
      id: pinId,
      componentId,
      direction: 'input',
      index: i,
      offset: { x: 0, y: yOffset },
      value: false,
      wireId: null,
    });
    inputPinIds.push(pinId);
  }

  // ── Create output pins (right edge) ────────────────
  for (let i = 0; i < outputs; i++) {
    const pinId = uid();
    const yOffset = outputs === 1
      ? size.height / 2
      : (i + 1) * (size.height / (outputs + 1));

    pins.push({
      id: pinId,
      componentId,
      direction: 'output',
      index: i,
      offset: { x: size.width, y: yOffset },
      value: false,
      wireId: null,
    });
    outputPinIds.push(pinId);
  }

  const component: CircuitComponent = {
    id: componentId,
    type,
    position: { ...gridPosition },
    size,
    inputPinIds,
    outputPinIds,
    label: LABELS[type],
    on: type === 'SWITCH' ? false : undefined,
    clockPeriod: type === 'CLOCK' ? 30 : undefined,  // ~0.5s at 60fps
    clockCounter: type === 'CLOCK' ? 0 : undefined,
  };

  return { component, pins };
}

/** Get the absolute grid-coordinate position of a pin */
export function getPinPosition(pin: Pin, component: CircuitComponent): Point {
  return {
    x: component.position.x + pin.offset.x,
    y: component.position.y + pin.offset.y,
  };
}

/** Get component bounding rect in grid units */
export function getComponentRect(comp: CircuitComponent) {
  return {
    x: comp.position.x,
    y: comp.position.y,
    width: comp.size.width,
    height: comp.size.height,
  };
}
