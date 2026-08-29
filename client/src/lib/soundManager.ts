/**
 * Shared Sound Manager for all scanner modules
 * Singleton pattern — import and use anywhere
 */
/** Long enough to kill the click, short enough that nothing sounds slow. */
const ATTACK = 0.008;

/** Where the reader's own choice about sound is kept. */
const MUTE_KEY = "wazn-sound-enabled";

class ScanSoundManager {
  private audioContext: AudioContext | null = null;
  /**
   * Remembered, not reset every visit.
   *
   * This flag existed and lived only in memory, so somebody who turned the
   * sound off got it back on the next page load — which is the same as not
   * having the setting at all. It is read once here and written whenever it
   * changes.
   */
  private _enabled: boolean = (() => {
    try {
      return localStorage.getItem(MUTE_KEY) !== "off";
    } catch {
      // Private windows and blocked storage: sound on, which is the default
      // everywhere else too.
      return true;
    }
  })();

  get enabled() { return this._enabled; }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
    try {
      localStorage.setItem(MUTE_KEY, enabled ? "on" : "off");
    } catch {
      // Nothing to do: the choice holds for this visit and no longer.
    }
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
    // Ramp up over a few milliseconds instead of starting at full gain. A
    // square edge on the waveform's first sample is a click, and the click
    // is most of what makes a short beep sound harsh — it is heard as part
    // of the tone rather than as a separate noise.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + ATTACK);
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
      const at = ctx.currentTime + i * interval;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + ATTACK);
      gain.gain.exponentialRampToValueAtTime(0.01, at + duration);
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

  /**
   * The transient notice, and nothing else.
   *
   * A tracking the system has never seen is the commonest event of a quick
   * register shift, and for a while it shared playAlert's siren. It has to
   * be audible over a warehouse without being something anyone minds hearing
   * two hundred times: a sine wave, which has no harmonics to rasp; one
   * note in the middle of the range, so it neither booms nor pierces; an
   * eighth of the volume the siren uses; and gone in a sixth of a second.
   */
  playNotice() { this.playTone(660, 0.16, 'sine', 0.12); }

  /**
   * The two the customer portal uses, and nothing else.
   *
   * A warehouse tool can be loud: it competes with a compressor and the
   * operator chose to be there. A customer's phone is the opposite — it may
   * be in a meeting, a mosque, or somebody's hand at midnight. So these are
   * quiet, short, and only ever fire on something the customer just pressed.
   * Nothing here plays on a page load or on anything arriving in the
   * background.
   *
   * Two soft notes rising, which is the shape every phone on earth already
   * uses for "that worked".
   */
  playPortalDone() { this.playSequence([587, 880], 0.11, 0.14, 'sine', 0.10); }

  /** The same shape falling, and no louder. Nothing here is an emergency. */
  playPortalFailed() { this.playSequence([494, 370], 0.12, 0.16, 'sine', 0.10); }

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
