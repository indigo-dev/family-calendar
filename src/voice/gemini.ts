import { buildPrompt, COMMAND_SCHEMA, parseCommand, type Command, type VoiceContext } from './command';
import { t } from '../i18n';

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
export function thinkingConfig(model: string): Record<string, unknown> | undefined {
  if (/2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  // "minimal" = near-off; Flash-Lite, 3.6 Flash and 3 Flash know it, 3.8 Flash and Gemini 4 start at "low"
  if (/flash-lite|gemini-3\.6-flash|gemini-3-flash/.test(model)) return { thinkingLevel: 'minimal' };
  if (/gemini-[3-9]/.test(model)) return { thinkingLevel: 'low' };
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
  if (res.status === 400 && /api key/i.test(message)) return new VoiceError(t('voice.errors.badKey'), true);
  if (res.status === 403) return new VoiceError(t('voice.errors.noAccess'), true);
  if (res.status === 404) return new VoiceError(t('voice.errors.noModel'), true);
  if (res.status === 429) return new VoiceError(t('voice.errors.limit'));
  if (res.status >= 500) return new VoiceError(t('voice.errors.down'));
  return new VoiceError(message || t('voice.errors.error', { status: res.status }));
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new VoiceError(navigator.onLine ? t('voice.errors.unreachable') : t('voice.errors.offline'));
  }
}

/**
 * Understands one request. If the chosen model is gone (404), it tries `fallbackModel` once;
 * `model` in the result says which one answered, so the caller can remember it.
 */
export async function understand(
  input: VoiceInput,
  ctx: VoiceContext,
  cfg: GeminiConfig & { fallbackModel?: string },
  signal?: AbortSignal,
): Promise<{ cmd: Command; model: string }> {
  if (!cfg.apiKey) throw new VoiceError(t('voice.errors.noKey'), true);
  const part = input.kind === 'audio' ? { inlineData: { mimeType: input.mime, data: input.base64 } } : { text: input.text };
  const request = (model: string, thinking: boolean) => ({
    systemInstruction: { parts: [{ text: buildPrompt(ctx) }] },
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: COMMAND_SCHEMA,
      ...(thinking && thinkingConfig(model) ? { thinkingConfig: thinkingConfig(model) } : {}),
    },
  });
  const send = (model: string, thinking: boolean) =>
    call(`${BASE}models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify(request(model, thinking)),
      signal,
    });
  const attempt = async (model: string) => {
    let res = await send(model, true);
    // a model that does not know the thinking setting: try once without
    if (res.status === 400 && thinkingConfig(model)) {
      const err = await errorOf(res.clone());
      if (/think/i.test(err.message)) res = await send(model, false);
    }
    return res;
  };

  let model = cfg.model;
  let res = await attempt(model);
  if (res.status === 404 && cfg.fallbackModel && cfg.fallbackModel !== model) {
    model = cfg.fallbackModel;
    res = await attempt(model);
  }
  if (!res.ok) throw await errorOf(res);

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new VoiceError(body.promptFeedback?.blockReason ? t('voice.errors.refused') : t('voice.errors.noAnswer'));
  try {
    return { cmd: parseCommand(JSON.parse(text)), model };
  } catch {
    throw new VoiceError(t('voice.errors.garbled'));
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
        m.supportedGenerationMethods?.includes('generateContent') &&
        /gemini/i.test(m.name) &&
        !/tts|image|embedding|live|translate|native-audio|computer-use|robotics/i.test(m.name),
    )
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
}
