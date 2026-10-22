import { renderMusic } from './music';

export class GameAudio {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private music?: AudioBufferSourceNode;
  private musicBuffer?: AudioBuffer;
  private rendering?: Promise<void>;
  private musicLevel = .28;
  private hidden = false;
  volume = 0.35;
  get musicVolume() { return this.musicLevel; }
  set musicVolume(value: number) {
    this.musicLevel = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .28;
    this.applyMusicGain();
    if (this.musicLevel && this.context && !this.musicBuffer) this.prepareMusic();
  }
  unlock() {
    this.context ??= new AudioContext();
    if (!this.hidden && this.context.state === 'suspended') void this.context.resume().catch(() => {});
    this.prepareMusic();
  }
  private prepareMusic() {
    if (!this.context || !this.musicLevel || this.musicBuffer || this.rendering) return;
    const context = this.context;
    this.rendering = renderMusic().then(buffer => {
      this.musicBuffer = buffer;
      this.musicGain = context.createGain(); this.musicGain.gain.value = this.hidden ? 0 : this.musicLevel;
      this.musicGain.connect(context.destination);
      this.music = context.createBufferSource(); this.music.buffer = buffer; this.music.loop = true;
      this.music.connect(this.musicGain); this.music.start();
    }).catch(error => { console.info('Music unavailable:', error); }).finally(() => { this.rendering = undefined; });
  }
  private applyMusicGain() {
    if (!this.context || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(this.hidden ? 0 : this.musicLevel, this.context.currentTime, .06);
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden; this.applyMusicGain();
    if (hidden) void this.context?.suspend().catch(() => {});
    else if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
  }
  get stats() { return { state: this.context?.state ?? 'locked', musicReady: !!this.musicBuffer, musicPlaying: !!this.music && !this.hidden && this.musicLevel > 0, musicVolume: this.musicLevel, duration: this.musicBuffer?.duration ?? 0 }; }
  tone(frequency: number, duration: number, type: OscillatorType = 'sine', end = frequency) {
    if (!this.context || !this.volume || this.hidden) return;
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
