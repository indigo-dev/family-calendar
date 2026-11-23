import { t } from '../i18n';
/*
 * Microphone recording with a simple voice activity detection: the recording stops by itself
 * shortly after the speaker pauses, so nobody has to tap twice and no silence is sent (and billed).
 */

export interface Recording {
  /** stop now and keep what was said */
  stop(): void;
  /** stop and throw the recording away */
  cancel(): void;
  /** the audio, or null if cancelled or nothing was said */
  done: Promise<Blob | null>;
}

export class MicError extends Error {}

const TICK_MS = 80;
/** pause after speech that ends the recording */
const SILENCE_MS = 1400;
/** give up if nobody starts speaking */
const NO_SPEECH_MS = 7000;
const MAX_MS = 20_000;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
}

export function micSupported(): boolean {
  return !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

/** Starts recording. `onLevel` gets the loudness (0..1) for the animation. */
export async function startRecording(onLevel?: (level: number) => void): Promise<Recording> {
  if (!micSupported()) throw new MicError(t('voice.errors.noMic'));
  if (!window.isSecureContext) throw new MicError(t('voice.errors.https'));
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new MicError(t('voice.errors.micDenied'));
    if (name === 'NotFoundError') throw new MicError(t('voice.errors.micMissing'));
    throw new MicError(t('voice.micFailed'));
  }

  const mime = pickMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  const started = Date.now();
  let floor = 0.01;
  let spoke = false;
  let lastVoice = started;
  let keep = true;

  const done = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      resolve(keep && spoke && chunks.length ? new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' }) : null);
    };
  });

  const end = (k: boolean) => {
    keep = k;
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const now = Date.now();
    // the first moment is background noise: learn its level, then speech has to be clearly louder
    if (now - started < 300) floor = Math.max(floor, rms);
    const voiced = rms > Math.max(0.02, floor * 2.5);
    if (voiced) {
      spoke = true;
      lastVoice = now;
    }
    onLevel?.(Math.min(1, rms * 8));
    if (spoke && now - lastVoice > SILENCE_MS) end(true);
    else if (!spoke && now - started > NO_SPEECH_MS) end(false);
    else if (now - started > MAX_MS) end(true);
  }, TICK_MS);

  recorder.start(250);
  return {
    stop: () => {
      // a tap counts as "I said something" – the model decides whether it was silence
      spoke = spoke || Date.now() - started > 600;
      end(true);
    },
    cancel: () => end(false),
    done,
  };
}

/**
 * Converts the recording to 16 kHz mono WAV – a format every model accepts and small enough
 * for a short command. Falls back to the original file if the browser cannot decode it.
 */
export async function toModelAudio(blob: Blob): Promise<{ mime: string; base64: string }> {
  try {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    void ctx.close();
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    return { mime: 'audio/wav', base64: await toBase64(encodeWav(pcm, rate)) };
  } catch {
    return { mime: blob.type.split(';')[0] || 'audio/webm', base64: await toBase64(blob) };
  }
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buffer], { type: 'audio/wav' });
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
