import { beforeAll, describe, expect, it } from "vitest";

/** Worklet'in kaydettigi islemci; gercek AudioWorklet kapsami taklit edilir. */
interface GateProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

const SAMPLE_RATE = 48_000;
const BLOCK = 128;

let createProcessor: () => GateProcessor;

beforeAll(async () => {
  const scope = globalThis as Record<string, unknown>;
  scope.sampleRate = SAMPLE_RATE;
  scope.AudioWorkletProcessor = class {};
  scope.registerProcessor = (_name: string, ctor: new () => GateProcessor) => {
    createProcessor = () => new ctor();
  };
  // Duz JS dosyasi; TS tip kontrolune girmesin diye yol degiskenden okunuyor.
  const path = "./voiceGateWorklet.js";
  await import(/* @vite-ignore */ path);
});

/** Verilen genlikte bloklar isler, son blogun cikis tepe degerini dondurur. */
function run(
  processor: GateProcessor,
  amplitude: number,
  seconds: number,
  parameters: { threshold: number; enabled: number },
): number {
  const blocks = Math.ceil((seconds * SAMPLE_RATE) / BLOCK);
  let peak = 0;
  for (let block = 0; block < blocks; block++) {
    const input = new Float32Array(BLOCK).fill(amplitude);
    const output = new Float32Array(BLOCK);
    processor.process([[input]], [[output]], {
      threshold: new Float32Array([parameters.threshold]),
      enabled: new Float32Array([parameters.enabled]),
    });
    peak = Math.max(...output.map(Math.abs));
  }
  return peak;
}

// -40 dBFS = 0.01, -60 dBFS = 0.001
const LOUD = 0.05;
const QUIET = 0.001;

describe("ses esigi worklet'i", () => {
  it("kapaliyken sesi aynen gecirir", () => {
    const processor = createProcessor();
    expect(run(processor, QUIET, 0.5, { threshold: -40, enabled: 0 })).toBeCloseTo(QUIET, 5);
  });

  it("esigin altindaki sesi bekleme suresinden sonra susturur", () => {
    const processor = createProcessor();
    // Bekleme (~0.28 s) dolmadan kesmemeli.
    expect(run(processor, QUIET, 0.1, { threshold: -40, enabled: 1 })).toBeGreaterThan(QUIET * 0.9);
    // Bekleme + kapanma suresinden sonra neredeyse sifir.
    expect(run(processor, QUIET, 1.5, { threshold: -40, enabled: 1 })).toBeLessThan(QUIET * 0.01);
  });

  it("esigi gecen ses gelince hizla acilir", () => {
    const processor = createProcessor();
    run(processor, QUIET, 1.5, { threshold: -40, enabled: 1 });
    // 20 ms icinde tam acik olmali; ilk hece kesilmesin.
    expect(run(processor, LOUD, 0.02, { threshold: -40, enabled: 1 })).toBeGreaterThan(LOUD * 0.95);
  });

  it("kazanci ani degil yumusak degistirir (tik sesi olmasin)", () => {
    const processor = createProcessor();
    run(processor, QUIET, 0.35, { threshold: -40, enabled: 1 });
    const input = new Float32Array(BLOCK).fill(QUIET);
    const output = new Float32Array(BLOCK);
    processor.process([[input]], [[output]], {
      threshold: new Float32Array([-40]),
      enabled: new Float32Array([1]),
    });
    // Tek blok icinde komsu ornekler arasinda buyuk sicrama olmamali.
    for (let i = 1; i < BLOCK; i++) {
      expect(Math.abs(output[i] - output[i - 1])).toBeLessThan(QUIET * 0.05);
    }
  });
});
