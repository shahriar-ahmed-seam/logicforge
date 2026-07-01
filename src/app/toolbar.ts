// ─────────────────────────────────────────────────────────
//  Toolbar UI
//
//  Builds the left-hand sidebar with component palette,
//  tool selection, simulation controls, and info panel.
// ─────────────────────────────────────────────────────────

import type { ComponentType, EditorState } from './types';
import { CircuitStore } from './simulation';
import { Renderer } from './renderer';

interface ToolbarButton {
  label: string;
  icon: string;
  action: () => void;
  isActive?: () => boolean;
}

interface ComponentButton {
  type: ComponentType;
  icon: string;
  label: string;
}

const COMPONENT_PALETTE: ComponentButton[] = [
  { type: 'SWITCH',    icon: '🔌', label: 'Switch' },
  { type: 'LIGHTBULB', icon: '💡', label: 'Bulb' },
  { type: 'CLOCK',     icon: '⏱️', label: 'Clock' },
  { type: 'AND',       icon: '&',  label: 'AND' },
  { type: 'OR',        icon: '≥1', label: 'OR' },
  { type: 'XOR',       icon: '=1', label: 'XOR' },
  { type: 'NOT',       icon: '!',  label: 'NOT' },
  { type: 'NAND',      icon: '⊼',  label: 'NAND' },
  { type: 'NOR',       icon: '⊽',  label: 'NOR' },
];

export class Toolbar {
  private container: HTMLDivElement;
  private store: CircuitStore;
  private editor: EditorState;
  private renderer: Renderer;
  private el!: HTMLDivElement;

  /** Called by the toolbar when user clicks a component button */
  onPlaceComponent: ((type: ComponentType) => void) | null = null;
  onToolChange: ((tool: string) => void) | null = null;

  constructor(
    container: HTMLDivElement,
    store: CircuitStore,
    editor: EditorState,
    renderer: Renderer,
  ) {
    this.container = container;
    this.store = store;
    this.editor = editor;
    this.renderer = renderer;
    this.build();
  }

  private build(): void {
    this.el = document.createElement('div');
    this.el.id = 'toolbar';
    this.el.innerHTML = `
      <div class="toolbar-header">
        <a href="/" class="toolbar-brand" title="Back to home">⚡ LogicForge</a>
        <span class="version">v1.0</span>
      </div>

      <div class="toolbar-section">
        <h3>Tools</h3>
        <div class="tool-buttons" id="tool-buttons"></div>
      </div>

      <div class="toolbar-section">
        <h3>Components</h3>
        <div class="component-palette" id="component-palette"></div>
      </div>

      <div class="toolbar-section">
        <h3>Simulation</h3>
        <div class="sim-controls" id="sim-controls"></div>
      </div>

      <div class="toolbar-section">
        <h3>Actions</h3>
        <div class="action-buttons" id="action-buttons"></div>
      </div>

      <div class="toolbar-section toolbar-info" id="toolbar-info">
        <h3>Info</h3>
        <div class="info-content">
          <p><strong>Drag & drop</strong> components onto the canvas.</p>
          <p><strong>Click pins</strong> to draw wires.</p>
          <p><strong>Double-click</strong> a switch to toggle.</p>
          <p><strong>Scroll</strong> to zoom, drag empty space to pan.</p>
          <p><strong>Delete</strong> key removes selected component.</p>
        </div>
      </div>
    `;

    this.container.insertBefore(this.el, this.container.firstChild);

    this.buildToolButtons();
    this.buildComponentPalette();
    this.buildSimControls();
    this.buildActionButtons();
  }

  // ─── Tool buttons ──────────────────────────────────

  private buildToolButtons(): void {
    const parent = this.el.querySelector('#tool-buttons')!;
    const tools: ToolbarButton[] = [
      {
        label: 'Select',
        icon: '🖱️',
        action: () => {
          this.editor.tool = 'select';
          this.editor.placeType = null;
          this.refresh();
        },
        isActive: () => this.editor.tool === 'select',
      },
      {
        label: 'Wire',
        icon: '🔗',
        action: () => {
          this.editor.tool = 'wire';
          this.editor.placeType = null;
          this.refresh();
        },
        isActive: () => this.editor.tool === 'wire',
      },
    ];

    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.innerHTML = `<span class="btn-icon">${tool.icon}</span><span class="btn-label">${tool.label}</span>`;
      btn.addEventListener('click', tool.action);
      btn.dataset.tool = tool.label.toLowerCase();
      parent.appendChild(btn);
    }
  }

  // ─── Component palette ─────────────────────────────

  private buildComponentPalette(): void {
    const parent = this.el.querySelector('#component-palette')!;

    for (const item of COMPONENT_PALETTE) {
      const btn = document.createElement('button');
      btn.className = 'comp-btn';
      btn.innerHTML = `<span class="comp-icon">${item.icon}</span><span class="comp-label">${item.label}</span>`;
      btn.dataset.type = item.type;
      btn.addEventListener('click', () => {
        this.editor.tool = 'place';
        this.editor.placeType = item.type;
        this.onPlaceComponent?.(item.type);
        this.refresh();
      });
      parent.appendChild(btn);
    }
  }

  // ─── Simulation controls ───────────────────────────

  private buildSimControls(): void {
    const parent = this.el.querySelector('#sim-controls')!;

    // Play / Pause
    const playBtn = document.createElement('button');
    playBtn.className = 'sim-btn play-btn';
    playBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-label">Run</span>';
    playBtn.addEventListener('click', () => {
      if (this.store.running) {
        this.store.stop();
        this.editor.running = false;
        playBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-label">Run</span>';
        playBtn.classList.remove('active');
      } else {
        this.store.start();
        this.editor.running = true;
        playBtn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-label">Pause</span>';
        playBtn.classList.add('active');
      }
      this.refresh();
    });
    parent.appendChild(playBtn);

    // Step
    const stepBtn = document.createElement('button');
    stepBtn.className = 'sim-btn';
    stepBtn.innerHTML = '<span class="btn-icon">⏭</span><span class="btn-label">Step</span>';
    stepBtn.addEventListener('click', () => {
      this.store.tick();
      this.renderer.render();
    });
    parent.appendChild(stepBtn);

    // Reset
    const resetBtn = document.createElement('button');
    resetBtn.className = 'sim-btn';
    resetBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-label">Reset</span>';
    resetBtn.addEventListener('click', () => {
      // Reset all switch/clock states and pins
      for (const comp of this.store.state.components.values()) {
        if (comp.type === 'SWITCH' || comp.type === 'CLOCK') {
          comp.on = false;
          comp.clockCounter = 0;
        }
      }
      for (const pin of this.store.state.pins.values()) {
        pin.value = false;
      }
      for (const wire of this.store.state.wires.values()) {
        wire.value = false;
      }
      this.renderer.render();
    });
    parent.appendChild(resetBtn);
  }

  // ─── Action buttons ────────────────────────────────

  private buildActionButtons(): void {
    const parent = this.el.querySelector('#action-buttons')!;

    // Clear all
    const clearBtn = document.createElement('button');
    clearBtn.className = 'action-btn danger';
    clearBtn.innerHTML = '<span class="btn-icon">🗑️</span><span class="btn-label">Clear All</span>';
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire circuit?')) {
        this.store.state.components.clear();
        this.store.state.pins.clear();
        this.store.state.wires.clear();
        this.editor.selectedComponentId = null;
        this.renderer.render();
      }
    });
    parent.appendChild(clearBtn);

    // Re-route wires
    const rerouteBtn = document.createElement('button');
    rerouteBtn.className = 'action-btn';
    rerouteBtn.innerHTML = '<span class="btn-icon">🔀</span><span class="btn-label">Re-route Wires</span>';
    rerouteBtn.addEventListener('click', () => {
      this.store.rerouteAllWires();
      this.renderer.render();
    });
    parent.appendChild(rerouteBtn);
  }

  // ─── Refresh active states ─────────────────────────

  refresh(): void {
    // Tool buttons
    const toolBtns = this.el.querySelectorAll<HTMLButtonElement>('.tool-btn');
    toolBtns.forEach((btn) => {
      const tool = btn.dataset.tool;
      btn.classList.toggle('active', tool === this.editor.tool);
    });

    // Component buttons
    const compBtns = this.el.querySelectorAll<HTMLButtonElement>('.comp-btn');
    compBtns.forEach((btn) => {
      const type = btn.dataset.type;
      btn.classList.toggle('active', this.editor.tool === 'place' && this.editor.placeType === type);
    });
  }

  destroy(): void {
    this.el.remove();
  }
}
