/**
 * Shared Sound Manager for all scanner modules
 * Singleton pattern — import and use anywhere
 */
class ScanSoundManager {
  private audioContext: AudioContext | null = null;
  private _enabled: boolean = true;

  get enabled() { return this._enabled; }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  private getContext(): AudioContext | null {
    if (!this._enabled) return null;
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      return this.audioContext;
    } catch {
      return null;
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playSequence(freqs: number[], interval: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15) {
    const ctx = this.getContext();
    if (!ctx) return;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(volume, ctx.currentTime + i * interval);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * interval + duration);
      osc.start(ctx.currentTime + i * interval);
      osc.stop(ctx.currentTime + i * interval + duration);
    });
  }

  /** Short beep — scan acknowledged */
  playBeep() { this.playTone(1800, 0.1); }

  /** Rising chord — operation successful */
  playSuccess() { this.playSequence([523, 659, 784], 0.08, 0.12); }

  /** Double tone — found in database */
  playFound() { this.playSequence([660, 880], 0.12, 0.15); }

  /** Double warning tone */
  playWarning() { this.playSequence([440, 440], 0.15, 0.1, 'triangle', 0.2); }

  /** Low buzz — error occurred */
  playError() { this.playTone(300, 0.3, 'sawtooth'); }

  /**
   * The one that has to be heard across a warehouse.
   *
   * playError is a low sawtooth at a third of full volume — fine as a hint
   * beside a toast, inaudible next to a strapping table with a compressor
   * running. This is the sound that goes with a dialog somebody has to
   * dismiss, so it is allowed to be rude: two sharp descending tones near
   * full volume, the shape every operator already reads as "stop".
   */
  playAlert() {
    this.playSequence([988, 740], 0.16, 0.16, 'square', 0.9);
  }

  /** Triple short beep — duplicate detected */
  playDuplicate() { this.playSequence([330, 330, 330], 0.1, 0.06, 'square'); }

  /** Not found — lower single tone */
  playNotFound() { this.playTone(330, 0.25, 'triangle'); }

  /** Victory — ascending four notes (batch complete, all verified, etc.) */
  playComplete() { this.playSequence([523, 659, 784, 1047], 0.12, 0.2); }

  /** Vibrate device if supported */
  vibrate(ms: number = 100) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }
}

// Singleton export
export const soundManager = new ScanSoundManager();
