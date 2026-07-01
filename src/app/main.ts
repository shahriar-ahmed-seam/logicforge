// ─────────────────────────────────────────────────────────
//  Main Entry Point
//
//  Boots the simulator: creates the store, renderer,
//  toolbar, interaction controller, and kicks off the
//  animation / simulation loop.
// ─────────────────────────────────────────────────────────

import './styles.css';
import type { EditorState } from './types';
import { CircuitStore } from './simulation';
import { Renderer } from './renderer';
import { Toolbar } from './toolbar';
import { InteractionController } from './interaction';

// ─── Configuration ────────────────────────────────────

const GRID_SIZE = 20;      // px per grid cell
const CANVAS_W = 4000;     // virtual canvas width
const CANVAS_H = 3000;     // virtual canvas height

// ─── Editor State ─────────────────────────────────────

const editor: EditorState = {
  tool: 'select',
  placeType: null,
  selectedComponentId: null,
  wiringFrom: null,
  wiringTempEnd: null,
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  running: false,
  gridSize: GRID_SIZE,
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
};

// ─── DOM Setup ────────────────────────────────────────

const app = document.getElementById('app')!;

// Canvas wrapper (the scrollable / pannable area)
const wrapper = document.createElement('div');
wrapper.id = 'canvas-wrapper';
app.appendChild(wrapper);

// Status bar
const statusBar = document.createElement('div');
statusBar.id = 'status-bar';
statusBar.innerHTML = `
  <div class="status-item">
    <div class="status-dot" id="status-dot"></div>
    <span id="status-label">Stopped</span>
  </div>
  <div class="status-item" id="status-components">Components: 0</div>
  <div class="status-item" id="status-wires">Wires: 0</div>
  <div class="status-item" id="status-zoom">Zoom: 100%</div>
  <div class="status-item" id="status-tool">Tool: Select</div>
`;
app.appendChild(statusBar);

// ─── Store & Renderer ─────────────────────────────────

const store = new CircuitStore(GRID_SIZE, CANVAS_W, CANVAS_H);
const renderer = new Renderer(wrapper, store, editor);

// ─── Toolbar ──────────────────────────────────────────

const toolbar = new Toolbar(app as HTMLDivElement, store, editor, renderer);

// ─── Interaction ──────────────────────────────────────

const interaction = new InteractionController(wrapper, store, editor, renderer);

// ─── Demo Circuit (optional starting state) ──────────

function buildDemoCircuit(): void {
  // Two switches → AND gate → lightbulb
  const sw1 = store.addComponent('SWITCH', { x: 5, y: 8 });
  const sw2 = store.addComponent('SWITCH', { x: 5, y: 14 });
  const andGate = store.addComponent('AND', { x: 16, y: 10 });
  const bulb = store.addComponent('LIGHTBULB', { x: 28, y: 11 });

  // Wire SW1.out → AND.in0
  store.addWire(sw1.outputPinIds[0], andGate.inputPinIds[0]);
  // Wire SW2.out → AND.in1
  store.addWire(sw2.outputPinIds[0], andGate.inputPinIds[1]);
  // Wire AND.out → Bulb.in
  store.addWire(andGate.outputPinIds[0], bulb.inputPinIds[0]);

  // A second example: NOT gate
  const sw3 = store.addComponent('SWITCH', { x: 5, y: 22 });
  const notGate = store.addComponent('NOT', { x: 16, y: 22 });
  const bulb2 = store.addComponent('LIGHTBULB', { x: 28, y: 22 });

  store.addWire(sw3.outputPinIds[0], notGate.inputPinIds[0]);
  store.addWire(notGate.outputPinIds[0], bulb2.inputPinIds[0]);

  // XOR example
  const sw4 = store.addComponent('SWITCH', { x: 5, y: 30 });
  const sw5 = store.addComponent('SWITCH', { x: 5, y: 36 });
  const xorGate = store.addComponent('XOR', { x: 16, y: 32 });
  const bulb3 = store.addComponent('LIGHTBULB', { x: 28, y: 33 });

  store.addWire(sw4.outputPinIds[0], xorGate.inputPinIds[0]);
  store.addWire(sw5.outputPinIds[0], xorGate.inputPinIds[1]);
  store.addWire(xorGate.outputPinIds[0], bulb3.inputPinIds[0]);
}

buildDemoCircuit();

// ─── Render + Simulation Tick Hook ────────────────────

// Initial render
renderer.render();

// Hook the simulation tick to the renderer
store.onTick = () => {
  renderer.render();
  updateStatusBar();
};

// If simulation is NOT running we still want to render on interaction,
// but we already call renderer.render() from the interaction controller.

// Start simulation automatically
store.start();
editor.running = true;
updateStatusBar();

// Update play button in toolbar
const playBtns = document.querySelectorAll<HTMLButtonElement>('.play-btn');
playBtns.forEach((btn) => {
  btn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-label">Pause</span>';
  btn.classList.add('active');
});

// ─── Status Bar Updates ────────────────────────────────

function updateStatusBar(): void {
  const dot = document.getElementById('status-dot')!;
  const label = document.getElementById('status-label')!;
  const compCount = document.getElementById('status-components')!;
  const wireCount = document.getElementById('status-wires')!;
  const zoomDisplay = document.getElementById('status-zoom')!;
  const toolDisplay = document.getElementById('status-tool')!;

  if (store.running) {
    dot.classList.add('running');
    label.textContent = 'Running';
  } else {
    dot.classList.remove('running');
    label.textContent = 'Stopped';
  }

  compCount.textContent = `Components: ${store.state.components.size}`;
  wireCount.textContent = `Wires: ${store.state.wires.size}`;
  zoomDisplay.textContent = `Zoom: ${Math.round(editor.zoom * 100)}%`;

  const toolName = editor.tool === 'place' && editor.placeType
    ? `Place ${editor.placeType}`
    : editor.tool.charAt(0).toUpperCase() + editor.tool.slice(1);
  toolDisplay.textContent = `Tool: ${toolName}`;
}

// Update status bar periodically for zoom changes etc.
setInterval(updateStatusBar, 500);
