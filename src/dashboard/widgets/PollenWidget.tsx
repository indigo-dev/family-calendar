import { dayKey } from '../../lib/dates';

import { pollenLevel, POLLEN_LABELS, POLLEN_TYPES, protectionWindow, useHomeWeather, uvLevel } from '../../lib/weather';
import { Empty, Head, useDash, type WidgetProps } from './shared';

export function PollenWidget({ size }: WidgetProps) {
  const { now, openModule } = useDash();
  const { place, data } = useHomeWeather();
  if (!place)
    return (
      <Empty action="Ort festlegen" onAction={() => openModule('weather')}>
        Kein Ort
      </Empty>
    );
  if (!data) return <Empty>Lädt …</Empty>;
  const key = dayKey(now);
  const day = data.days.find((d) => d.date === key);
  const uv = uvLevel(day?.uvMax ?? 0);
  const protect = protectionWindow(data.hours, key);
  const pollen = data.pollen?.find((p) => p.date === key);
  const levels = POLLEN_TYPES.map((t) => ({ ...t, level: pollen ? pollenLevel(t.id, pollen.values[t.id] ?? 0) : 0 }));
  const top = [...levels].sort((a, b) => b.level - a.level)[0];

  return (
    <div className={`dw-pollen ${size}`}>
      <Head icon="🌼" title="Pollen & UV" />
      <div className="dw-pollen-body">
        <div className="dw-uv">
          <span className={`dw-uv-val lvl-${uv.level}`}>{Math.round(day?.uvMax ?? 0)}</span>
          <span className="dw-uv-label">
            UV {uv.label}
            {protect && size !== 's' && <small>Schutz {protect}</small>}
          </span>
        </div>
        {size === 's' ? (
          <div className="dw-pollen-top">
            {!pollen ? 'Keine Pollendaten' : top.level === 0 ? 'Kaum Pollen' : `${top.label}: ${POLLEN_LABELS[top.level]}`}
          </div>
        ) : !pollen ? (
          <div className="dw-pollen-top">Keine Pollendaten</div>
        ) : (
          <div className="dw-pollen-list">
            {levels.map((t) => (
              <div key={t.id} className="dw-pollen-row">
                <span>{t.label}</span>
                <span className="dw-bars" aria-label={POLLEN_LABELS[t.level]}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= t.level ? `on lvl-${t.level + 1}` : ''} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
