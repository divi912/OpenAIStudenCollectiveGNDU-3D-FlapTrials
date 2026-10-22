/** Original 132 BPM instrumental, "Wing Cup Weekend". No samples or external music.
 * Bake once off the game thread; gameplay plays one seamless AudioBuffer, not a synth scheduler.
 */
export async function renderMusic(): Promise<AudioBuffer> {
  const rate = 22050, beat = 60 / 132, bars = 16, seconds = bars * 4 * beat;
  const frames = Math.round(seconds * rate);
  const c = new OfflineAudioContext(2, frames + rate, rate);
  const bus = c.createGain(); bus.gain.value = .65; bus.connect(c.destination);
  const echo = c.createDelay(.3), wet = c.createGain(); echo.delayTime.value = beat / 3; wet.gain.value = .13;
  bus.connect(echo); echo.connect(wet); wet.connect(c.destination);
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  function note(midi: number, start: number, length: number, level: number, type: OscillatorType, pan = 0) {
    const osc = c.createOscillator(), gain = c.createGain(), stereo = c.createStereoPanner();
    osc.type = type; osc.frequency.value = frequency(midi); stereo.pan.value = pan;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(level, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    osc.connect(gain); gain.connect(stereo); stereo.connect(bus);
    osc.start(start); osc.stop(start + length + .01);
  }
  // Reuse one deterministic noise sample for all percussion during the offline bake.
  const noise = c.createBuffer(1, rate / 2, rate), data = noise.getChannelData(0);
  let seed = 123456;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
  function percussion(start: number, snare: boolean, accent = 1) {
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    const length = snare ? .13 : .045; source.buffer = noise;
    filter.type = snare ? 'bandpass' : 'highpass'; filter.frequency.value = snare ? 1800 : 6500;
    filter.Q.value = .65;
    // Noise must attack from zero too: an instant hi-hat onset clicks at the loop seam.
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime((snare ? .34 : .13) * accent, start + .002);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(start); source.stop(start + length);
    if (snare) note(50, start, .10, .09, 'triangle');
  }
  function kick(start: number) {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.frequency.setValueAtTime(125, start); osc.frequency.exponentialRampToValueAtTime(43, start + .14);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.48, start + .004); gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
    osc.connect(gain); gain.connect(bus); osc.start(start); osc.stop(start + .24);
  }
  const chords = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
  const melodies = [
    [72, -1, 76, 79, 76, 74, 72, -1],
    [71, 74, -1, 79, 74, -1, 71, 67],
    [69, -1, 72, 76, 79, 76, -1, 72],
    [69, 72, -1, 77, 76, 72, 69, 67],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const at = bar * 4 * beat, chord = chords[bar % 4];
    for (let j = 0; j < 4; j++) { kick(at + j * beat); if (j % 2) percussion(at + j * beat, true); }
    for (let j = 0; j < 8; j++) percussion(at + j * beat / 2, false, j % 2 ? .6 : 1);
    for (const t of [0, .75, 1.5, 2, 2.75, 3.5]) note(chord[0] - 12 + (t === 3.5 ? 12 : 0), at + t * beat, .21, .25, 'triangle');
    for (const t of [.5, 1.5, 2.5, 3.5]) for (const n of chord) note(n + 12, at + t * beat, .19, .055, 'triangle', -.3);
    for (let j = 0; j < 8; j++) {
      const midi = melodies[bar % 4][j]; if (midi < 0) continue;
      // B section and the ending answer the main melody without increasing density.
      const octave = bar >= 8 && bar < 12 && j % 3 === 0 ? 12 : 0;
      note(midi + octave, at + j * beat / 2, j === 6 ? .34 : .20, .14, 'sine', .23);
      note(midi + octave + 12, at + j * beat / 2, .12, .025, 'triangle', .12);
    }
  }
  const rendered = await c.startRendering(), loop = c.createBuffer(2, frames, rate);
  let peak = 0;
  for (let channel = 0; channel < 2; channel++) {
    const source = rendered.getChannelData(channel), out = loop.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      // Wrap the final bar's reverb/decay into the beginning for a continuous loop.
      out[i] = source[i] + (i < rate ? source[frames + i] : 0); peak = Math.max(peak, Math.abs(out[i]));
    }
  }
  if (peak) for (let channel = 0; channel < 2; channel++) {
    const out = loop.getChannelData(channel); for (let i = 0; i < frames; i++) out[i] *= .8 / peak;
  }
  return loop;
}
