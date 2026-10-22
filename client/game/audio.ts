export class GameAudio {
  private context?: AudioContext;
  volume = 0.35;
  unlock() { this.context ??= new AudioContext(); if (this.context.state === 'suspended') void this.context.resume(); }
  tone(frequency: number, duration: number, type: OscillatorType = 'sine', end = frequency) {
    if (!this.context || !this.volume) return;
    const c = this.context, o = c.createOscillator(), g = c.createGain(), now = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(frequency, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(this.volume * .16, now + .012); g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + duration);
  }
  flap() { this.tone(360, .11, 'sine', 600); }
  crash() { this.tone(170, .25, 'triangle', 50); }
  checkpoint() { this.tone(660, .14); setTimeout(() => this.tone(880, .18), 90); }
  finish() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, .25), i * 100)); }
}
