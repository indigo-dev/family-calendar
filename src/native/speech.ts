import { registerPlugin } from '@capacitor/core';
import { isNative } from './launcher';
import { getLanguage, locale } from '../i18n';

/**
 * Reading text aloud in the app language. The Android WebView has no `speechSynthesis`, so inside HomeWally
 * the Android speech output does it (android/.../SpeechPlugin.java); on the website the browser's voices.
 */
interface SpeechPlugin {
  speak(opts: { text: string; lang: string }): Promise<void>;
  stop(): Promise<void>;
}

const Speech = registerPlugin<SpeechPlugin>('Speech');

const browser = () => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

/** Queues the text; resolves when it has been spoken (or could not be). */
export function speak(text: string): Promise<void> {
  if (!text) return Promise.resolve();
  if (isNative) {
    // no voice installed for the language etc.: stay silent, the card shows the answer anyway
    return Speech.speak({ text, lang: locale() }).catch(() => {});
  }
  const synth = browser();
  if (!synth) return Promise.resolve();
  const u = new SpeechSynthesisUtterance(text);
  // read aloud in the app language (a German voice would mangle English answers and vice versa)
  u.lang = locale();
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.startsWith(getLanguage()));
  if (voice) u.voice = voice;
  return new Promise((resolve) => {
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (isNative) Speech.stop().catch(() => {});
  else browser()?.cancel();
}
