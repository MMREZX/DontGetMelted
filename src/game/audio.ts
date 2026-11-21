import { DEFAULT_AUDIO_SETTINGS } from './save';
import type { AudioSettings, BiomeId, CharacterId, TripId } from './types';

function jitter(base: number, pct = 0.06): number {
  return base * (1 + (Math.random() * 2 - 1) * pct);
}

export class FunkAudio {
  private ctx: AudioContext | null = null;
  private pendingNotes = new Set<ReturnType<typeof setTimeout>>();
  public settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private beatTimer = 0;
  private ambTimer = 0;
  private heartbeatTimer = 0;
  private step = 0;
  private lastDryerWarn = false;
  private lastRattleTimer = 0;

  private readonly bassNotes = [110, 110, 130.81, 146.83, 164.81, 146.83, 130.81, 98.0];
  private readonly arpNotes = [261.63, 329.63, 392.0, 493.88, 523.25, 392.0];

  public get muted(): boolean {
    return this.settings.muted;
  }

  public set muted(val: boolean) {
    this.settings.muted = val;
  }

  public applySettings(next: AudioSettings): void {
    this.settings = { ...next };
  }

  public unlock(): void {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio unlock errors in headless browsers
    }
  }

  private scheduleNote(play: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.pendingNotes.delete(timer);
      play();
    }, delay);
    this.pendingNotes.add(timer);
  }

  public reset(): void {
    for (const timer of this.pendingNotes) clearTimeout(timer);
    this.pendingNotes.clear();
    this.beatTimer = 0;
    this.ambTimer = 0;
    this.heartbeatTimer = 0;
    this.step = 0;
    this.lastDryerWarn = false;
    this.lastRattleTimer = 0;
  }

  public destroy(): void {
    this.reset();
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
  }

  private channelGain(channel: 'music' | 'ambience' | 'effects'): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings[channel]));
  }

  public tone(
    freq: number,
    dur = 0.12,
    type: OscillatorType = 'triangle',
    vol = 0.11,
    slideTo?: number,
    channel: 'music' | 'ambience' | 'effects' = 'effects',
  ): void {
    const chVol = this.channelGain(channel);
    if (chVol <= 0.001 || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, freq), t);
      if (slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      }
      const peak = vol * chVol;
      gain.gain.setValueAtTime(0.0008, t);
      gain.gain.linearRampToValueAtTime(peak, t + Math.min(0.015, dur * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.012);
    } catch {
      // Safe fallback
    }
  }

  public boop(): void {
    this.tone(jitter(370), 0.09, 'sine', 0.13, jitter(620), 'effects');
  }

  public harvest(): void {
    this.tone(jitter(420), 0.1, 'triangle', 0.12, jitter(760), 'effects');
    this.scheduleNote(() => this.tone(jitter(640), 0.11, 'sine', 0.09, jitter(940), 'effects'), 50);
  }

  public heavyHit(): void {
    this.tone(jitter(165), 0.14, 'sawtooth', 0.14, 58, 'effects');
    this.tone(jitter(320), 0.07, 'square', 0.07, 120, 'effects');
  }

  public telegraph(): void {
    this.tone(jitter(380, 0.04), 0.22, 'triangle', 0.08, 690, 'effects');
  }

  public honk(): void {
    this.tone(jitter(240, 0.05), 0.13, 'sawtooth', 0.09, 185, 'effects');
    this.scheduleNote(() => this.tone(jitter(268, 0.05), 0.11, 'sawtooth', 0.08, 205, 'effects'), 85);
  }

  public trip(): void {
    const seq = [261.6, 349.2, 493.9, 659.3];
    seq.forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.17, 'sine', 0.09, f * 1.28, 'effects'), i * 55);
    });
  }

  public tripFor(tripId: TripId): void {
    if (tripId === 'prism_refract') {
      // Sparkling crystalline glass-prism arpeggio
      [783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
        this.scheduleNote(() => this.tone(f, 0.22, 'sine', 0.085, f * 1.03, 'effects'), i * 48);
      });
    } else if (tripId === 'velvet_fog') {
      // Deep melting tape-warble drop
      this.tone(240, 0.36, 'triangle', 0.11, 138, 'effects');
      this.scheduleNote(() => this.tone(185, 0.34, 'sine', 0.09, 118, 'effects'), 120);
    } else if (tripId === 'chrono') {
      // Descending time-dilation clock chime
      [660, 495, 330].forEach((f, i) => {
        this.scheduleNote(() => this.tone(f, 0.24, 'triangle', 0.09, f * 0.85, 'effects'), i * 75);
      });
    } else if (tripId === 'floaty') {
      // Bubbly rising helium pops
      [420, 560, 740, 980].forEach((f, i) => {
        this.scheduleNote(() => this.tone(f, 0.11, 'sine', 0.08, f * 1.35, 'effects'), i * 42);
      });
    } else if (tripId === 'synesthesia') {
      // Bright Rhodes chord bloom
      [329.63, 415.3, 493.88, 622.25].forEach((f, i) => {
        this.scheduleNote(() => this.tone(f, 0.24, 'triangle', 0.08, undefined, 'effects'), i * 35);
      });
    } else if (tripId === 'cosmic') {
      // Deep astral fifth drone
      this.tone(196, 0.42, 'sine', 0.1, 293.66, 'effects');
      this.scheduleNote(() => this.tone(392, 0.35, 'triangle', 0.075, 587.33, 'effects'), 90);
    } else if (tripId === 'disco') {
      // Funky octave slap synth
      [146.83, 293.66, 220, 440, 587.33].forEach((f, i) => {
        this.scheduleNote(() => this.tone(f, 0.13, 'sawtooth', 0.075, undefined, 'effects'), i * 48);
      });
    } else {
      this.trip();
    }
  }

  public groundingSigh(): void {
    // Warm, steady resolving triad when Boring Decaf calms a Bad Trip
    [392.0, 329.63, 261.63].forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.28, 'sine', 0.085, f * 0.99, 'effects'), i * 70);
    });
  }

  public heartbeat(intensity: number): void {
    const vol = 0.055 + intensity * 0.075;
    this.tone(68, 0.11, 'sine', vol, 46, 'ambience');
    this.scheduleNote(() => this.tone(62, 0.09, 'sine', vol * 0.72, 42, 'ambience'), 175);
  }

  public ding(): void {
    this.tone(jitter(840, 0.03), 0.18, 'triangle', 0.11, 1260, 'effects');
  }

  public glassChime(): void {
    // Prism Orchard ripe Lens-Pear tapped glass harmonic
    this.tone(jitter(1174.66, 0.02), 0.28, 'sine', 0.09, 1188, 'effects');
    this.scheduleNote(() => this.tone(jitter(1567.98, 0.02), 0.24, 'sine', 0.06, 1580, 'effects'), 65);
  }

  public dryerKnock(): void {
    // Unpaired Sea double dryer knock warning before wind gusts shift
    this.tone(145, 0.07, 'triangle', 0.12, 86, 'ambience');
    this.scheduleNote(() => this.tone(152, 0.07, 'triangle', 0.12, 84, 'ambience'), 175);
  }

  public radioJingle(repaired: boolean): void {
    // 2 broken notes before repair; full 3-note warm motif once Radio Unmelted is restored
    this.tone(440, 0.16, 'triangle', 0.1, 440, 'music');
    this.scheduleNote(() => this.tone(554.37, 0.16, 'triangle', 0.1, 554.37, 'music'), 190);
    if (repaired) {
      this.scheduleNote(() => this.tone(659.25, 0.34, 'sine', 0.12, 668, 'music'), 380);
    } else {
      this.scheduleNote(() => this.tone(210, 0.11, 'sawtooth', 0.05, 165, 'ambience'), 380);
    }
  }

  public corkSqueak(): void {
    // Reed rod cork grip creaking under line load
    this.tone(jitter(540, 0.04), 0.08, 'triangle', 0.09, jitter(760, 0.04), 'effects');
    this.scheduleNote(() => this.tone(jitter(680, 0.04), 0.07, 'sine', 0.07, jitter(490, 0.04), 'effects'), 55);
  }

  public waterPlop(strong = false): void {
    this.tone(strong ? 260 : 340, strong ? 0.14 : 0.08, 'sine', strong ? 0.13 : 0.08, strong ? 640 : 520, 'effects');
  }

  public ferryTwoNoteCall(): void {
    // Capt. Nix's warm two-note brass ferry departure call after dusk
    this.tone(220.0, 0.34, 'triangle', 0.1, 218, 'music');
    this.scheduleNote(() => this.tone(293.66, 0.46, 'triangle', 0.11, 290, 'music'), 320);
  }

  public tuningForkChord(): void {
    // Pure harmonic fifth ringing across Undertone Caverns
    this.tone(440, 0.55, 'sine', 0.11, 440, 'music');
    this.scheduleNote(() => this.tone(659.25, 0.52, 'sine', 0.085, 659.25, 'music'), 90);
    this.scheduleNote(() => this.tone(880, 0.45, 'triangle', 0.065, 880, 'music'), 190);
  }

  public pressStamp(): void {
    // Negative Coast litho-press thump + crisp ink hiss
    this.tone(132, 0.14, 'square', 0.11, 74, 'effects');
    this.scheduleNote(() => this.tone(840, 0.11, 'triangle', 0.075, 520, 'effects'), 95);
  }

  public gutterSplash(): void {
    // Inverted Allotments upward water-chime splash
    [330, 440, 587.33, 783.99].forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.14, 'sine', 0.08, f * 1.15, 'effects'), i * 52);
    });
  }

  public playStationMotif(stationIdx: number): void {
    // 4-station retro tracker motifs for the All-Night County Broadcast tuner
    const motifs: Array<{ wave: OscillatorType; notes: number[] }> = [
      { wave: 'triangle', notes: [261.63, 329.63, 392.0, 523.25] }, // 88.1 Grove Hearth
      { wave: 'sine', notes: [220.0, 293.66, 329.63, 440.0] }, // 94.5 Delta Ferry & Tide
      { wave: 'square', notes: [329.63, 392.0, 493.88, 659.25] }, // 101.3 Undertone Moth Choir
      { wave: 'triangle', notes: [349.23, 440.0, 523.25, 698.46] }, // 107.9 Cloud-9 & Allotments
    ];
    const m = motifs[((stationIdx % motifs.length) + motifs.length) % motifs.length];
    m.notes.forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.2, m.wave, 0.09, f * 1.01, 'music'), i * 115);
    });
  }

  public leadStep(charId: CharacterId, lowVibe: boolean): void {
    if (charId === 'pip') {
      this.tone(jitter(720, 0.04), 0.05, 'sine', 0.035, 810, 'effects');
    } else if (charId === 'barnaby') {
      // Subtle porcelain clink; rattles softly when Vibe is low!
      this.tone(jitter(1320, 0.04), 0.045, 'sine', lowVibe ? 0.075 : 0.04, 1480, 'effects');
      if (lowVibe) {
        this.scheduleNote(() => this.tone(jitter(1520, 0.05), 0.04, 'sine', 0.06, 1380, 'effects'), 48);
      }
    } else if (charId === 'djmoss') {
      this.tone(jitter(96, 0.04), 0.07, 'triangle', 0.05, 74, 'effects');
    } else if (charId === 'gerald') {
      this.tone(jitter(460, 0.03), 0.04, 'square', 0.03, 390, 'effects');
    } else if (charId === 'tilda') {
      this.tone(jitter(920, 0.05), 0.04, 'triangle', 0.032, 680, 'effects');
    } else if (charId === 'brin') {
      this.tone(jitter(580, 0.04), 0.045, 'sine', 0.035, 650, 'effects');
    } else if (charId === 'solfa') {
      this.tone(jitter(660, 0.05), 0.05, 'sine', 0.034, 790, 'effects');
    } else if (charId === 'marlo') {
      this.tone(jitter(410, 0.04), 0.05, 'triangle', 0.032, 340, 'effects');
    } else if (charId === 'bea') {
      this.tone(jitter(1120, 0.04), 0.04, 'sine', 0.038, 1260, 'effects');
    } else if (charId === 'gus') {
      this.tone(jitter(820, 0.04), 0.05, 'triangle', 0.038, 980, 'effects');
    } else if (charId === 'nori') {
      this.tone(jitter(1420, 0.03), 0.045, 'sine', 0.035, 1520, 'effects');
    } else if (charId === 'mossie') {
      this.tone(jitter(310, 0.05), 0.06, 'sine', 0.038, 410, 'effects');
    }
  }

  public questFanfare(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.22, 'triangle', 0.11, undefined, 'effects'), i * 80);
    });
  }

  public roll(): void {
    this.tone(jitter(520), 0.15, 'sine', 0.1, 180, 'effects');
  }

  public hurt(): void {
    this.tone(190, 0.2, 'sawtooth', 0.14, 65, 'effects');
  }

  public defeat(): void {
    [320, 260, 200, 130].forEach((f, i) => {
      this.scheduleNote(() => this.tone(f, 0.24, 'sawtooth', 0.1, f * 0.78, 'effects'), i * 110);
    });
  }

  public tickRegionalAudio(
    dt: number,
    biomeId: BiomeId,
    wobble: number,
    isChrono: boolean,
    isHyper: boolean,
    isNight: boolean,
    opts: {
      radioRepaired: boolean;
      compressorSilent: boolean;
      dryerKnockWarning: boolean;
      barnabyLowVibe: boolean;
      badTripIntensity?: number;
      dominantTrip?: TripId | null;
    },
  ): void {
    if (this.settings.muted || !this.ctx || this.ctx.state !== 'running') return;
    const bad = opts.badTripIntensity ?? 0;

    // Bad Trip pounding heartbeat + uneasy detuned shimmer
    if (bad > 0.35) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = Math.max(0.56, 1.05 - bad * 0.45);
        this.heartbeat(bad);
      }
    }

    // Barnaby porcelain soft rattle when Vibe is low
    if (opts.barnabyLowVibe) {
      this.lastRattleTimer -= dt;
      if (this.lastRattleTimer <= 0) {
        this.lastRattleTimer = 1.45;
        this.leadStep('barnaby', true);
      }
    }

    // Trigger dryer double-knock right on rising edge of Unpaired Sea warning
    if (biomeId === 'unpaired_sea' && opts.dryerKnockWarning && !this.lastDryerWarn) {
      this.dryerKnock();
    }
    this.lastDryerWarn = biomeId === 'unpaired_sea' && opts.dryerKnockWarning;

    // Regional musical pulse
    const tempo = isChrono
      ? 0.46
      : isHyper
        ? 0.17
        : bad > 0.4
          ? Math.max(0.18, 0.28 - bad * 0.08)
          : Math.max(0.21, 0.33 - (wobble / 100) * 0.07);
    this.beatTimer += dt;
    if (this.beatTimer >= tempo) {
      this.beatTimer = 0;
      const base = this.bassNotes[this.step % this.bassNotes.length];
      const badDetune = bad > 0.25 ? 1 + Math.sin(this.step * 2.9) * 0.075 * bad : 1;
      const detune = (wobble > 35 ? 1 + Math.sin(this.step * 1.7) * 0.022 * (wobble / 100) : 1) * badDetune;
      const nightScale = isNight ? 0.56 : 1;

      if (bad > 0.48) {
        // Uneasy detuned tritone spiral motif during a full Bad Trip
        const eerie = [110, 155.56, 103.83, 146.83, 98.0, 138.59];
        const note = eerie[this.step % eerie.length] * detune;
        this.tone(note, tempo * 0.85, 'sawtooth', 0.024 + bad * 0.015, note * 0.94, 'music');
      } else if (opts.dominantTrip === 'prism_refract') {
        const prismScale = [587.33, 739.99, 880, 1174.66, 987.77, 1318.51];
        const note = prismScale[this.step % prismScale.length] * detune;
        this.tone(note, 0.18, 'sine', 0.028, note * 1.015, 'music');
      } else if (opts.dominantTrip === 'velvet_fog') {
        const velvetScale = [164.81, 196.0, 220.0, 185.0, 146.83];
        const note = velvetScale[this.step % velvetScale.length] * detune;
        this.tone(note, tempo * 0.95, 'triangle', 0.03, note * 0.97, 'music');
      } else if (biomeId === 'prism_orchard') {
        const glassScale = [523.25, 587.33, 659.25, 783.99, 987.77, 1046.5];
        const note = glassScale[this.step % glassScale.length];
        this.tone(note * detune, 0.19, 'sine', 0.028, note * 1.01, 'music');
      } else if (biomeId === 'wickwater_afterhours') {
        const bellScale = [293.66, 349.23, 440, 392, 329.63, 261.63];
        const note = bellScale[this.step % bellScale.length] * 0.992; // gentle detuned bell
        this.tone(note, 0.32, 'sine', 0.032, note * 0.99, 'music');
      } else if (biomeId === 'carbon_copy_delta' || biomeId === 'bureaucracy_bog') {
        // Stamp percussion rhythm
        if (this.step % 2 === 0) {
          this.tone(118 * nightScale, 0.08, 'square', 0.024, 72, 'music');
        } else {
          this.tone(base * 1.5 * detune * nightScale, 0.11, 'triangle', 0.026, undefined, 'music');
        }
      } else if (biomeId === 'dead_air_basin' || biomeId === 'vinyl_desert') {
        const vinylNotes = opts.radioRepaired ? [220, 277.18, 329.63, 440] : [220, 277.18, 220, 277.18];
        const note = vinylNotes[this.step % vinylNotes.length];
        this.tone(note * detune * nightScale, tempo * 0.65, 'triangle', 0.03, undefined, 'music');
      } else if (biomeId === 'midnight_defrost' || biomeId === 'great_fridge') {
        if (opts.compressorSilent) {
          // Serene enamel drips
          if (this.step % 2 === 0) {
            const drip = [783.99, 659.25, 987.77, 880][this.step % 4];
            this.tone(drip, 0.16, 'sine', 0.025, drip * 1.08, 'music');
          }
        } else {
          // Low freezer compressor hum
          this.tone(68, tempo * 0.9, 'sawtooth', 0.022, 66, 'music');
        }
      } else if (biomeId === 'undertone_caverns') {
        const choir = [220, 329.63, 440, 329.63, 293.66, 440];
        const note = choir[this.step % choir.length] * detune;
        this.tone(note, 0.3, 'sine', 0.032, note * 1.005, 'music');
      } else if (biomeId === 'negative_coast') {
        const negScale = [196, 246.94, 293.66, 220, 174.61, 261.63];
        const note = negScale[this.step % negScale.length] * detune * nightScale;
        this.tone(note, 0.16, 'triangle', 0.028, note * 0.98, 'music');
      } else if (biomeId === 'inverted_allotments') {
        const upScale = [392, 440, 523.25, 659.25, 587.33, 783.99];
        const note = upScale[this.step % upScale.length] * detune;
        this.tone(note, 0.18, 'sine', 0.026, note * 1.04, 'music');
      } else {
        // Classic cozy Giggle-Grove / Flats / Cloud-9 funk
        this.tone(base * detune * nightScale, tempo * 0.72, wobble > 55 ? 'sawtooth' : 'triangle', 0.032, undefined, 'music');
        if (wobble > 32 && this.step % 2 === 1) {
          const arp = this.arpNotes[this.step % this.arpNotes.length];
          this.tone(arp * detune, 0.08, 'sine', 0.02, arp * 1.1, 'music');
        }
      }
      this.step += 1;
    }

    // Subtle regional ambience bed (~every 1.8s)
    this.ambTimer += dt;
    if (this.ambTimer >= 1.85) {
      this.ambTimer = 0;
      if (biomeId === 'dead_air_basin' || biomeId === 'vinyl_desert') {
        // Needle hiss tick
        this.tone(jitter(2400, 0.12), 0.025, 'sawtooth', 0.012, 1800, 'ambience');
      } else if (biomeId === 'unpaired_sea' || biomeId === 'cloud_laundromat') {
        // Snapping bedsheet breeze
        this.tone(jitter(320, 0.1), 0.14, 'sine', 0.018, 490, 'ambience');
      } else if (biomeId === 'wickwater_afterhours') {
        // Soft lantern moth wingbeat
        this.tone(jitter(190, 0.08), 0.09, 'sine', 0.016, 235, 'ambience');
      } else if (biomeId === 'carbon_copy_delta') {
        // Wet paper flutter
        this.tone(jitter(640, 0.1), 0.06, 'triangle', 0.014, 420, 'ambience');
      }
    }
  }
}
