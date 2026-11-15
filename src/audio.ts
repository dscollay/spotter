type AudioCtor = typeof AudioContext;

let context: AudioContext | null = null;
let armed = false;

function ctor(): AudioCtor | null {
  const extra = window as typeof window & { webkitAudioContext?: AudioCtor };
  return window.AudioContext ?? extra.webkitAudioContext ?? null;
}

/** Call from a tap. iOS Safari will not beep until audio is unlocked by a gesture. */
export function unlockAudio(): void {
  const AudioContextCtor = ctor();
  if (!AudioContextCtor) return;
  if (!context) context = new AudioContextCtor();
  if (context.state === 'suspended') void context.resume();
  const buffer = context.createBuffer(1, 1, 22050);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  armed = true;
}

export function audioArmed(): boolean {
  return armed;
}

export function beep(frequency = 880, duration = 0.12): void {
  if (!context) return;
  if (context.state === 'suspended') void context.resume();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.value = 0.18;
  osc.connect(gain);
  gain.connect(context.destination);
  const start = context.currentTime;
  osc.start(start);
  gain.gain.setValueAtTime(0.18, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.stop(start + duration);
}
