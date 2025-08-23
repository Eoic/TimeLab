import type * as EChartsNS from 'echarts';

declare global {
    interface Window {
        // UMD build attaches itself here
        echarts?: typeof EChartsNS;
    }
}

export {};
