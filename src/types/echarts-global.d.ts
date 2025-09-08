import type * as EChartsNS from 'echarts';

declare global {
    interface Window {
        echarts?: typeof EChartsNS;
    }
}

export {};
