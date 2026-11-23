import { dayKey } from '../../lib/dates';

import { pollenLevel, pollenLabel, POLLEN_TYPES, protectionWindow, useHomeWeather, uvLevel } from '../../lib/weather';
import { Empty, Head, useDash, type WidgetProps } from './shared';
import { useToday } from '../../lib/clock';
import { t } from '../../i18n';

export function PollenWidget({ size }: WidgetProps) {
  const { openModule } = useDash();
  const now = useToday();
  const { place, data } = useHomeWeather();
  if (!place)
    return (
      <Empty action={t('dashboard.setPlace')} onAction={() => openModule('weather')}>
        {t('dashboard.noPlace')}
      </Empty>
    );
  if (!data) return <Empty>{t('dashboard.loading')}</Empty>;
  const key = dayKey(now);
  const day = data.days.find((d) => d.date === key);
  const uv = uvLevel(day?.uvMax ?? 0);
  const protect = protectionWindow(data.hours, key);
  const pollen = data.pollen?.find((p) => p.date === key);
  const levels = POLLEN_TYPES.map((p) => ({ ...p, level: pollen ? pollenLevel(p.id, pollen.values[p.id] ?? 0) : 0 }));
  const top = [...levels].sort((a, b) => b.level - a.level)[0];

  return (
    <div className={`dw-pollen ${size}`}>
      <Head icon="🌼" title={t('dashboard.widgets.pollen.title')} />
      <div className="dw-pollen-body">
        <div className="dw-uv">
          <span className={`dw-uv-val lvl-${uv.level}`}>{Math.round(day?.uvMax ?? 0)}</span>
          <span className="dw-uv-label">
            UV {uv.label}
            {protect && size !== 's' && <small>{t('dashboard.protect', { time: protect })}</small>}
          </span>
        </div>
        {size === 's' ? (
          <div className="dw-pollen-top">
            {!pollen ? t('dashboard.noPollen') : top.level === 0 ? t('dashboard.littlePollen') : `${top.label}: ${pollenLabel(top.level)}`}
          </div>
        ) : !pollen ? (
          <div className="dw-pollen-top">{t('dashboard.noPollen')}</div>
        ) : (
          <div className="dw-pollen-list">
            {levels.map((p) => (
              <div key={p.id} className="dw-pollen-row">
                <span>{p.label}</span>
                <span className="dw-bars" aria-label={pollenLabel(p.level)}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= p.level ? `on lvl-${p.level + 1}` : ''} />
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
