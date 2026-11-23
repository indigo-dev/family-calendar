import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { dayKey, startOfDay } from '../../lib/dates';
import { loadHolidays, type Holiday } from '../../lib/holidays';
import { Empty, useDash, type WidgetProps } from './shared';
import { useToday } from '../../lib/clock';
import { t, useLanguage } from '../../i18n';

const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

export function HolidaysWidget({ size }: WidgetProps) {
  const { openSettings } = useDash();
  const now = useToday();
  const { settings } = useStore();
  const region = settings.holidays.region;
  const year = now.getFullYear();
  const lang = useLanguage();
  const [list, setList] = useState<Holiday[] | null>(null);
  useEffect(() => {
    if (!region) return;
    let alive = true;
    loadHolidays(region, [year, year + 1])
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [region, year, lang]);

  if (!region)
    return (
      <Empty action={t('dashboard.chooseRegion')} onAction={() => openSettings('holidays')}>
        {t('dashboard.widgets.holidays.title')}
      </Empty>
    );
  if (!list) return <Empty>{t('dashboard.loading')}</Empty>;

  const today = dayKey(now);
  const school = list.filter((h) => h.type === 'school');
  const current = school.find((h) => h.start <= today && h.end >= today);
  const next = school.find((h) => h.start > today);
  const pub = list.filter((h) => h.type === 'public' && h.start >= today && !h.name.endsWith('(regional)'));

  return (
    <div className={`dw-countdown ${size}`}>
      <div className="dw-cd-main">
        {current ? (
          <>
            <div className="dw-cd-kicker">🏖️ {current.name}</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(current.end)) + 1}</div>
            <div className="dw-cd-label">{t('dashboard.holidaysLeft', { n: daysBetween(now, parseDay(current.end)) + 1 })}</div>
          </>
        ) : next ? (
          <>
            <div className="dw-cd-kicker">{t('dashboard.still')}</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(next.start))}</div>
            <div className="dw-cd-label">
              {t('dashboard.daysUntil', { n: daysBetween(now, parseDay(next.start)), name: next.name.replace(/ \d{4}$/, '') })}
            </div>
          </>
        ) : (
          <div className="dw-cd-label">{t('dashboard.noHolidays')}</div>
        )}
      </div>
      {size === 'm' && (
        <div className="dw-cd-side">
          <div className="dw-group-label">{t('dashboard.publicHolidays')}</div>
          {pub.slice(0, 3).map((h) => {
            const d = daysBetween(now, parseDay(h.start));
            return (
              <div key={h.id} className="dw-cd-row">
                <span className="dw-cd-name">{h.name}</span>
                <span className="dw-cd-when">
                  {d === 0 ? t('dashboard.today') : d === 1 ? t('dashboard.tomorrow') : t('dashboard.inDays', { n: d })}
                </span>
              </div>
            );
          })}
          {current && next && (
            <div className="dw-cd-row muted">
              <span className="dw-cd-name">{next.name}</span>
              <span className="dw-cd-when">{t('dashboard.inDays', { n: daysBetween(now, parseDay(next.start)) })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
