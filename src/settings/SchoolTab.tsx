import { useState } from 'react';
import type { Member, Period, Subject } from '../types';
import { useStore } from '../store';
import { catalogColor, catalogGroups, DEFAULT_PERIODS, minutes, newSubject, SUBJECT_COLORS } from '../lib/school';
import { Avatar } from '../components/Avatar';
import { t } from '../i18n';

const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function SchoolTab() {
  const { members } = useStore();
  const kids = members.filter((m) => m.timetable);
  const [kidId, setKidId] = useState<string | undefined>(kids[0]?.id);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];

  return (
    <div className="form">
      <div className="field">
        <span>{t('settings.school.bellTimes')}</span>
        {kids.length === 0 ? (
          <p className="hint muted">{t('settings.school.noKid')}</p>
        ) : (
          <>
            {kids.length > 1 && (
              <div className="segmented small">
                {kids.map((k) => (
                  <button key={k.id} className={k.id === kid.id ? 'active' : ''} onClick={() => setKidId(k.id)}>
                    {k.name}
                  </button>
                ))}
              </div>
            )}
            <PeriodEditor key={kid.id} kid={kid} others={kids.filter((k) => k.id !== kid.id)} />
          </>
        )}
      </div>
      <SubjectEditor />
    </div>
  );
}

function PeriodEditor({ kid, others }: { kid: Member; others: Member[] }) {
  const { patchMember } = useStore();
  const tt = kid.timetable!;
  const setPeriods = (periods: Period[]) => {
    const n = periods.length;
    const cells = tt.cells.map((row) => Array.from({ length: n }, (_, p) => row[p] ?? null));
    patchMember(kid.id, { timetable: { ...tt, periods, cells } });
  };
  const change = (i: number, key: keyof Period, value: string) => {
    if (!value) return;
    setPeriods(tt.periods.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  };
  const add = () => {
    const last = tt.periods[tt.periods.length - 1];
    const start = last ? minutes(last.end) + 5 : 8 * 60;
    setPeriods([...tt.periods, { start: hhmm(start), end: hhmm(start + 45) }]);
  };
  const removeLast = () => {
    const i = tt.periods.length - 1;
    const used = tt.cells.some((row) => row[i]);
    if (used && !confirm(t('settings.school.confirmRemovePeriod', { n: i + 1 }))) return;
    setPeriods(tt.periods.slice(0, -1));
  };

  return (
    <div className="periods">
      <div className="period-list">
        {tt.periods.map((p, i) => {
          const gap = i > 0 ? minutes(p.start) - minutes(tt.periods[i - 1].end) : 0;
          return (
            <div key={i} className="period-row">
              {gap >= 10 && <span className="period-gap muted">{t('settings.school.breakMin', { n: gap })}</span>}
              <strong>{i + 1}.</strong>
              <input
                type="time"
                value={p.start}
                onChange={(e) => change(i, 'start', e.target.value)}
                aria-label={t('settings.school.periodStart', { n: i + 1 })}
              />
              <span className="muted">–</span>
              <input
                type="time"
                value={p.end}
                onChange={(e) => change(i, 'end', e.target.value)}
                aria-label={t('settings.school.periodEnd', { n: i + 1 })}
              />
            </div>
          );
        })}
      </div>
      <div className="row-actions">
        <button className="btn" onClick={add} disabled={tt.periods.length >= 12}>
          {t('settings.school.addPeriod')}
        </button>
        <button className="btn" onClick={removeLast} disabled={tt.periods.length <= 1}>
          {t('settings.school.removePeriod')}
        </button>
        <button
          className="btn ghost"
          onClick={() => confirm(t('settings.school.confirmDefaults')) && setPeriods(DEFAULT_PERIODS.map((p) => ({ ...p })))}
        >
          {t('settings.school.defaults')}
        </button>
        {others.map((o) => (
          <button key={o.id} className="btn ghost" onClick={() => setPeriods(o.timetable!.periods.map((p) => ({ ...p })))}>
            <Avatar member={o} size={22} ring={false} /> {t('settings.school.sameAs', { name: o.name })}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubjectEditor() {
  const { school, updateSchool, members, patchMember } = useStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);

  const setColorOf = (s: Subject, c: string) => {
    if (school.custom.some((x) => x.id === s.id)) {
      updateSchool({ custom: school.custom.map((x) => (x.id === s.id ? { ...x, color: c } : x)) });
    } else {
      const colors = { ...school.colors };
      if (c === catalogColor(s.id)) delete colors[s.id];
      else colors[s.id] = c;
      updateSchool({ colors });
    }
  };

  const removeCustom = (s: Subject) => {
    if (!confirm(t('settings.school.confirmDeleteSubject', { name: s.name }))) return;
    updateSchool({ custom: school.custom.filter((x) => x.id !== s.id) });
    for (const m of members) {
      const tt = m.timetable;
      if (!tt || !tt.cells.some((row) => row.includes(s.id))) continue;
      patchMember(m.id, { timetable: { ...tt, cells: tt.cells.map((row) => row.map((c) => (c === s.id ? null : c))) } });
    }
  };

  return (
    <div className="field">
      <span>{t('settings.school.subjects')}</span>
      <p className="hint muted">{t('settings.school.subjectsHint')}</p>
      {catalogGroups(school).map((g) => (
        <div key={g.label} className="subject-group">
          <small className="muted">{g.label}</small>
          <div className="subject-list">
            {g.subjects.map((s) => (
              <SubjectRow key={s.id} subject={s} onColor={(c) => setColorOf(s, c)} changed={!!school.colors[s.id]} />
            ))}
          </div>
        </div>
      ))}
      <div className="subject-group">
        <small className="muted">{t('settings.school.ownSubjects')}</small>
        {school.custom.length > 0 && (
          <div className="subject-list">
            {school.custom.map((s) => (
              <SubjectRow
                key={s.id}
                subject={s}
                onColor={(c) => setColorOf(s, c)}
                onRename={(n) =>
                  updateSchool({ custom: school.custom.map((x) => (x.id === s.id ? { ...x, name: n, short: n.slice(0, 3) } : x)) })
                }
                onRemove={() => removeCustom(s)}
              />
            ))}
          </div>
        )}
        <div className="subject-add">
          <label className="swatch custom" style={{ background: color }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('common.color')} />
          </label>
          <input value={name} placeholder={t('settings.school.newSubject')} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn"
            disabled={!name.trim()}
            onClick={() => {
              updateSchool({ custom: [...school.custom, newSubject(name, color)] });
              setName('');
              setColor(SUBJECT_COLORS[(school.custom.length + 3) % SUBJECT_COLORS.length]);
            }}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubjectRow({
  subject,
  changed,
  onColor,
  onRename,
  onRemove,
}: {
  subject: Subject;
  changed?: boolean;
  onColor: (c: string) => void;
  onRename?: (name: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="subject-row" style={{ ['--c' as string]: subject.color }}>
      <label className="swatch custom" style={{ background: subject.color }} title={t('settings.school.changeColor')}>
        <input
          type="color"
          value={subject.color}
          onChange={(e) => onColor(e.target.value)}
          aria-label={t('settings.school.colorFor', { name: subject.name })}
        />
      </label>
      {onRename ? (
        <input className="subject-name" value={subject.name} onChange={(e) => onRename(e.target.value)} aria-label={t('common.name')} />
      ) : (
        <span className="subject-name">{subject.name}</span>
      )}
      {changed && (
        <button className="link" onClick={() => onColor(catalogColor(subject.id)!)} title={t('settings.school.defaultColor')}>
          ↺
        </button>
      )}
      {onRemove && (
        <button className="icon-btn" onClick={onRemove} aria-label={t('settings.school.deleteSubject', { name: subject.name })}>
          ✕
        </button>
      )}
    </div>
  );
}
