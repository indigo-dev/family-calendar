import { buildPrompt, COMMAND_SCHEMA, parseCommand, type Command, type VoiceContext } from './command';

/*
 * Gemini as the "understanding" step: one request with the recording (or text), the app context
 * and a response schema – the answer is the structured command. Called straight from the browser
 * with the family's own API key.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/';

export type VoiceInput = { kind: 'audio'; mime: string; base64: string } | { kind: 'text'; text: string };

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

/** `settings`: the fix is in the voice settings (key, model) */
export class VoiceError extends Error {
  constructor(
    message: string,
    readonly settings = false,
  ) {
    super(message);
  }
}

/** Thinking costs time and output tokens and does not help with these short requests. */
function thinkingConfig(model: string): Record<string, unknown> | undefined {
  if (/2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-3/.test(model)) return { thinkingLevel: 'low' };
  return undefined;
}

async function errorOf(res: Response): Promise<VoiceError> {
  let message = '';
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } };
    message = body.error?.message ?? '';
  } catch {
    /* no JSON body */
  }
  if (res.status === 400 && /api key/i.test(message)) return new VoiceError('Der API-Key ist ungültig.', true);
  if (res.status === 403) return new VoiceError('Der API-Key hat keinen Zugriff auf Gemini.', true);
  if (res.status === 404)
    return new VoiceError('Dieses Gemini-Modell gibt es nicht (mehr) – bitte in den Einstellungen ein anderes wählen.', true);
  if (res.status === 429) return new VoiceError('Das Anfrage-Limit ist erreicht. Bitte später noch einmal versuchen.');
  if (res.status >= 500) return new VoiceError('Gemini ist gerade nicht erreichbar.');
  return new VoiceError(message || `Gemini-Fehler ${res.status}`);
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new VoiceError(navigator.onLine ? 'Gemini ist nicht erreichbar.' : 'Keine Internetverbindung.');
  }
}

export async function understand(input: VoiceInput, ctx: VoiceContext, cfg: GeminiConfig, signal?: AbortSignal): Promise<Command> {
  if (!cfg.apiKey) throw new VoiceError('Es ist noch kein Gemini-API-Key hinterlegt.', true);
  const part = input.kind === 'audio' ? { inlineData: { mimeType: input.mime, data: input.base64 } } : { text: input.text };
  const request = (thinking: boolean) => ({
    systemInstruction: { parts: [{ text: buildPrompt(ctx) }] },
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: COMMAND_SCHEMA,
      ...(thinking && thinkingConfig(cfg.model) ? { thinkingConfig: thinkingConfig(cfg.model) } : {}),
    },
  });
  const url = `${BASE}models/${encodeURIComponent(cfg.model)}:generateContent`;
  const send = (thinking: boolean) =>
    call(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify(request(thinking)),
      signal,
    });

  let res = await send(true);
  // a model that does not know the thinking setting: try once without
  if (res.status === 400 && thinkingConfig(cfg.model)) {
    const err = await errorOf(res.clone());
    if (/think/i.test(err.message)) res = await send(false);
  }
  if (!res.ok) throw await errorOf(res);

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new VoiceError(body.promptFeedback?.blockReason ? 'Gemini hat die Anfrage abgelehnt.' : 'Gemini hat nicht geantwortet.');
  try {
    return parseCommand(JSON.parse(text));
  } catch {
    throw new VoiceError('Die Antwort von Gemini war unverständlich.');
  }
}

export interface ModelInfo {
  id: string;
  label: string;
}

/** Models of this key that can generate content – also checks the key. */
export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await call(`${BASE}models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) throw await errorOf(res);
  const body = (await res.json()) as {
    models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  };
  return (body.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name) && !/tts|image|embedding|live/i.test(m.name),
    )
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
}
