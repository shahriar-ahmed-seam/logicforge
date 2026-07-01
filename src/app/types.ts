// ─────────────────────────────────────────────────────────
//  Core types for the Digital Logic & Circuit Simulator
// ─────────────────────────────────────────────────────────

/** Unique identifier type for all entities */
export type Id = string;

/** 2-D point on the canvas (in grid units or pixels) */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle used for collision / bounds */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Pin ────────────────────────────────────────────────

export type PinDirection = 'input' | 'output';

export interface Pin {
  id: Id;
  /** Which component owns this pin */
  componentId: Id;
  direction: PinDirection;
  /** Index among the component's input/output pins (0-based) */
  index: number;
  /** Position relative to the component's top-left corner (grid units) */
  offset: Point;
  /** Current boolean state resolved by the simulation */
  value: boolean;
  /** Id of the wire connected to this pin (if any) */
  wireId: Id | null;
}

// ─── Component ─────────────────────────────────────────

export type ComponentType =
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'NAND'
  | 'NOR'
  | 'SWITCH'
  | 'LIGHTBULB'
  | 'CLOCK';

export interface CircuitComponent {
  id: Id;
  type: ComponentType;
  /** Top-left position in grid units */
  position: Point;
  /** Width / height in grid units */
  size: { width: number; height: number };
  /** Ordered arrays of pin IDs */
  inputPinIds: Id[];
  outputPinIds: Id[];
  /** For SWITCH – is it toggled on? */
  on?: boolean;
  /** For CLOCK – period in simulation ticks */
  clockPeriod?: number;
  /** Internal tick counter for clocks */
  clockCounter?: number;
  /** Is this component currently being dragged? */
  dragging?: boolean;
  /** Label to render inside / above the component */
  label: string;
}

// ─── Wire ──────────────────────────────────────────────

export interface Wire {
  id: Id;
  /** Source pin (output) */
  fromPinId: Id;
  /** Destination pin (input) */
  toPinId: Id;
  /** Computed orthogonal path points (Manhattan routing) */
  path: Point[];
  /** Current boolean state (for rendering colour) */
  value: boolean;
}

// ─── Circuit state (the whole world) ──────────────────

export interface CircuitState {
  components: Map<Id, CircuitComponent>;
  pins: Map<Id, Pin>;
  wires: Map<Id, Wire>;
}

// ─── Editor / interaction state ───────────────────────

export type ToolMode = 'select' | 'wire' | 'place';

export interface EditorState {
  tool: ToolMode;
  /** Component type to place when tool==='place' */
  placeType: ComponentType | null;
  /** Currently selected component id */
  selectedComponentId: Id | null;
  /** Wire-drawing in progress */
  wiringFrom: Id | null;          // pin id
  wiringTempEnd: Point | null;    // mouse position while dragging wire
  /** Panning / zoom */
  panOffset: Point;
  zoom: number;
  /** Is simulation running? */
  running: boolean;
  /** Grid size in pixels */
  gridSize: number;
  /** Canvas size in pixels */
  canvasWidth: number;
  canvasHeight: number;
}

// ─── A-Star grid helpers ──────────────────────────────

export interface GridCell {
  x: number;
  y: number;
  walkable: boolean;
}

export interface AStarNode {
  x: number;
  y: number;
  g: number;   // cost from start
  h: number;   // heuristic to goal
  f: number;   // g + h
  parent: AStarNode | null;
}
