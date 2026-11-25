class SandboxAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastStepTime = 0;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainTargetIntensity = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopRainAmbience();
    } else {
      this.playUiClick();
      if (this.rainTargetIntensity > 0.01) {
        this.setRainAmbience(this.rainTargetIntensity);
      }
    }
    return this.muted;
  }

  public setRainAmbience(intensity: number) {
    const clamped = Math.max(0, Math.min(1, intensity));
    this.rainTargetIntensity = clamped;
    if (this.muted || clamped <= 0.01) {
      this.stopRainAmbience();
      return;
    }
    // Only start ambient noise if audio context already exists and is running (after user gesture)
    if (!this.ctx || this.ctx.state !== 'running') {
      return;
    }
    if (!this.rainSource || !this.rainGain) {
      try {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        // Soft pink-ish filtered noise for light rain ambience
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1350;
        filter.Q.value = 0.65;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();

        this.rainSource = source;
        this.rainGain = gain;
      } catch {
        return;
      }
    }
    if (this.rainGain && this.ctx) {
      const targetGain = 0.032 * clamped;
      this.rainGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.rainGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.35);
    }
  }

  public stopRainAmbience() {
    if (this.rainGain && this.ctx) {
      try {
        this.rainGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.rainGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      } catch {
        // Ignore
      }
    }
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch {
        // Ignore
      }
      this.rainSource = null;
    }
    if (this.rainGain) {
      try {
        this.rainGain.disconnect();
      } catch {
        // Ignore
      }
      this.rainGain = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.07,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.rainTargetIntensity > 0.01 && !this.rainSource && ctx.state === 'running') {
      this.setRainAmbience(this.rainTargetIntensity);
    }
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playUiClick() {
    this.tone(540, 0.06, 'triangle', 0.05, 0, 680);
  }

  public playFootstep() {
    const now = performance.now();
    if (now - this.lastStepTime < 310) return;
    this.lastStepTime = now;
    this.tone(115 + Math.random() * 22, 0.05, 'sine', 0.03, 0, 68);
  }

  public playMineHit() {
    this.tone(240 + Math.random() * 40, 0.06, 'square', 0.04, 0, 140);
  }

  public playBlockBreak() {
    this.tone(280, 0.08, 'sawtooth', 0.055, 0, 110);
    this.tone(170, 0.09, 'square', 0.045, 0.025, 76);
  }

  public playBlockPlace() {
    this.tone(190, 0.065, 'square', 0.05, 0, 130);
    this.tone(330, 0.05, 'triangle', 0.04, 0.015, 260);
  }

  public playCableConnect() {
    this.tone(620, 0.07, 'sine', 0.05, 0, 880);
    this.tone(920, 0.08, 'triangle', 0.04, 0.03, 1120);
  }

  public playDoorToggle() {
    this.tone(220, 0.1, 'triangle', 0.055, 0, 310);
  }

  public playMachineOpen() {
    this.tone(380, 0.09, 'triangle', 0.05, 0, 560);
    this.tone(580, 0.11, 'sine', 0.045, 0.04, 720);
  }

  public playCoalLoad() {
    this.tone(140, 0.1, 'sawtooth', 0.055, 0, 85);
    this.tone(210, 0.08, 'triangle', 0.05, 0.05, 160);
  }

  public playClaimLocked() {
    this.tone(175, 0.09, 'sawtooth', 0.06, 0, 135);
    this.tone(130, 0.12, 'sawtooth', 0.055, 0.09, 98);
  }

  public playClaimCreated() {
    this.tone(440, 0.15, 'triangle', 0.06, 0);
    this.tone(659.25, 0.18, 'triangle', 0.06, 0.07);
    this.tone(880, 0.24, 'sine', 0.06, 0.15);
  }

  public playWeaponHit() {
    this.tone(210, 0.11, 'sawtooth', 0.07, 0, 80);
    this.tone(460, 0.08, 'triangle', 0.05, 0.02, 240);
  }

  public playPlayerHurt() {
    this.tone(150, 0.16, 'sawtooth', 0.075, 0, 62);
  }

  public playPurchase() {
    this.tone(587, 0.1, 'sine', 0.06, 0);
    this.tone(880, 0.16, 'triangle', 0.06, 0.06);
  }
}

export const gameAudio = new SandboxAudioEngine();
