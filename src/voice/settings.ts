import { isRecord, persisted, usePersisted } from '../lib/persisted';

/**
 * Voice control settings. Kept per device and outside the app configuration on purpose,
 * so the API key never ends up in an exported backup file.
 */
export interface VoiceSettings {
  /** Gemini API key from Google AI Studio; empty = voice control off */
  apiKey: string;
  model: string;
  /** read answers aloud */
  speak: boolean;
}

/** Google's recommendation for new projects (Nov 2026): fast, cheap, audio input, structured output. */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

/** older models that are retired or only open to existing users – replaced by the default */
const RETIRED = /^gemini-(1\.|2\.0-|2\.5-flash)/;

const voiceStore = persisted<VoiceSettings>('fc.voice', (raw) => {
  const v = isRecord(raw) ? raw : {};
  return {
    apiKey: typeof v.apiKey === 'string' ? v.apiKey.trim() : '',
    model: typeof v.model === 'string' && v.model.trim() && !RETIRED.test(v.model.trim()) ? v.model.trim() : DEFAULT_MODEL,
    speak: typeof v.speak === 'boolean' ? v.speak : true,
  };
});

export const getVoiceSettings = () => voiceStore.get();
export const updateVoiceSettings = (patch: Partial<VoiceSettings>) => voiceStore.set((s) => ({ ...s, ...patch }));
export const useVoiceSettings = () => usePersisted(voiceStore);
