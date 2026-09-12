/* global AudioWorkletProcessor, registerProcessor, sampleRate */

/**
 * Ses esigi (noise gate) AudioWorklet islemcisi.
 *
 * Seviye esigin altina dusunce mikrofon kisilir, ustune cikinca acilir.
 * Hazir kutuphanedeki gate sesi 128 orneklik bloklar halinde sert kesiyordu;
 * her acilip kapanmada tik sesi duyuluyordu. Burada kazanc ornek basina
 * yumusakca degisir, esik de dugumu yeniden kurmadan canli ayarlanir.
 *
 * TypeScript derlemesine girmez; Vite dosyayi oldugu gibi kopyalar, cunku
 * worklet ayri bir global kapsamda calisir ve modul importu kullanamaz.
 */

/** Acilma suresi: konusmanin ilk hecesi kesilmesin diye cok kisa. */
const ATTACK_SECONDS = 0.004;
/** Kapanma suresi: kelime sonlari dogal sonsun. */
const RELEASE_SECONDS = 0.12;
/** Seviye dustukten sonra kapanmadan once beklenen sure; kelime arasi bosluklar icin. */
const HOLD_SECONDS = 0.28;
/** Kapanma esigi acilmanin 6 dB altinda; esik civarinda titremesin. */
const HYSTERESIS = 0.5;

class VoiceGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -50, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "enabled", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.attack = Math.exp(-1 / (ATTACK_SECONDS * sampleRate));
    this.release = Math.exp(-1 / (RELEASE_SECONDS * sampleRate));
    this.holdLength = HOLD_SECONDS * sampleRate;
    this.gain = 1;
    this.open = true;
    // Acik baslar ve tam bekleme suresiyle; ilk sessiz blokta aninda kapanmasin.
    this.holdRemaining = this.holdLength;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output) return true;

    const frames = input[0].length;
    const channels = Math.min(input.length, output.length);

    if (parameters.enabled[0] < 0.5) {
      this.open = true;
      this.holdRemaining = this.holdLength;
    } else {
      let sum = 0;
      for (let channel = 0; channel < channels; channel++) {
        const data = input[channel];
        for (let i = 0; i < frames; i++) sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / (frames * channels));
      const openLevel = 10 ** (parameters.threshold[0] / 20);

      if (rms >= openLevel) {
        this.open = true;
        this.holdRemaining = this.holdLength;
      } else if (this.open && rms < openLevel * HYSTERESIS) {
        this.holdRemaining -= frames;
        if (this.holdRemaining <= 0) this.open = false;
      }
    }

    const target = this.open ? 1 : 0;
    for (let i = 0; i < frames; i++) {
      const coefficient = target > this.gain ? this.attack : this.release;
      this.gain = target + (this.gain - target) * coefficient;
      for (let channel = 0; channel < channels; channel++) {
        output[channel][i] = input[channel][i] * this.gain;
      }
    }
    return true;
  }
}

registerProcessor("gameteams-voice-gate", VoiceGateProcessor);
