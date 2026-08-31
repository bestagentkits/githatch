// ============================================================================
// GitHoot High-Performance WebAssembly SVG-to-PNG Renderer for Cloudflare Edge
// (src/server/services/image/resvg-renderer.ts)
// ============================================================================

import { Resvg, initWasm } from '@resvg/resvg-wasm';
// @ts-ignore
import wasmModule from './index_bg.wasm';
import { fontBuffers } from './fonts';

let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

export async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) return;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      await initWasm(wasmModule);
      wasmInitialized = true;
    })().catch((err) => {
      wasmInitPromise = null;
      wasmInitialized = false;
      throw err;
    });
  }
  return wasmInitPromise;
}

export async function renderSvgToPng(svg: string, width = 1200): Promise<Uint8Array> {
  await ensureWasmInitialized();
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width
    },
    font: {
      fontBuffers,
      defaultFontFamily: 'Archivo',
      sansSerifFamily: 'Archivo',
      monospaceFamily: 'JetBrains Mono'
    }
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
