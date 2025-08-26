// ESM wrapper for the vendored UMD build `echarts.min.js`
// - Loads the script as a classic script (so UMD sees window/global)
// - Exposes a Promise-based loader with full TypeScript types via @types/echarts

// Types from DefinitelyTyped (you already installed @types/echarts)
import type * as EChartsNS from 'echarts';

// Resolve the emitted asset URL for the UMD bundle at runtime
const ECHARTS_URL = new URL('./echarts.min.js', import.meta.url).toString();

let cached: typeof EChartsNS | null = null;
let loadPromise: Promise<typeof EChartsNS> | null = null;

function isEChartsNamespace(x: unknown): x is typeof EChartsNS {
    return typeof x === 'object' && x !== null && 'init' in (x as Record<string, unknown>);
}

/**
 * Load the vendored ECharts UMD build once and return the typed namespace.
 * Safe to call multiple times; subsequent calls reuse the same promise.
 */
export function loadECharts(): Promise<typeof EChartsNS> {
    if (cached) {
        return Promise.resolve(cached);
    }

    if (!loadPromise) {
        loadPromise = new Promise((resolve, reject) => {
            // If another loader raced ahead and set the global, resolve immediately
            if (isEChartsNamespace((globalThis as Record<string, unknown>).echarts)) {
                cached = (globalThis as { echarts: typeof EChartsNS }).echarts;
                resolve(cached);
                return;
            }

            const script = document.createElement('script');
            script.src = ECHARTS_URL;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.addEventListener('load', () => {
                const maybe = (globalThis as Record<string, unknown>).echarts;
                if (!isEChartsNamespace(maybe)) {
                    reject(new Error('ECharts failed to attach to window.echarts'));
                    return;
                }
                cached = maybe;
                resolve(cached);
            });
            script.addEventListener('error', () => {
                reject(new Error(`Failed to load ECharts script: ${ECHARTS_URL}`));
            });
            document.head.appendChild(script);
        });
    }

    return loadPromise;
}

/**
 * Convenience helper mirroring echarts.init with lazy loading.
 */
export async function init(
    dom: HTMLDivElement | HTMLCanvasElement,
    theme?: string | object | null,
    opts?: Parameters<typeof EChartsNS.init>[2]
): Promise<EChartsNS.ECharts> {
    const echarts = await loadECharts();
    return echarts.init(dom, theme ?? undefined, opts);
}

// Re-export useful types for convenience
export type { EChartOption, ECharts } from 'echarts';
