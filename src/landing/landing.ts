/**
 * LogicForge landing interactions:
 *  - nav backdrop on scroll, reveal-on-scroll, animated counters
 *  - a decorative "signal flow" hero: pulses travel along a node graph
 */

const nav = document.getElementById('nav');
const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  },
  { threshold: 0.15 },
);
document.querySelectorAll('.reveal').forEach((el, i) => {
  (el as HTMLElement).style.transitionDelay = `${Math.min(i * 60, 300)}ms`;
  io.observe(el);
});

const countIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target as HTMLElement;
    const target = Number(el.dataset.count || '0');
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countIO.unobserve(el);
  }
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach((c) => countIO.observe(c));

// ── Hero: signal-flow node graph ────────────────────────────────────
const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null;
if (canvas && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const ctx = canvas.getContext('2d')!;
  let W = 0, H = 0, dpr = 1;

  interface Node { x: number; y: number; }
  interface Edge { a: number; b: number; }
  let nodes: Node[] = [];
  let edges: Edge[] = [];

  const build = () => {
    nodes = [];
    edges = [];
    const cols = Math.max(4, Math.round(W / 220));
    const rows = Math.max(3, Math.round(H / 200));
    const gx = W / (cols + 1);
    const gy = H / (rows + 1);
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        nodes.push({
          x: gx * c + (Math.random() - 0.5) * gx * 0.4,
          y: gy * r + (Math.random() - 0.5) * gy * 0.4,
        });
      }
    }
    // connect each node rightward to a node in the next column
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[j].x - nodes[i].x;
        const dy = Math.abs(nodes[j].y - nodes[i].y);
        if (dx > gx * 0.6 && dx < gx * 1.5 && dy < gy * 1.2 && Math.random() > 0.45) {
          edges.push({ a: i, b: j });
        }
      }
    }
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  };
  resize();
  window.addEventListener('resize', resize);

  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);

    // edges
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(108,140,255,0.16)';
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // travelling signal pulses
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k];
      const a = nodes[e.a], b = nodes[e.b];
      const phase = (t * 0.35 + k * 0.13) % 1;
      const px = a.x + (b.x - a.x) * phase;
      const py = a.y + (b.y - a.y) * phase;
      const on = Math.sin(t * 1.5 + k) > 0.2;
      ctx.beginPath();
      ctx.fillStyle = on ? 'rgba(76,255,114,0.9)' : 'rgba(108,140,255,0.5)';
      ctx.shadowColor = on ? '#4cff72' : '#6c8cff';
      ctx.shadowBlur = 8;
      ctx.arc(px, py, on ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(230,232,238,0.55)';
      ctx.arc(n.x, n.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
