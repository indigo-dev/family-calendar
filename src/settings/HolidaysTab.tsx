import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { regions } from '../lib/config';
import { t, useLanguage } from '../i18n';
import { loadHolidays, type Holiday } from '../lib/holidays';
import { fmt } from '../lib/dates';
import { FragmentRow, Group, Row, Switch } from './controls';

export function HolidaysTab() {
  const { settings, updateSettings } = useStore();
  const h = settings.holidays;
  const set = (patch: Partial<typeof h>) => updateSettings({ holidays: { ...h, ...patch } });
  const lang = useLanguage();
  const [loaded, setLoaded] = useState<{ region: string; lang?: string; list?: Holiday[]; error?: string }>({ region: '' });
  const preview: { list?: Holiday[]; error?: string } = h.region && loaded.region === h.region && loaded.lang === lang ? loaded : {};

  useEffect(() => {
    if (!h.region) return;
    const region = h.region;
    let alive = true;
    const y = new Date().getFullYear();
    loadHolidays(region, [y, y + 1])
      .then((list) => alive && setLoaded({ region, lang, list }))
      .catch((e) => alive && setLoaded({ region, lang, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [h.region, lang]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (type: Holiday['type'], n: number) => (preview.list ?? []).filter((x) => x.type === type && x.end >= today).slice(0, n);
  const day = (s: string) => fmt(new Date(s + 'T12:00:00'), { day: '2-digit', month: '2-digit', year: '2-digit' });
  const span = (x: Holiday) => (x.start === x.end ? day(x.start) : `${day(x.start)} – ${day(x.end)}`);

  return (
    <div className="form">
      <Group note={t('settings.holidays.note')}>
        <div className="set-card">
          <Row label={t('settings.holidays.region')}>
            <select value={h.region} onChange={(e) => set({ region: e.target.value })}>
              <option value="">{t('settings.holidays.none')}</option>
              {regions().map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Row>
          {h.region && (
            <>
              <Row label={t('settings.holidays.showPublic')}>
                <Switch checked={h.showPublic} onChange={(showPublic) => set({ showPublic })} label={t('settings.holidays.showPublic')} />
              </Row>
              <Row label={t('settings.holidays.showSchool')}>
                <Switch checked={h.showSchool} onChange={(showSchool) => set({ showSchool })} label={t('settings.holidays.showSchool')} />
              </Row>
            </>
          )}
        </div>
      </Group>

      {h.region && (
        <div className="field">
          <span>{t('settings.holidays.preview')}</span>
          {preview.error && <p className="error">{t('settings.holidays.loadError', { error: preview.error })}</p>}
          {!preview.list && !preview.error && <p className="muted">{t('common.loading')}</p>}
          {preview.list && (
            <div className="field-row">
              <dl className="hol-preview">
                {upcoming('public', 5).map((x) => (
                  <FragmentRow key={x.id} dt={span(x)} dd={x.name} />
                ))}
              </dl>
              <dl className="hol-preview">
                {upcoming('school', 5).map((x) => (
                  <FragmentRow key={x.id} dt={span(x)} dd={x.name} />
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <p className="help">
        {t('settings.holidays.source')}{' '}
        <a href="https://www.openholidaysapi.org" target="_blank" rel="noreferrer">
          OpenHolidays API
        </a>{' '}
        {t('settings.holidays.sourceNote')}
      </p>
    </div>
  );
}
