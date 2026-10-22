// Host shapes as thin neon outlines with glow. DOM-free: takes a 2D context.
// Base at (x, y), about s px tall; host.params vary size, step and tower counts and nodes.
const SHAPES = {
  pyramid(g, x, y, s, p) {   // p.steps stacked steps
    const n = p.steps, h = s * .9 / n;
    for (let i = 0; i < n; i++) { const w = s * (1 - i * .8 / n); g.strokeRect(x - w / 2, y - (i + 1) * h, w, h); }
  },
  cubes(g, x, y, s, p) {   // rows of towers + 1, towers, ... 1 cubes
    const rows = p.towers + 1, u = s / (rows * .9 + .35);
    for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) {
      const cx = x + (i - (rows - r - 1) / 2) * u * 1.1, cy = y - r * u * .9 - u / 2;
      g.strokeRect(cx - u / 2, cy - u / 2, u, u);
      g.beginPath(); g.moveTo(cx - u / 2, cy - u / 2); g.lineTo(cx - u / 4, cy - u * .75); g.lineTo(cx + u * .75, cy - u * .75); g.lineTo(cx + u / 2, cy - u / 2); g.stroke();
    }
  },
  spire(g, x, y, s, p) {   // p.steps + 2 rungs
    g.beginPath(); g.moveTo(x - s * .16, y); g.lineTo(x, y - s); g.lineTo(x + s * .16, y); g.closePath(); g.stroke();
    const n = p.steps + 2;
    for (let i = 1; i < n; i++) { const yy = y - i * s / (n + 1), w = s * .16 * (1 - i / (n + 1)); g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.stroke(); }
  },
  sphere(g, x, y, s, p) {   // p.steps - 1 rings each way
    const r = s * .45, cy = y - r - s * .05, n = p.steps;
    g.beginPath(); g.arc(x, cy, r, 0, 7); g.stroke();
    for (let i = 1; i < n; i++) {
      g.beginPath(); g.ellipse(x, cy, r, r * i / n, 0, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(x, cy, r * i / n, r, 0, 0, 7); g.stroke();
    }
  },
  fortress(g, x, y, s, p) {   // p.towers towers over a walled base, the middle ones taller
    const w = s * 1.1, h = s * .42, n = p.towers;
    g.strokeRect(x - w / 2, y - h, w, h);
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) * 2 - 1 : 0, tx = x + f * w * .4, th = s * (.95 - Math.abs(f) * .2);
      g.strokeRect(tx - s * .08, y - th, s * .16, th - h);
    }
    for (let i = 0; i < 7; i++) g.strokeRect(x - w / 2 + i * w / 7 + w / 56, y - h - s * .07, w / 14, s * .07);
  },
  lattice(g, x, y, s, p) {   // p.nodes nodes on a spiral, some linked
    const pts = [];
    for (let i = 0; i < p.nodes; i++) { const a = i * 2.4, r = s * .18 + (i % 3) * s * .11; pts.push([x + Math.cos(a) * r * 1.2, y - s * .5 + Math.sin(a) * r * .9]); }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
      if ((i * 7 + j * 3) % 4 === 0) { g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[j]); g.stroke(); }
    for (const [px, py] of pts) { g.beginPath(); g.arc(px, py, 1.5 + s * .03, 0, 7); g.stroke(); }
  },
};

// glitch 0..1: horizontal slices shift by up to about 14 px and the outline flickers; t in seconds
export function drawHost(g, host, x, y, size, colour, glitch = 0, t = 0) {
  const s = size * host.params.size, shape = SHAPES[host.shape];
  g.save(); g.strokeStyle = colour; g.shadowColor = colour; g.shadowBlur = Math.max(6, s * .15); g.lineWidth = 1.4;
  if (glitch) {
    if (Math.sin(t * 61) > .6) g.globalAlpha *= .35;   // flicker
    const n = 6, top = y - s * 1.2, sh = (s * 1.2 + 4) / n;
    for (let i = 0; i < n; i++) {
      g.save(); g.beginPath(); g.rect(x - s * 2, top + i * sh, s * 4, sh); g.clip();
      g.translate(Math.sin(t * 40 + i * 9) * glitch * 14, 0); shape(g, x, y, s, host.params); g.restore();
    }
  } else shape(g, x, y, s, host.params);
  g.restore();
}
