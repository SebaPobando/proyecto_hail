export type NutrialSnapshot = { timestamp: number; weight: number; pressure: number; running: boolean; fault: boolean };
export interface NutrialService { sample(timestamp?: number): NutrialSnapshot; history(hours: number, end: number): NutrialSnapshot[] }
export const nutrialSimulation: NutrialService = {
 sample(timestamp = Date.now()) { const t = timestamp / 1000; return { timestamp, weight: 1250 + 60 * Math.sin(t / 180), pressure: 420 + 18 * Math.sin(t / 23), running: true, fault: Math.floor(t / 60) % 4 === 0 }; },
 history(hours, end) { return Array.from({ length: 181 }, (_, i) => this.sample(end - (180 - i) / 180 * hours * 3600000)); }
};
