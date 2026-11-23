import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { BUILTIN, useShopping } from '../lib/shopping';
import { useTodos } from '../lib/todos';
import { useWeatherSettings } from '../lib/weather';
import { MODULES, type ModuleId } from '../components/ModuleNav';
import { isEmpty, type Command } from './command';
import { understand, VoiceError, type VoiceInput } from './gemini';
import { MicError, micSupported, startRecording, toModelAudio, type Recording } from './recorder';
import { applyCommand, findMembers, joinAnd, type Applied } from './apply';
import { EventsAnswer, WeatherAnswer } from './answers';
import { DEFAULT_MODEL, updateVoiceSettings, useVoiceSettings } from './settings';
import './voice.css';
import { t } from '../i18n';
import { speak as speakAloud, stopSpeaking } from '../native/speech';

type Phase =
  | { s: 'idle' }
  | { s: 'listening' }
  | { s: 'typing' }
  | { s: 'thinking' }
  | { s: 'result'; cmd: Command; applied: Applied; undone?: boolean; openFor?: string[] }
  | { s: 'error'; message: string; canType?: boolean; settings?: boolean };

/** how long a result stays open without being touched */
const RESULT_MS = 15_000;

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

/** Always reachable microphone button plus the card that shows what was understood and done. */
export function VoiceButton({ onOpenModule, onSettings }: { onOpenModule: (id: ModuleId) => void; onSettings: () => void }) {
  const voice = useVoiceSettings();
  const { members, selectMembers } = useStore();
  const shop = useShopping();
  const todos = useTodos();
  const { places } = useWeatherSettings();
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState('');
  const rec = useRef<Recording | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [touched, setTouched] = useState(0);

  const speak = useCallback(
    (text: string) => {
      if (voice.speak) speakAloud(text);
    },
    [voice.speak],
  );

  const close = useCallback(() => {
    rec.current?.cancel();
    rec.current = null;
    abort.current?.abort();
    stopSpeaking();
    setPhase({ s: 'idle' });
    setTyped('');
  }, []);

  // results close by themselves after a while
  useEffect(() => {
    if (phase.s !== 'result') return;
    const t = setTimeout(close, RESULT_MS);
    return () => clearTimeout(t);
  }, [phase, touched, close]);

  // Escape closes the card
  useEffect(() => {
    if (phase.s === 'idle') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase.s, close]);

  const run = async (input: VoiceInput) => {
    setPhase({ s: 'thinking' });
    const ctrl = new AbortController();
    abort.current = ctrl;
    const hidden = new Set(shop.hidden);
    try {
      const { cmd, model } = await understand(
        input,
        {
          now: new Date(),
          members: members.map((m) => m.name),
          places: places.map((p) => p.name),
          pantry: [...BUILTIN.filter((i) => !hidden.has(i.id)), ...shop.custom].map((i) => i.name),
        },
        { apiKey: voice.apiKey, model: voice.model, fallbackModel: DEFAULT_MODEL },
        ctrl.signal,
      );
      // the chosen model was gone and the default answered: keep using that
      if (model !== voice.model) updateVoiceSettings({ model });
      if (ctrl.signal.aborted) return;
      if (!cmd.transcript && isEmpty(cmd)) {
        setPhase({ s: 'error', message: t('voice.nothingUnderstood'), canType: true });
        return;
      }
      const applied = applyCommand(cmd, {
        items: [...BUILTIN, ...shop.custom],
        list: shop.list,
        add: shop.add,
        setQty: shop.setQty,
        createItem: shop.createItem,
        removeItem: shop.removeItem,
        members,
        upsertTodo: todos.upsert,
        removeTodo: todos.remove,
      });
      // "Stundenplan von Jan": the person filter decides what the module shows
      const openFor = cmd.openModule ? findMembers(members, cmd.openFor) : [];
      if (openFor.length) selectMembers(openFor.map((m) => m.id));
      if (cmd.openModule) onOpenModule(cmd.openModule);
      setPhase({ s: 'result', cmd, applied, openFor: openFor.map((m) => m.name) });
      const said = [...applied.speech];
      if (cmd.reply) said.push(cmd.reply);
      else if (isEmpty(cmd)) said.push(t('voice.notUnderstood'));
      if (said.length) speak(said.join(' '));
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setPhase({
        s: 'error',
        message: e instanceof VoiceError ? e.message : t('voice.wentWrong'),
        canType: true,
        settings: e instanceof VoiceError && e.settings,
      });
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  };

  const listen = async () => {
    stopSpeaking();
    if (!micSupported()) {
      setPhase({ s: 'typing' });
      return;
    }
    setPhase({ s: 'listening' });
    setLevel(0);
    try {
      const r = await startRecording(setLevel);
      rec.current = r;
      const blob = await r.done;
      if (rec.current !== r) return; // cancelled
      rec.current = null;
      if (!blob) {
        setPhase({ s: 'error', message: t('voice.nothingHeard'), canType: true });
        return;
      }
      setPhase({ s: 'thinking' });
      await run({ kind: 'audio', ...(await toModelAudio(blob)) });
    } catch (e) {
      setPhase({ s: 'error', message: e instanceof MicError ? e.message : t('voice.micFailed'), canType: true });
    }
  };

  const onFab = () => {
    if (phase.s === 'listening') rec.current?.stop();
    else if (phase.s === 'thinking') return;
    else void listen();
  };

  if (!voice.apiKey) return null;

  const moduleLabel = (id: ModuleId) => MODULES.find((m) => m.id === id)?.label ?? id;

  return (
    <>
      {phase.s !== 'idle' && (
        <div
          className="voice-card"
          role="dialog"
          aria-label={t('voice.title')}
          aria-live="polite"
          onPointerDown={() => setTouched((n) => n + 1)}
        >
          <button className="voice-close" onClick={close} aria-label={t('common.close')}>
            ×
          </button>

          {phase.s === 'listening' && (
            <div className="voice-status">
              <strong>{t('voice.listening')}</strong>
              <span className="muted">{t('voice.example')}</span>
              <button
                className="voice-link"
                onClick={() => {
                  rec.current?.cancel();
                  rec.current = null;
                  setPhase({ s: 'typing' });
                }}
              >
                {t('voice.rather')}
              </button>
            </div>
          )}

          {phase.s === 'thinking' && (
            <div className="voice-status">
              <span className="voice-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <strong>{t('voice.moment')}</strong>
            </div>
          )}

          {phase.s === 'typing' && (
            <form
              className="voice-type"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) void run({ kind: 'text', text: typed.trim() });
              }}
            >
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t('voice.typePlaceholder')}
                aria-label={t('voice.typeLabel')}
                enterKeyHint="send"
              />
              <button className="btn primary" type="submit" disabled={!typed.trim()}>
                {t('voice.go')}
              </button>
            </form>
          )}

          {phase.s === 'error' && (
            <div className="voice-status">
              <strong>{phase.message}</strong>
              <div className="voice-actions">
                <button className="btn primary" onClick={() => void listen()}>
                  {t('voice.again')}
                </button>
                {phase.canType && (
                  <button className="btn" onClick={() => setPhase({ s: 'typing' })}>
                    {t('voice.type')}
                  </button>
                )}
                {phase.settings && (
                  <button
                    className="btn"
                    onClick={() => {
                      close();
                      onSettings();
                    }}
                  >
                    {t('common.settings')}
                  </button>
                )}
              </div>
            </div>
          )}

          {phase.s === 'result' && (
            <div className="voice-result">
              {phase.cmd.transcript && <p className="voice-transcript">„{phase.cmd.transcript}“</p>}
              {phase.applied.lines.map((l, i) => (
                <div key={i} className={`voice-line ${phase.undone ? 'undone' : ''}`}>
                  <span className="voice-line-icon" aria-hidden>
                    {l.icon}
                  </span>
                  <span>{l.text}</span>
                </div>
              ))}
              {phase.cmd.weather.map((w, i) => (
                <WeatherAnswer key={`w${i}`} req={w} speak={speak} />
              ))}
              {phase.cmd.events.map((ev, i) => (
                <EventsAnswer key={`e${i}`} req={ev} speak={speak} />
              ))}
              {phase.cmd.openModule && (
                <div className="voice-line">
                  <span className="voice-line-icon" aria-hidden>
                    {MODULES.find((m) => m.id === phase.cmd.openModule)?.icon}
                  </span>
                  <span>
                    {phase.openFor?.length
                      ? t('voice.openedFor', { module: moduleLabel(phase.cmd.openModule), names: joinAnd(phase.openFor) })
                      : t('voice.opened', { module: moduleLabel(phase.cmd.openModule) })}
                  </span>
                </div>
              )}
              {phase.cmd.reply && <p className="voice-reply">{phase.cmd.reply}</p>}
              {isEmpty(phase.cmd) && <p className="voice-reply">{t('voice.notUnderstood')}</p>}
              <div className="voice-actions">
                {phase.applied.undo && !phase.undone && (
                  <button
                    className="btn"
                    onClick={() => {
                      phase.applied.undo!();
                      setPhase({ ...phase, undone: true });
                    }}
                  >
                    {t('dashboard.undo')}
                  </button>
                )}
                {phase.undone && <span className="muted">{t('voice.undone')}</span>}
                <button className="btn primary" onClick={() => void listen()}>
                  {t('voice.more')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        className={`voice-fab ${phase.s === 'listening' ? 'listening' : ''} ${phase.s === 'thinking' ? 'thinking' : ''}`}
        style={{ ['--lvl' as string]: level }}
        onClick={onFab}
        aria-label={phase.s === 'listening' ? t('voice.stop') : t('voice.command')}
        title={t('voice.command')}
      >
        <MicIcon />
      </button>
    </>
  );
}
