/* Northbound Afterglow — original, entirely procedural audio.
 * No recordings, downloads, worklet dependency, or second propagation clock.
 * Call start() IN the play/resume gesture, update(s) on playing frames, and
 * pause() when play stops. reset() reuses the context and the recording tap.
 * The public master is the final, volume-controlled output, connected to
 * ctx.destination. A recorder can attach in parallel without bypassing safety.
 * Optional tuning: audio.radio.{bpm,transpose,level}; audio.levels below.
 * Measured synthesis is not a substitute for a person's headphone/speaker listen.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// An original, unhurried eight-bar phrase. Nulls are intentional breathing space.
const CHORDS = [[50, 57, 61, 64], [47, 54, 57, 61], [43, 54, 57, 62], [45, 52, 59, 62]];
const MELODY = [66, null, 69, 64, 61, null, 64, 69,
                66, 62, null, 61, 57, null, 61, 64,
                62, null, 66, 69, 64, 62, null, 57,
                59, 64, null, 66, 62, 61, 59, null];

export class DriveAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radio = { bpm: 76, transpose: 0, level: 0.68 };
    // Artist-facing trims, independent of the player's master volume.
    this.levels = { rocket: 1, engine: 1, tires: 1, wind: 1, music: 1 };
    this.diagnostics = { starts: 0, resumeFailures: 0, sourcesStarted: 0, replays: 0 };
    this._run = null;
    this._wanted = false;
    this._epoch = 0;
    this._targets = new WeakMap();
    this._buffers = new Map();
    this._lastState = null;
    this._lastTime = null;
    this._lastSpeed = 0;
    this._load = 0;
  }

  async start() {
    this._wanted = true;
    ++this._epoch;
    if (!this.ctx || this.ctx.state === 'closed') {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is not available in this browser.');
      this._buffers.clear();
      this._targets = new WeakMap();
      this.ctx = new Context({ latencyHint: 'interactive' });
      this._buildMaster();
      this._run = null;
    }
    const context = this.ctx;
    // Resume before any await or synthesis work: retain the browser's gesture.
    let resumed;
    try { resumed = context.resume(); }
    catch (error) { ++this.diagnostics.resumeFailures; throw error; }
    const state = this._lastState || {};
    this._ramp(this.master.gain, state.muted ? 0 : clamp(finite(state.volume, 0.65), 0, 1) * 0.9, 0.06);
    if (!this._run) this._buildRun();
    if (this._lastState) this.update(this._lastState);
    ++this.diagnostics.starts;
    try { await resumed; }
    catch (error) { ++this.diagnostics.resumeFailures; throw error; }
    return this;
  }

  async pause() {
    this._wanted = false;
    const epoch = ++this._epoch;
    const context = this.ctx;
    if (!context || context.state === 'closed') return;
    this._ramp(this.master.gain, 0, 0.025);
    // Suspend immediately (no timer race with a subsequent play gesture).
    await context.suspend();
    // A play gesture may have resumed while suspend was pending.
    if (epoch !== this._epoch && this._wanted && context.state === 'suspended') {
      await context.resume();
    }
  }

  reset() {
    ++this.diagnostics.replays;
    this._discardRun();
    this._lastTime = null;
    this._lastSpeed = 0;
    this._load = 0;
    // Preserve player preferences, never an audible source from the previous trip.
    if (this._lastState) this._lastState = { ...this._lastState, time: 0, heard: null, speed: 0 };
    // Do not resume, create a context, or start an animation/timer from reset.
  }

  update(s = {}) {
    this._lastState = s;
    const context = this.ctx;
    if (!context || context.state === 'closed' || !this._wanted) return;
    const driveTime = finite(s.time);
    // Also guard callers which rewind the simulation without calling reset().
    if (this._lastTime !== null && driveTime < this._lastTime - 0.25) {
      this.reset();
      this._lastState = s;
    }
    if (!this._run) this._buildRun();
    const r = this._run;
    const now = context.currentTime;
    const speed = clamp(finite(s.speed), 0, 40);
    const dt = this._lastTime === null ? 1 / 60 : clamp(driveTime - this._lastTime, 1 / 240, 0.1);
    const acceleration = this._lastTime === null ? 0 : clamp((speed - this._lastSpeed) / dt, -9, 5);
    this._load += (acceleration - this._load) * (1 - Math.exp(-dt * 3));
    this._lastTime = driveTime;
    this._lastSpeed = speed;
    const outside=!!s.onFoot, carDistance=outside&&s.car&&s.person?Math.hypot(s.car.x-s.person.x,s.car.z-s.person.z):0;
    const proximity=outside?.32/(1+carDistance*.24):1;
    const opening = outside||s.windowOpen ? 1 : 0;
    const v = speed / 32;
    const trim = name => clamp(finite(this.levels[name], 1), 0, 2);

    this._ramp(this.master.gain, s.muted ? 0 : clamp(finite(s.volume, 0.65), 0, 1) * 0.9, 0.045);
    // A warm low-rev engine, not a racing shift loop. The slow load term follows
    // acceleration/braking; road texture stops at rest instead of hissing forever.
    const firing = 29 + speed * 1.12 + Math.max(0, this._load) * 1.8;
    this._param(r.engineA.frequency, firing, 0.22);
    this._param(r.engineB.frequency, firing * 0.5015, 0.25);
    this._param(r.engineFilter.frequency, 270 + speed * 13 + Math.max(0, this._load) * 35, 0.25);
    this._param(r.engineGain.gain, (0.033 + v * 0.024 + Math.max(0, this._load) * 0.002) * trim('engine') * proximity, 0.25);
    this._param(r.tireGain.gain, Math.pow(v, 1.18) * (0.24 + opening * 0.032) * trim('tires'), 0.28);
    this._param(r.tireFilter.frequency, (520 + speed * 33) * (1 + opening * 0.7), 0.28);
    this._param(r.tireSource.playbackRate, 0.73 + speed * 0.015, 0.3);
    this._param(r.windGain.gain, (0.003 + Math.pow(v, 1.65) * (0.022 + opening * 0.093)) * trim('wind'), 0.35);
    this._param(r.windFilter.frequency, 720 + opening * 1900 + speed * 13, 0.3);

    const h = s.heard;
    const arrived = h && Number.isFinite(h.age) && h.age >= 0 && Number.isFinite(h.distance) && h.distance >= 0;
    let strength = 0;
    if (arrived) {
      if (!r.rocket) this._buildRocket(h);
      const rocket = r.rocket;
      const age = clamp(h.age, 0, 3600);
      const distance = Math.max(1, h.distance);
      const rate = clamp(finite(h.rate, 1), 0.32, 1.4);
      const pan = clamp(finite(h.pan), -1, 1);
      const elevation = clamp(finite(h.elev), -Math.PI / 2, Math.PI / 2);
      const headElevation = clamp(elevation - finite(s.pitch), -1.45, 1.45);
      // Retarded age drives ignition, texture and burnout. Visual t is NEVER used.
      // s.heard already solves d/343: a DelayNode here would delay it twice.
      const ignition = (1 - Math.exp(-age / 0.34)) * (0.52 + 0.48 * smooth(0, 4.5, age));
      const recession = Math.pow(3300 / (3300 + Math.max(0, distance - 1600)), 0.86);
      const burning = Math.exp(-Math.max(0, age - 44) * 0.013);
      strength = ignition * recession * burning;
      const rolling = 0.94 + 0.035 * Math.sin(age * 0.91) + 0.025 * Math.sin(age * 2.31);
      this._param(rocket.gate.gain, strength * rolling * 1.6 * trim('rocket'), 0.12);
      // Two broad, asynchronous turbulent fields, a low pressure bed, and soft
      // clustered crackle. Never a triggered boom, impulse, or isolated shock.
      for (const source of rocket.sources) this._param(source.playbackRate, rate, 0.3);
      this._param(rocket.low.frequency, (146 + 20 * Math.sin(age * 0.23)) * Math.sqrt(rate), 0.4);
      this._param(rocket.body.frequency, (690 + 170 * Math.sin(age * 0.17)) * rate, 0.35);
      const air = clamp(3200 * Math.exp(-distance / 10500), 760, 3100);
      this._param(rocket.air.frequency, air * (0.91 + 0.09 * Math.cos(headElevation)), 0.28);
      this._param(rocket.glass.frequency, opening ? 4400 : 610, 0.23);
      this._param(rocket.glassGain.gain, opening ? 1 : 0.68, 0.23);
      this._param(rocket.lowGain.gain, opening ? 0.91 : 0.82, 0.3);
      // Bass remains broad and speaker-friendly; the body carries a clear bearing.
      this._param(rocket.lowPan.pan, pan * 0.52, 0.13);
      this._param(rocket.bodyPan.pan, pan * 0.94, 0.13);
      this._param(rocket.diffusePan.pan, pan * 0.48 - 0.12, 0.24);
      const y = Math.sin(headElevation);
      const x = clamp(pan, -Math.sqrt(Math.max(0, 1 - y * y)), Math.sqrt(Math.max(0, 1 - y * y)));
      const z = -Math.sqrt(Math.max(0.0001, 1 - x * x - y * y));
      this._position(rocket.spatial, x, y, z);
      this._param(rocket.height.frequency, 1500 + Math.abs(headElevation) * 1300, 0.3);
      this._param(rocket.height.gain, -2 - Math.abs(headElevation) * 2.5, 0.3);
    } else if (r.rocket) {
      this._ramp(r.rocket.gate.gain, 0, 0.18);
    }
    // Independent music slider and slow duck: the score never fights the launch.
    const musicOn = s.music !== false;
    this._param(r.musicGain.gain, musicOn ? clamp(finite(this.radio.level, 0.68), 0, 1) * trim('music') * proximity : 0, 0.16);
    this._param(r.musicDuck.gain, 1 - clamp(strength * 1.1, 0, 0.65), 0.7);
    this._scheduleMusic(now, musicOn);
  }

  _param(param, value, time = 0.15) {
    if (!Number.isFinite(value) || this._targets.get(param) === value) return;
    const now = this.ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, Math.max(0.004, time));
    this._targets.set(param, value);
  }

  _ramp(param, value, time) {
    if (this._targets.get(param) === value) return;
    const now = this.ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.linearRampToValueAtTime(value, now + time);
    this._targets.set(param, value);
  }

  _buildMaster() {
    const c = this.ctx;
    this._input = c.createGain();
    const dc = c.createBiquadFilter(); dc.type = 'highpass'; dc.frequency.value = 27; dc.Q.value = 0.55;
    const top = c.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 7100; top.Q.value = 0.5;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -17; glue.knee.value = 12; glue.ratio.value = 2.2;
    glue.attack.value = 0.018; glue.release.value = 0.32;
    const compensate = c.createGain(); compensate.gain.value = 0.76;
    const ceiling = c.createWaveShaper();
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; ++i) {
      const x = i * 2 / (curve.length - 1) - 1, a = Math.abs(x);
      // Unity slope at ordinary levels; never adds gain. Bounded below 0 dBFS.
      curve[i] = Math.sign(x) * (a <= 0.6 ? a : 0.6 + 0.18 * Math.tanh((a - 0.6) / 0.18));
    }
    ceiling.curve = curve; ceiling.oversample = '2x';
    this.master = c.createGain(); this.master.gain.value = 0;
    this._input.connect(dc).connect(top).connect(glue).connect(compensate).connect(ceiling).connect(this.master).connect(c.destination);
    this._masterNodes = [this._input, dc, top, glue, compensate, ceiling, this.master];
    this._engineWave = c.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.34, 0.17, 0.12, 0.05, 0.025]));
    this._radioWave = c.createPeriodicWave(new Float32Array(5), new Float32Array([0, 1, 0.22, 0.075, 0.02]));
  }

  _node(type) { const node = this.ctx[type](); this._run.nodes.add(node); return node; }
  _gain(value = 1) { const n = this._node('createGain'); n.gain.value = value; return n; }
  _filter(type, frequency, q = 0.65) { const n = this._node('createBiquadFilter'); n.type = type; n.frequency.value = frequency; n.Q.value = q; return n; }
  _pan(value = 0) { const n = this._node('createStereoPanner'); n.pan.value = value; return n; }

  _track(source, when = this.ctx.currentTime, offset) {
    const run = this._run;
    run.sources.add(source);
    source.onended = () => { run.sources.delete(source); source.disconnect(); };
    if (offset === undefined) source.start(when); else source.start(when, offset);
    ++this.diagnostics.sourcesStarted;
    return source;
  }

  _noise(kind, seconds, seed) {
    const key = `${kind}/${seconds}/${seed}`;
    if (this._buffers.has(key)) return this._buffers.get(key);
    // 22.05 kHz is ample for the deliberately dark palette and small on phones.
    const rate = 22050, length = Math.round(seconds * rate), fold = Math.round(rate * 0.16);
    const raw = new Float32Array(length + fold);
    let state = seed >>> 0, a = 0, b = 0, d = 0, env = 0.3, from = 0.3, to = 0.3, phase = 1, step = 1;
    const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    for (let i = 0; i < raw.length; ++i) {
      const white = random() * 2 - 1;
      a = 0.99765 * a + white * 0.099046;
      b = 0.963 * b + white * 0.296516;
      d = 0.57 * d + white * 1.052692;
      let sample = (a + b + d + white * 0.1848) * 0.16;
      if (kind === 'air') sample = sample * 0.5 + white * 0.25;
      if (kind === 'crackle') {
        if (phase >= 1) { from = to; to = Math.pow(random(), 2); phase = 0; step = 1 / (rate * (0.025 + random() * 0.12)); }
        phase += step;
        env = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.min(1, phase) * Math.PI));
        sample = Math.tanh((sample * 0.7 + white * 0.16) * (0.6 + env * 3.4)) * 0.55;
      }
      raw[i] = sample;
    }
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let energy = 0;
    for (let i = 0; i < length; ++i) {
      const blend = i < fold ? 0.5 - 0.5 * Math.cos(Math.PI * i / fold) : 1;
      data[i] = i < fold ? raw[i] * blend + raw[length + i] * (1 - blend) : raw[i];
      energy += data[i] * data[i];
    }
    const scale = 0.235 / Math.sqrt(energy / length);
    for (let i = 0; i < length; ++i) data[i] = Math.tanh(data[i] * scale / 0.88) * 0.88;
    this._buffers.set(key, buffer);
    return buffer;
  }

  _loop(kind, seconds, seed, offset = 0) {
    const source = this.ctx.createBufferSource();
    source.buffer = this._noise(kind, seconds, seed); source.loop = true;
    return this._track(source, this.ctx.currentTime, ((offset % seconds) + seconds) % seconds);
  }

  _buildRun() {
    this._run = { nodes: new Set(), sources: new Set(), voices: new Set(), rocket: null };
    const r = this._run, c = this.ctx;
    r.output = this._gain(0); r.output.connect(this._input);
    this._ramp(r.output.gain, 1, 0.06);
    r.engineGain = this._gain(0.033);
    r.engineFilter = this._filter('lowpass', 420);
    const motorHigh = this._filter('highpass', 35), motorPan = this._pan(-0.08);
    r.engineA = c.createOscillator(); r.engineA.setPeriodicWave(this._engineWave); r.engineA.frequency.value = 47;
    r.engineB = c.createOscillator(); r.engineB.type = 'sine'; r.engineB.frequency.value = 24;
    const halfGain = this._gain(0.38);
    this._track(r.engineA).connect(r.engineFilter);
    this._track(r.engineB).connect(halfGain).connect(r.engineFilter);
    r.engineFilter.connect(motorHigh).connect(r.engineGain).connect(motorPan).connect(r.output);

    r.tireSource = this._loop('pink', 13.7, 0x271828, 4.3);
    r.tireFilter = this._filter('lowpass', 1000);
    r.tireGain = this._gain(0);
    const tireHigh = this._filter('highpass', 155), tirePan = this._pan(-0.22);
    r.tireSource.connect(tireHigh).connect(r.tireFilter).connect(r.tireGain).connect(tirePan).connect(r.output);
    const roadRight = this._node('createDelay'); roadRight.delayTime.value = 0.021;
    const roadRightGain = this._gain(0.52), roadRightPan = this._pan(0.57);
    r.tireGain.connect(roadRight).connect(roadRightGain).connect(roadRightPan).connect(r.output);

    r.windFilter = this._filter('lowpass', 1000);
    r.windGain = this._gain(0);
    const windHigh = this._filter('highpass', 230), windPan = this._pan(0.35);
    this._loop('air', 17.3, 0x314159, 7.9).connect(windHigh).connect(r.windFilter).connect(r.windGain).connect(windPan).connect(r.output);

    r.musicInput = this._gain(1);
    const radioHigh = this._filter('highpass', 130), radioLow = this._filter('lowpass', 2300, 0.55);
    const radioColor = this._filter('peaking', 780, 0.65); radioColor.gain.value = 1.5;
    r.musicGain = this._gain(0); r.musicDuck = this._gain(1);
    const radioPan = this._pan(0.08);
    r.musicInput.connect(radioHigh).connect(radioLow).connect(radioColor).connect(r.musicGain).connect(r.musicDuck).connect(radioPan).connect(r.output);
    const echo = this._node('createDelay'); echo.delayTime.value = 0.31;
    const echoGain = this._gain(0.17);
    r.musicInput.connect(echo).connect(echoGain).connect(radioHigh);
    r.nextBeat = c.currentTime + 0.015;
    r.beat = 0;
    // Prime immediately: the first press has engine and radio, even before a RAF.
    this._param(r.musicGain.gain, this._lastState?.music === false ? 0 : clamp(finite(this.radio.level, 0.68), 0, 1), 0.1);
    this._scheduleMusic(c.currentTime, this._lastState?.music !== false);
    // Prepare texture data at boot, not on the arrival frame. These buffers
    // make no sound: the rocket's sources and gate still do not exist yet.
    this._noise('pink', 19.1, 0x71ce5);
    this._noise('pink', 11.9, 0x5eabed);
    this._noise('crackle', 17.9, 0x1a7c4);
  }

  _buildRocket(heard) {
    const r = this._run;
    const age = clamp(heard.age, 0, 3600);
    const q = r.rocket = {};
    q.gate = this._gain(0); q.gate.connect(r.output);
    q.low = this._filter('lowpass', 150, 0.75);
    q.lowGain = this._gain(0.82); q.lowPan = this._pan(0);
    const subHigh = this._filter('highpass', 31, 0.55);
    const sub = this._loop('pink', 19.1, 0x71ce5, age);
    sub.connect(subHigh).connect(q.low).connect(q.lowGain).connect(q.lowPan).connect(q.gate);

    q.body = this._filter('lowpass', 700, 0.65); q.bodyPan = this._pan(0);
    const bodyHigh = this._filter('highpass', 100, 0.55);
    const bodyWarmth = this._filter('lowshelf', 310); bodyWarmth.gain.value = 3;
    const bodyGain = this._gain(0.98);
    q.glass = this._filter('lowpass', 610, 0.55); q.glassGain = this._gain(0.68);
    q.glass.connect(q.glassGain).connect(q.gate);
    const body = this._loop('pink', 11.9, 0x5eabed, age * 0.93 + 3);
    body.connect(bodyHigh).connect(bodyWarmth).connect(q.body).connect(bodyGain).connect(q.bodyPan).connect(q.glass);

    q.air = this._filter('lowpass', 2000, 0.5);
    const crackHigh = this._filter('highpass', 280, 0.5), crackGain = this._gain(0.63);
    q.height = this._filter('peaking', 1700, 0.65); q.height.gain.value = -2;
    q.spatial = this._node('createPanner');
    q.spatial.panningModel = 'HRTF'; q.spatial.distanceModel = 'inverse';
    q.spatial.refDistance = 1; q.spatial.rolloffFactor = 0;
    q.spatial.positionZ.value = -1;
    const crackle = this._loop('crackle', 17.9, 0x1a7c4, age * 1.07 + 5);
    crackle.connect(crackHigh).connect(q.air).connect(q.height).connect(crackGain).connect(q.spatial).connect(q.glass);

    // Short, non-feedback ground diffusion, not the source propagation delay.
    const diffusion = this._node('createDelay'); diffusion.delayTime.value = 0.173;
    const diffuseLow = this._filter('lowpass', 520, 0.55), diffuseGain = this._gain(0.17);
    q.diffusePan = this._pan(0.1);
    bodyGain.connect(diffusion).connect(diffuseLow).connect(diffuseGain).connect(q.diffusePan).connect(q.glass);
    q.sources = [sub, body, crackle];
  }

  _position(node, x, y, z) {
    this._param(node.positionX, x, 0.14);
    this._param(node.positionY, y, 0.14);
    this._param(node.positionZ, z, 0.14);
  }

  _scheduleMusic(now, enabled) {
    const r = this._run;
    const beatLength = 60 / clamp(finite(this.radio.bpm, 76), 48, 100);
    const transpose = clamp(Math.round(finite(this.radio.transpose)), -12, 12);
    // A stalled frame skips missed beats, rather than playing a catch-up chord pile.
    if (r.nextBeat < now - 0.12) {
      const missed = Math.ceil((now - r.nextBeat) / beatLength);
      r.nextBeat += missed * beatLength; r.beat += missed;
    }
    while (r.nextBeat < now + 0.16) {
      const beat = r.beat, when = Math.max(now + 0.004, r.nextBeat);
      if (enabled) {
        const chord = CHORDS[Math.floor(beat / 8) % CHORDS.length];
        if (beat % 8 === 0) chord.forEach((note, i) => this._note(note + 12 + transpose, when, beatLength * 7.7, 0.009, 'pad', (i - 1.5) * 0.1));
        if (beat % 2 === 0) this._note(chord[0] + transpose, when, beatLength * 1.8, 0.017, 'bass', -0.05);
        const note = MELODY[beat % MELODY.length];
        if (note !== null) this._note(note + transpose + (Math.floor(beat / 32) % 2 ? -12 : 0), when + beatLength * 0.08, beatLength * 1.65, 0.025, 'bell', 0.12);
      }
      r.nextBeat += beatLength; ++r.beat;
    }
  }

  _note(note, when, duration, level, kind, pan) {
    const r = this._run, c = this.ctx;
    if (r.voices.size >= 24) return;
    const oscillator = c.createOscillator(), envelope = c.createGain(), stereo = c.createStereoPanner();
    if (kind === 'bass') oscillator.type = 'sine'; else oscillator.setPeriodicWave(this._radioWave);
    oscillator.frequency.value = midi(note);
    oscillator.detune.value = kind === 'pad' ? Math.sin(note * 2.13) * 3.5 : 0;
    stereo.pan.value = pan;
    const attack = kind === 'pad' ? 0.45 : kind === 'bell' ? 0.025 : 0.07;
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(level, when + attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * (kind === 'pad' ? 0.68 : 0.16)), when + duration * 0.72);
    envelope.gain.linearRampToValueAtTime(0, when + duration);
    oscillator.connect(envelope).connect(stereo).connect(r.musicInput);
    r.voices.add(oscillator);
    this._track(oscillator, when);
    oscillator.onended = () => { r.sources.delete(oscillator); r.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); stereo.disconnect(); };
    oscillator.stop(when + duration + 0.01);
  }

  _discardRun() {
    const r = this._run;
    if (!r || !this.ctx) return;
    this._run = null;
    const now = this.ctx.currentTime;
    const running = this.ctx.state === 'running';
    const sources = [...r.sources];
    const disconnect = () => {
      for (const node of r.nodes) node.disconnect();
      for (const source of sources) source.disconnect();
      r.nodes.clear(); r.sources.clear(); r.voices.clear();
    };
    // Use the audio clock to fade and end the old graph. This keeps replay clicks
    // out, preserves attached master recorders, and needs no wall-clock timers.
    this._ramp(r.output.gain, 0, running ? 0.018 : 0.001);
    if (running && sources.length) {
      const anchor = sources[0], ended = anchor.onended;
      anchor.onended = () => { if (ended) ended(); disconnect(); };
    }
    for (const source of sources) {
      try { source.stop(now + (running ? 0.025 : 0)); } catch (_) { /* Already ended. */ }
    }
    if (!running || !sources.length) disconnect();
  }
}
