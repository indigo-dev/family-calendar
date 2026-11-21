import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BUILTIN,
  CATEGORIES,
  EMOJI_CHOICES,
  norm,
  useShopping,
  type CategoryId,
  type ListEntry,
  type ShopItem,
} from '../lib/shopping';
import { useTapOrLongPress } from '../lib/hooks';
import { Sym } from '../components/Sym';
import './shopping.css';

type Pane = 'list' | 'pantry';

/** how long the "abgehakt" animation runs before the item leaves the list */
const CHECK_MS = 450;
const UNDO_MS = 5000;
const FREQUENT_MAX = 12;

const CATS_KEY = 'fc.shopping.cats';

function loadCats(): CategoryId[] {
  try {
    const v = JSON.parse(localStorage.getItem(CATS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((id): id is CategoryId => CATEGORIES.some((c) => c.id === id)) : [];
  } catch {
    return [];
  }
}

/** Tap = only this department, long press = add/remove it (same as the person chips). */
function CategoryChip({ cat, active, dimmed, onTap, onLongPress }: {
  cat: (typeof CATEGORIES)[number];
  active: boolean;
  dimmed: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const press = useTapOrLongPress(onTap, onLongPress);
  return (
    <button
      className={`chip shop-cat-chip ${active ? 'on' : ''} ${dimmed ? 'off' : ''}`}
      style={{
        borderColor: dimmed ? undefined : cat.color,
        background: active ? `color-mix(in srgb, ${cat.color} 22%, var(--surface))` : undefined,
      }}
      aria-pressed={active}
      {...press}
    >
      <span className="shop-cat-icon" style={{ ['--cat' as string]: cat.color }}>
        <Sym emoji={cat.icon} />
      </span>
      {cat.short}
    </button>
  );
}

const catColor = new Map(CATEGORIES.map((c) => [c.id, c.color]));
const catIcon = new Map(CATEGORIES.map((c) => [c.id, c.icon]));

/** item picture in the chosen symbol style; the department icon stands in if the style lacks it */
function ItemSym({ item }: { item: ShopItem }) {
  return (
    <span className="shop-emoji">
      <Sym emoji={item.emoji} fallback={catIcon.get(item.cat)} />
    </span>
  );
}
const tileStyle = (item: ShopItem): CSSProperties => ({ ['--cat' as string]: catColor.get(item.cat) ?? '#8a8f98' });

export function ShoppingModule() {
  const shop = useShopping();
  const [pane, setPane] = useState<Pane>('list');
  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  /** pantry filter; empty = all departments */
  const [cats, setCats] = useState<CategoryId[]>(loadCats);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ entry: ListEntry; name: string } | null>(null);
  const [creating, setCreating] = useState<{ name: string; cat: CategoryId } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const items = useMemo(() => {
    const hidden = new Set(shop.hidden);
    return [...BUILTIN.filter((i) => !hidden.has(i.id)), ...shop.custom];
  }, [shop.hidden, shop.custom]);
  const itemById = useMemo(() => new Map([...BUILTIN, ...shop.custom].map((i) => [i.id, i])), [shop.custom]);
  const qtyById = useMemo(() => new Map(shop.list.map((e) => [e.itemId, e.qty])), [shop.list]);

  // the list in supermarket order; the tile colour shows the department
  const listed = useMemo(() => {
    const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
    return shop.list
      .map((e) => ({ entry: e, item: itemById.get(e.itemId) }))
      .filter((x): x is { entry: ListEntry; item: ShopItem } => !!x.item)
      .sort((a, b) => order.get(a.item.cat)! - order.get(b.item.cat)! || a.entry.addedAt - b.entry.addedAt);
  }, [shop.list, itemById]);
  const listCount = listed.length;

  const q = norm(query);
  // "Sonstiges" only gets a chip once it has items
  const filterCats = useMemo(() => CATEGORIES.filter((c) => c.id !== 'other' || items.some((i) => i.cat === 'other')), [items]);
  const allCats = cats.length === 0;
  // a search always looks through the whole pantry, so nothing is hidden by a forgotten filter
  const catOk = (cat: CategoryId) => q !== '' || allCats || cats.includes(cat);
  const pantryGroups = useMemo(() => {
    const match = (i: ShopItem) => !q || norm(i.name).includes(q);
    return CATEGORIES.filter((c) => catOk(c.id))
      .map((c) => ({ cat: c, items: items.filter((i) => i.cat === c.id && match(i)) }))
      .filter((g) => g.items.length > 0 || (!q && g.cat.id !== 'other'));
  }, [items, q, cats]);
  const frequent = useMemo(() => {
    if (q || editMode) return [];
    return items
      .filter((i) => (shop.bought[i.id] ?? 0) >= 2 && catOk(i.cat))
      .sort((a, b) => shop.bought[b.id] - shop.bought[a.id] || a.name.localeCompare(b.name, 'de'))
      .slice(0, FREQUENT_MAX);
  }, [items, shop.bought, q, editMode, cats]);
  const exact = q && items.some((i) => norm(i.name) === q);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  useEffect(() => {
    try {
      localStorage.setItem(CATS_KEY, JSON.stringify(cats));
    } catch {
      /* ignore */
    }
  }, [cats]);

  const checkOff = (entry: ListEntry, item: ShopItem) => {
    if (leaving.has(entry.itemId)) return;
    setLeaving((s) => new Set(s).add(entry.itemId));
    window.setTimeout(() => {
      shop.check(entry.itemId);
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(entry.itemId);
        return n;
      });
      window.clearTimeout(undoTimer.current);
      setUndo({ entry, name: item.name });
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
    }, CHECK_MS);
  };

  const tapPantry = (item: ShopItem) => {
    if (editMode) {
      const what = item.custom ? 'löschen' : 'aus dem Vorrat ausblenden';
      if (confirm(`„${item.name}“ ${what}?`)) shop.removeItem(item);
      return;
    }
    shop.add(item.id);
  };

  return (
    <>
      <div className="shop-switch segmented" role="tablist">
        <button role="tab" aria-selected={pane === 'list'} className={pane === 'list' ? 'active' : ''} onClick={() => setPane('list')}>
          🛒 Liste{listCount > 0 ? ` · ${listCount}` : ''}
        </button>
        <button role="tab" aria-selected={pane === 'pantry'} className={pane === 'pantry' ? 'active' : ''} onClick={() => setPane('pantry')}>
          🧺 Vorrat
        </button>
      </div>
      <div className={`shop shop-show-${pane}`}>
        {/* ---------------------------------------------------- current list */}
        <section className="view shop-list" aria-label="Einkaufsliste">
          <div className="shop-pane-head">
            <h2>Einkaufsliste</h2>
            {listCount > 0 && <span className="shop-count">{listCount}</span>}
          </div>
          <div className="shop-scroll">
            {listCount === 0 ? (
              <div className="shop-empty">
                <span className="shop-empty-icon">🛒</span>
                <strong>Die Liste ist leer.</strong>
                <span className="muted">Tippe im Vorrat auf das, was fehlt.</span>
                <button className="btn primary shop-to-pantry" onClick={() => setPane('pantry')}>
                  Zum Vorrat
                </button>
              </div>
            ) : (
              <>
                <div className="shop-group-head shop-list-hint">Antippen zum Abhaken</div>
                <div className="shop-grid big">
                    {listed.map(({ entry, item }) => (
                      <button
                        key={item.id}
                        className={`shop-tile on-list ${leaving.has(item.id) ? 'leaving' : ''}`}
                        style={tileStyle(item)}
                        onClick={() => checkOff(entry, item)}
                        aria-label={`${item.name}${entry.qty > 1 ? `, ${entry.qty} Stück` : ''} abhaken`}
                      >
                        <ItemSym item={item} />
                        <span className="shop-name">{item.name}</span>
                        {entry.qty > 1 && <span className="shop-qty">×{entry.qty}</span>}
                        <span className="shop-check" aria-hidden>
                          ✓
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          {undo && (
            <div className="shop-toast" role="status">
              <span>
                <strong>{undo.name}</strong> abgehakt
              </span>
              <button
                className="btn"
                onClick={() => {
                  shop.restore(undo.entry);
                  window.clearTimeout(undoTimer.current);
                  setUndo(null);
                }}
              >
                Rückgängig
              </button>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------- pantry */}
        <section className={`view shop-pantry ${editMode ? 'editing' : ''}`} aria-label="Vorrat">
          <div className="shop-pane-head">
            <h2>Vorrat</h2>
            <div className="shop-search">
              <span aria-hidden>🔍</span>
              <input
                type="search"
                value={query}
                placeholder="Suchen…"
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
              {query && (
                <button className="shop-search-clear" onClick={() => setQuery('')} aria-label="Suche leeren">
                  ×
                </button>
              )}
            </div>
            <button className={`btn ${editMode ? 'primary' : ''}`} onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>
          <nav className="filterbar shop-cats" aria-label="Kategorien">
            <button className={`chip all ${allCats ? 'on' : ''}`} aria-pressed={allCats} onClick={() => setCats([])}>
              Alle
            </button>
            {filterCats.map((c) => (
              <CategoryChip
                key={c.id}
                cat={c}
                active={cats.includes(c.id)}
                dimmed={!allCats && !cats.includes(c.id)}
                onTap={() => setCats((cur) => (cur.length === 1 && cur[0] === c.id ? [] : [c.id]))}
                onLongPress={() => setCats((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
              />
            ))}
          </nav>
          {editMode && (
            <div className="shop-edit-hint">
              Antippen entfernt einen Artikel aus dem Vorrat.
              {shop.hidden.length > 0 && (
                <button className="link" onClick={() => shop.unhideAll()}>
                  {shop.hidden.length} ausgeblendete zurückholen
                </button>
              )}
            </div>
          )}
          <div className="shop-scroll">
            {frequent.length > 0 && (
              <div className="shop-group">
                <div className="shop-group-head">
                  <span aria-hidden>⭐</span> Häufig gekauft
                </div>
                <div className="shop-grid">
                  {frequent.map((item) => (
                    <PantryTile key={item.id} item={item} qty={qtyById.get(item.id) ?? 0} editMode={false} onTap={tapPantry} onLess={shop.setQty} />
                  ))}
                </div>
              </div>
            )}
            {q && !exact && (
              <button className="shop-quick-add" onClick={() => setCreating({ name: query.trim(), cat: 'other' })}>
                <span className="shop-emoji" aria-hidden>
                  ＋
                </span>
                „{query.trim()}“ als neuen Artikel anlegen
              </button>
            )}
            {pantryGroups.map(({ cat, items: catItems }) => (
              <div key={cat.id} className="shop-group" style={{ ['--cat' as string]: cat.color }}>
                <div className="shop-group-head">
                  <Sym emoji={cat.icon} className="shop-head-sym" /> {cat.label}
                </div>
                <div className="shop-grid">
                  {catItems.map((item) => (
                    <PantryTile key={item.id} item={item} qty={qtyById.get(item.id) ?? 0} editMode={editMode} onTap={tapPantry} onLess={shop.setQty} />
                  ))}
                  {!q && (
                    <button className="shop-tile add" onClick={() => setCreating({ name: '', cat: cat.id })} aria-label={`Neuer Artikel in ${cat.label}`}>
                      <span className="shop-emoji" aria-hidden>
                        ＋
                      </span>
                      <span className="shop-name">Neu</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!q && !pantryGroups.some((g) => g.cat.id === 'other') && !editMode && (
              <button className="shop-quick-add" onClick={() => setCreating({ name: '', cat: 'other' })}>
                <span className="shop-emoji" aria-hidden>
                  ＋
                </span>
                Eigenen Artikel anlegen
              </button>
            )}
          </div>
        </section>
      </div>
      {creating && (
        <ItemEditor
          initial={creating}
          onClose={() => setCreating(null)}
          onSave={(name, emoji, cat) => {
            const existing = items.find((i) => norm(i.name) === norm(name));
            const item = existing ?? shop.createItem(name, emoji, cat);
            shop.add(item.id);
            setCreating(null);
            setQuery('');
          }}
        />
      )}
    </>
  );
}

function PantryTile({ item, qty, editMode, onTap, onLess }: {
  item: ShopItem;
  qty: number;
  editMode: boolean;
  onTap: (item: ShopItem) => void;
  onLess: (itemId: string, qty: number) => void;
}) {
  return (
    <div className="shop-tile-wrap">
      <button
        className={`shop-tile ${qty > 0 ? 'picked' : ''} ${editMode ? 'removable' : ''}`}
        style={tileStyle(item)}
        onClick={() => onTap(item)}
        aria-label={editMode ? `${item.name} entfernen` : qty > 0 ? `${item.name}: noch eins mehr (jetzt ${qty})` : `${item.name} auf die Liste`}
      >
        <ItemSym item={item} />
        <span className="shop-name">{item.name}</span>
        {!editMode && qty > 0 && <span className="shop-qty">{qty > 1 ? `×${qty}` : '✓'}</span>}
        {editMode && (
          <span className="shop-remove" aria-hidden>
            ×
          </span>
        )}
      </button>
      {!editMode && qty > 0 && (
        <button className="shop-less" onClick={() => onLess(item.id, qty - 1)} aria-label={`${item.name}: eins weniger`}>
          −
        </button>
      )}
    </div>
  );
}

function ItemEditor({ initial, onSave, onClose }: {
  initial: { name: string; cat: CategoryId };
  onSave: (name: string, emoji: string, cat: CategoryId) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [cat, setCat] = useState<CategoryId>(initial.cat);
  const [emoji, setEmoji] = useState(() => CATEGORIES.find((c) => c.id === initial.cat)?.icon ?? '🛒');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const valid = name.trim().length > 0;
  const save = () => valid && onSave(name.trim(), emoji, cat);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shop-editor" style={{ ['--cat' as string]: catColor.get(cat) }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Neuer Artikel">
        <div className="shop-editor-preview" style={{ ['--cat' as string]: catColor.get(cat) }}>
          <span className="shop-emoji">
            <Sym emoji={emoji} />
          </span>
          <input
            ref={ref}
            value={name}
            maxLength={40}
            placeholder="Name des Artikels"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div className="todo-editor-section">
          <div className="muted small">Bild</div>
          <div className="shop-emoji-grid">
            {EMOJI_CHOICES.map((e) => (
              <button key={e} className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)} aria-pressed={emoji === e} aria-label={e}>
                <Sym emoji={e} />
              </button>
            ))}
          </div>
        </div>
        <div className="todo-editor-section">
          <div className="muted small">Wo im Laden?</div>
          <div className="todo-editor-members">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${cat === c.id ? 'on' : 'off'}`}
                style={{ paddingLeft: 12, borderColor: cat === c.id ? c.color : undefined }}
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions todo-editor-actions">
          <span className="board-spacer" />
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            Auf die Liste
          </button>
        </div>
      </div>
    </div>
  );
}
