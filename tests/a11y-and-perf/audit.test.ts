import { describe, expect, test } from '../bun-test-shim';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ROOT = process.cwd();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Accessibility (WCAG 2.2 AA) — Contrast & Landmarks', () => {
  test('all LittleSteps semantic foreground/background color pairs meet WCAG 2.2 AA (>= 4.5:1)', () => {
    const tokens = {
      offwhite: '#FAF8F5',
      surface: '#FFFFFF',
      cream: '#F4EFE7',
      charcoal: '#2F3331',
      muted: '#5E6460',
      sage: '#4F6F5E',
      sageSoft: '#EAF1EC',
      peachInk: '#8C533D',
      peachSoft: '#FBEDE6',
      lavenderInk: '#5B4F78',
      lavenderSoft: '#F1EEF8',
      danger: '#A64B42',
      dangerSoft: '#FBECEB',
    };

    const pairs: Array<[string, string, string]> = [
      ['charcoal on offwhite', tokens.charcoal, tokens.offwhite],
      ['charcoal on surface', tokens.charcoal, tokens.surface],
      ['charcoal on cream', tokens.charcoal, tokens.cream],
      ['muted on offwhite', tokens.muted, tokens.offwhite],
      ['muted on surface', tokens.muted, tokens.surface],
      ['white on sage primary button', '#FFFFFF', tokens.sage],
      ['sage on sage-soft', tokens.sage, tokens.sageSoft],
      ['peach-ink on peach-soft', tokens.peachInk, tokens.peachSoft],
      ['lavender-ink on lavender-soft', tokens.lavenderInk, tokens.lavenderSoft],
      ['danger on danger-soft', tokens.danger, tokens.dangerSoft],
      ['white on danger button', '#FFFFFF', tokens.danger],
    ];

    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `${label} contrast (${ratio.toFixed(2)}:1)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('HTML shell, layouts, Modal, and SecureVideoPlayer satisfy key WCAG 2.2 AA structural checks', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<html lang="en">');
    expect(indexHtml).toContain('<title>LittleSteps');
    expect(indexHtml).toContain('name="description"');

    const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');

    const publicLayout = fs.readFileSync(path.join(ROOT, 'src/components/PublicLayout.tsx'), 'utf8');
    expect(publicLayout).toContain('Skip to main content');
    expect(publicLayout).toContain('id="main-content"');

    const parentDash = fs.readFileSync(path.join(ROOT, 'src/pages/ParentDashboardView.tsx'), 'utf8');
    expect(parentDash).toContain('Skip to main content');
    expect(parentDash).toContain('id="main-content"');

    const modal = fs.readFileSync(path.join(ROOT, 'src/design-system/Modal.tsx'), 'utf8');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('min-h-[44px] min-w-[44px]');
    expect(modal).toContain('previousFocusRef');

    const player = fs.readFileSync(path.join(ROOT, 'src/components/SecureVideoPlayer.tsx'), 'utf8');
    expect(player).toContain('preload="metadata"');
    expect(player).toContain('aria-label="Private caregiver activity practice video"');
  });

  test('frontend codebase contains zero unsafe DOM sinks or native alert popups', () => {
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
      }
      return acc;
    };
    const files = walk(path.join(ROOT, 'src'));
    const forbidden = ['dangerouslySetInnerHTML', 'innerHTML', 'window.alert', 'window.confirm', 'window.open'];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        expect(content.includes(pattern), `Found forbidden ${pattern} in ${file}`).toBe(false);
      }
    }
  });
});

describe('Performance Benchmarks — API Latency & Production Bundle Sizes', () => {
  test('core API endpoints respond well below 250ms p95 locally', async () => {
    const endpoints = ['/api/v1/health', '/api/v1/curriculum/meta'];
    const summary: Record<string, { p50Ms: number; p95Ms: number; maxMs: number }> = {};

    for (const ep of endpoints) {
      const samples: number[] = [];
      for (let i = 0; i < 10; i += 1) {
        const t0 = performance.now();
        const res = await fetch(`http://localhost:3000${ep}`);
        await res.text();
        expect(res.status).toBe(200);
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p50 = samples[Math.floor(samples.length * 0.5)];
      const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
      const max = samples[samples.length - 1];
      summary[ep] = {
        p50Ms: Number(p50.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        maxMs: Number(max.toFixed(2)),
      };
      expect(p95).toBeLessThan(250);
    }

    // Authenticated parent dashboard journey & progress endpoints
    const login = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'LittleSteps' },
      body: JSON.stringify({ email: 'meera@littlesteps.in', password: 'LittleSteps123!' }),
    });
    const rawCookie = login.headers.get('set-cookie') || '';
    const cookie = (/ls_session=([^;]+)/.exec(rawCookie)?.[0]) || '';
    const childrenRes = await fetch('http://localhost:3000/api/v1/children', {
      headers: { Cookie: cookie },
    });
    const { children } = (await childrenRes.json()) as { children: Array<{ id: string }> };
    if (children[0]) {
      for (const ep of [
        `/api/v1/journey/${children[0].id}/today`,
        `/api/v1/progress/${children[0].id}`,
      ]) {
        const samples: number[] = [];
        for (let i = 0; i < 10; i += 1) {
          const t0 = performance.now();
          const res = await fetch(`http://localhost:3000${ep}`, { headers: { Cookie: cookie } });
          await res.text();
          expect(res.status).toBe(200);
          samples.push(performance.now() - t0);
        }
        samples.sort((a, b) => a - b);
        const p50 = samples[Math.floor(samples.length * 0.5)];
        const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];
        summary[ep] = {
          p50Ms: Number(p50.toFixed(2)),
          p95Ms: Number(p95.toFixed(2)),
          maxMs: Number(samples[samples.length - 1].toFixed(2)),
        };
        expect(p95).toBeLessThan(250);
      }
    }

    console.log('Measured API Latency Summary (ms):', JSON.stringify(summary));
  });

  test('production Vite build produces code-split chunks and reports real gzipped sizes', () => {
    const assetsDir = path.join(ROOT, 'dist', 'assets');
    expect(fs.existsSync(assetsDir)).toBe(true);
    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter((f) => f.endsWith('.js'));
    const cssFiles = files.filter((f) => f.endsWith('.css'));

    // Code splitting should produce > 1 JS chunk (entry + lazy role workspaces)
    expect(jsFiles.length).toBeGreaterThanOrEqual(4);
    expect(cssFiles.length).toBeGreaterThanOrEqual(1);

    const bundleReport = [...jsFiles, ...cssFiles].map((file) => {
      const buf = fs.readFileSync(path.join(assetsDir, file));
      const gz = zlib.gzipSync(buf);
      return {
        file,
        rawKb: Number((buf.length / 1024).toFixed(1)),
        gzipKb: Number((gz.length / 1024).toFixed(1)),
      };
    });
    console.log('Measured Production Bundle Report:', JSON.stringify(bundleReport));
  });
});
