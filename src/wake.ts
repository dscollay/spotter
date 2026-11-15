import { unlockAudio } from './audio';

type Sentinel = { release(): Promise<void> };

let videoEl: HTMLVideoElement | null = null;
let sentinel: Sentinel | null = null;
let keepWanted = false;
let listening = false;

export type WakeStatus = 'on' | 'fallback' | 'unavailable';

export function bindWakeVideo(element: HTMLVideoElement | null): void {
  videoEl = element;
}

function requestWakeLock(): Promise<boolean> {
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
  };
  if (!nav.wakeLock?.request) return Promise.resolve(false);
  return nav.wakeLock
    .request('screen')
    .then((next) => {
      if (!keepWanted) {
        void next.release().catch(() => undefined);
        return false;
      }
      sentinel = next;
      return true;
    })
    .catch(() => false);
}

function playVideo(): boolean {
  if (!videoEl) return false;
  try {
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    const pending = videoEl.play();
    if (pending) void pending.catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

function watchVisibility(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && keepWanted) void requestWakeLock();
  });
}

/** Start of a user gesture. Unlocks audio, asks the screen to stay on, and plays a silent video if the lock is refused. */
export function armKeepAwake(): Promise<WakeStatus> {
  unlockAudio();
  keepWanted = true;
  watchVisibility();
  const videoOk = playVideo();
  return requestWakeLock().then((locked) => {
    if (!keepWanted) return 'unavailable';
    if (locked) return 'on';
    if (videoOk) return 'fallback';
    return 'unavailable';
  });
}

export function releaseKeepAwake(): void {
  keepWanted = false;
  if (videoEl) videoEl.pause();
  const current = sentinel;
  sentinel = null;
  if (current) void current.release().catch(() => undefined);
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageIsPersistent(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null;
  try {
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
