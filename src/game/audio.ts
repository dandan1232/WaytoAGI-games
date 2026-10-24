export class WaterAudio {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private gate?: GainNode;
  private audible?: boolean;
  muted = false;

  ensure(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
        const data = buffer.getChannelData(0); let low = 0;
        for (let i = 0; i < data.length; i++) { low = low * 0.82 + (Math.random() * 2 - 1) * 0.18; data[i] = low; }
        this.source = this.context.createBufferSource(); this.source.buffer = buffer; this.source.loop = true;
        const filter = this.context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 420;
        this.gate = this.context.createGain(); this.gate.gain.value = 0;
        this.source.connect(filter).connect(this.gate).connect(this.context.destination); this.source.start();
      }
      void this.context.resume().catch(() => undefined);
    } catch { /* Audio is optional; unsupported devices can still play. */ }
  }

  spray(active: boolean): void {
    if (!this.context || !this.gate) return;
    const next = active && !this.muted;
    if (this.audible === next) return;
    this.audible = next;
    this.gate.gain.setTargetAtTime(next ? 0.25 : 0, this.context.currentTime, 0.035);
  }

  chime(final = false): void {
    if (!this.context || this.muted) return;
    const context = this.context;
    [523.25, 659.25, ...(final ? [783.99, 1046.5] : [])].forEach((frequency, i) => {
      const oscillator = context.createOscillator(); const gain = context.createGain();
      const start = context.currentTime + i * 0.12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.06, start + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
      oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.7);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  dispose(): void { this.source?.stop(); void this.context?.close().catch(() => undefined); }
}
