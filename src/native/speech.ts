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

export function speak(text: string) {
  if (!text) return;
  if (isNative) {
    // no voice installed for the language etc.: stay silent, the card shows the answer anyway
    Speech.speak({ text, lang: locale() }).catch(() => {});
    return;
  }
  const synth = browser();
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  // read aloud in the app language (a German voice would mangle English answers and vice versa)
  u.lang = locale();
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.startsWith(getLanguage()));
  if (voice) u.voice = voice;
  synth.speak(u);
}

export function stopSpeaking() {
  if (isNative) Speech.stop().catch(() => {});
  else browser()?.cancel();
}
