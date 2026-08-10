import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'shots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) {
  launch.executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
}

const browser = await chromium.launch(launch);
// REDUCED=1 exercises the prefers-reduced-motion path, which freezes the clock
// and takes a different route through the cloth solver.
const page = await browser.newPage({
  // VIEWPORT=390x844 to check a breakpoint; DSF=2 to check a retina phone.
  viewport: {
    width: Number((process.env.VIEWPORT || '1440x900').split('x')[0]),
    height: Number((process.env.VIEWPORT || '1440x900').split('x')[1]),
  },
  deviceScaleFactor: Number(process.env.DSF || 1),
  isMobile: !!process.env.MOBILE,
  hasTouch: !!process.env.MOBILE,
  reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference',
});

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const gl = await page.evaluate(() => {
  const c = document.getElementById('stage');
  const ctx = c.getContext('webgl2') || c.getContext('webgl');
  return { has: !!ctx, w: c.width, h: c.height, renderer: ctx && ctx.getParameter(ctx.VERSION) };
});
console.log('canvas:', JSON.stringify(gl));

const stops = (process.env.STOPS || '0,0.14,0.3,0.42,0.56,0.68,0.8,0.93,1').split(',').map(Number);
for (const t of stops) {
  await page.evaluate((v) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max * v);
  }, t);
  // The timeline is smoothed, so a big jump takes time to converge. The rail
  // fill mirrors it exactly, so poll that rather than guessing at a delay.
  const settleStart = Date.now();
  await page.waitForFunction(
    (target) => {
      const h = parseFloat(document.getElementById('railfill').style.height) / 100;
      return Math.abs(h - target) < 0.002;
    },
    t,
    { timeout: 20000 }
  ).catch(() => console.log(`  (did not settle at t=${t})`));
  const settleMs = Date.now() - settleStart;

  // Then wait on actual rendered frames, not wall-clock. Under a software
  // rasteriser a frame can take a second, and a timed wait screenshots the
  // canvas mid-frame — you get the clear colour and mistake it for a bug.
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => (++seen >= n ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    6
  );
  const name = `${OUT}/t${String(Math.round(t * 100)).padStart(3, '0')}.png`;
  const shot = await page.screenshot({ path: name });
  const kb = Math.round(shot.length / 1024);
  // A rendered frame carries grain, so it never compresses this small.
  if (kb < 150 * (Number(process.env.VIEWPORT?.split('x')[0] || 1440) / 1440)) problems.push(`[blank] ${name} is only ${kb} KB — frame is probably empty`);
  const hud = await page.evaluate(() => ({
    fps: document.getElementById('m-fps').textContent,
    draws: document.getElementById('m-draw').textContent,
    tris: document.getElementById('m-tri').textContent,
    panel: [...document.querySelectorAll('.panel')]
      .filter((p) => parseFloat(p.style.opacity || 0) > 0.3)
      .map((p) => p.querySelector('h1,h2').textContent)[0] || '—',
  }));
  console.log(`t=${t.toFixed(2)}  settle=${settleMs}ms  fps=${hud.fps}  draws=${hud.draws}  tris=${hud.tris}  copy="${hud.panel}"  ${kb}KB -> ${name}`);
}

console.log(problems.length ? '\nCONSOLE:\n' + [...new Set(problems)].join('\n') : '\nconsole clean');
await browser.close();
