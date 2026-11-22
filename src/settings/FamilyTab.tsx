import { useRef, useState } from 'react';
import type { Member } from '../types';
import { useStore } from '../store';
import { demoMembers, EMOJIS, imageFileToAvatar, newMember } from '../lib/config';
import { Avatar } from '../components/Avatar';
import { newTimetable, SCHOOL_TYPES } from '../lib/school';
import { PALETTE, paletteColors } from '../lib/colors';

export function FamilyTab({ onGoCalendars }: { onGoCalendars: () => void }) {
  const { members, calendars, upsertMember, replaceConfig, config } = useStore();
  const [selected, setSelected] = useState<string | null>(members[0]?.id ?? null);
  const current = members.find((m) => m.id === selected) ?? null;

  const add = () => {
    const m = newMember(members);
    upsertMember(m);
    setSelected(m.id);
  };

  const subtitle = (m: Member) => {
    const n = calendars.filter((c) => c.memberIds.includes(m.id)).length;
    const parts = [n === 0 ? 'keine Kalender' : n === 1 ? '1 Kalender' : `${n} Kalender`];
    if (m.demo) parts.push('Demo');
    return parts.join(' · ');
  };

  return (
    <div className="family">
      <aside className="member-list">
        {members.map((m) => (
          <button key={m.id} className={`member-row ${m.id === selected ? 'active' : ''}`} onClick={() => setSelected(m.id)}>
            <Avatar member={m} size={36} ring={false} />
            <span className="member-row-text">
              {m.name}
              <small className="muted">{subtitle(m)}</small>
            </span>
          </button>
        ))}
        <button className="btn" onClick={add}>
          + Person hinzufügen
        </button>
        {members.length === 0 && (
          <button
            className="btn ghost"
            onClick={() => {
              const demo = demoMembers();
              replaceConfig({ ...config, members: demo });
              setSelected(demo[0].id);
            }}
          >
            Demo-Familie laden
          </button>
        )}
      </aside>
      <section className="member-edit">
        {current ? (
          <MemberEditor key={current.id} member={current} onGoCalendars={onGoCalendars} onDeleted={() => setSelected(null)} />
        ) : (
          <p className="muted">Lege ein Familienmitglied an oder wähle eines aus.</p>
        )}
      </section>
    </div>
  );
}

function MemberEditor({ member, onGoCalendars, onDeleted }: { member: Member; onGoCalendars: () => void; onDeleted: () => void }) {
  const { patchMember, removeMember, moveMember, calendars, config, settings } = useStore();
  // `member` is drawn in the chosen palette; the swatches edit the stored colour
  const rawColor = config.members.find((m) => m.id === member.id)?.color ?? member.color;
  const shown = paletteColors(settings.palette, settings.coreColor);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Member>) => patchMember(member.id, patch);
  const mine = calendars.filter((c) => c.memberIds.includes(member.id));

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const dataUrl = await imageFileToAvatar(f);
      set({ avatar: { type: 'image', dataUrl } });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="form">
      <div className="member-preview">
        <Avatar member={member} size={72} />
        <div className="row-actions">
          <button className="icon-btn" onClick={() => moveMember(member.id, -1)} aria-label="Nach oben">
            ↑
          </button>
          <button className="icon-btn" onClick={() => moveMember(member.id, 1)} aria-label="Nach unten">
            ↓
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(`${member.name} wirklich entfernen?\n\nDie Kalender bleiben erhalten und können neu zugeordnet werden.`)) {
                removeMember(member.id);
                onDeleted();
              }
            }}
          >
            Entfernen
          </button>
        </div>
      </div>

      <label className="field">
        <span>Name</span>
        <input value={member.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="field">
        <span>Farbe</span>
        <div className="swatches">
          {PALETTE.map((c, i) => (
            <button
              key={c}
              className={`swatch ${rawColor === c ? 'on' : ''}`}
              style={{ background: shown[i] }}
              onClick={() => set({ color: c })}
              aria-label={`Farbe ${i + 1}`}
            />
          ))}
          <label
            className={`swatch custom ${PALETTE.includes(rawColor) ? '' : 'on'}`}
            style={{ background: PALETTE.includes(rawColor) ? undefined : member.color }}
            title="Eigene Farbe"
          >
            <input type="color" value={rawColor} onChange={(e) => set({ color: e.target.value })} />+
          </label>
        </div>
        {settings.palette !== 'vivid' && !PALETTE.includes(rawColor) && (
          <p className="hint muted">Eigene Farben werden an die gewählte Farbpalette angepasst (Einstellungen → Design).</p>
        )}
      </div>

      <div className="field">
        <span>Avatar</span>
        <div className="segmented small">
          <button className={member.avatar.type === 'initials' ? 'active' : ''} onClick={() => set({ avatar: { type: 'initials' } })}>
            Initialen
          </button>
          <button
            className={member.avatar.type === 'emoji' ? 'active' : ''}
            onClick={() => set({ avatar: { type: 'emoji', value: member.avatar.type === 'emoji' ? member.avatar.value : EMOJIS[0] } })}
          >
            Emoji
          </button>
          <button className={member.avatar.type === 'image' ? 'active' : ''} onClick={() => fileRef.current?.click()}>
            Foto
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        {member.avatar.type === 'emoji' && (
          <div className="emoji-grid">
            {EMOJIS.map((em) => (
              <button
                key={em}
                className={member.avatar.type === 'emoji' && member.avatar.value === em ? 'on' : ''}
                onClick={() => set({ avatar: { type: 'emoji', value: em } })}
              >
                {em}
              </button>
            ))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="field">
        <span>Kalender</span>
        {mine.length === 0 ? (
          <p className="hint muted">Dieser Person ist noch kein Kalender zugeordnet.</p>
        ) : (
          <div className="chip-list">
            {mine.map((c) => (
              <span key={c.id} className="chip static">
                {c.name}
              </span>
            ))}
          </div>
        )}
        <div>
          <button className="btn" onClick={onGoCalendars}>
            Kalender zuordnen …
          </button>
        </div>
      </div>

      <div className="field">
        <span>Schule</span>
        <label className="check">
          <input
            type="checkbox"
            checked={!!member.timetable}
            onChange={(e) => {
              if (e.target.checked) set({ timetable: newTimetable('grundschule') });
              else if (confirm(`Stundenplan von ${member.name} löschen?`)) set({ timetable: undefined });
            }}
          />
          <span>Hat Stundenplan</span>
        </label>
        {member.timetable && (
          <div className="segmented small">
            {(Object.keys(SCHOOL_TYPES) as (keyof typeof SCHOOL_TYPES)[]).map((t) => (
              <button
                key={t}
                className={member.timetable?.schoolType === t ? 'active' : ''}
                onClick={() => set({ timetable: { ...member.timetable!, schoolType: t } })}
              >
                {SCHOOL_TYPES[t]}
              </button>
            ))}
          </div>
        )}
        {member.timetable && (
          <p className="hint muted">Fächer trägst du im Stundenplan über „Bearbeiten“ ein, Klingelzeiten unter „Schule“.</p>
        )}
      </div>

      <label className="check">
        <input type="checkbox" checked={!!member.demo} onChange={(e) => set({ demo: e.target.checked || undefined })} />
        <span>Beispieltermine anzeigen (Demo)</span>
      </label>
    </div>
  );
}
