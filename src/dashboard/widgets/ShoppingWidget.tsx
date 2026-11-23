import { useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../../store';
import { BUILTIN, CATEGORIES, type ListEntry, type ShopItem } from '../../lib/shopping';
import { Head, stop, useDash, useUndo, type WidgetProps } from './shared';
import { t } from '../../i18n';
import { Sym } from '../../components/Sym';

const CAT_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));
/** department icon: the symbol for items whose own emoji is missing in the chosen symbol style */
const CAT_ICON = new Map(CATEGORIES.map((c) => [c.id, c.icon]));

export function ShoppingWidget({ size }: WidgetProps) {
  const { shopping } = useDash();
  const { paint } = useStore();
  const [setUndo, undoNode] = useUndo();
  const [leaving, setLeaving] = useState<string[]>([]);
  const items = useMemo(() => {
    const m = new Map<string, ShopItem>();
    for (const i of BUILTIN) m.set(i.id, i);
    for (const i of shopping.custom) m.set(i.id, i);
    return m;
  }, [shopping.custom]);
  const list = shopping.list
    .map((e) => ({ e, item: items.get(e.itemId) }))
    .filter((x): x is { e: ListEntry; item: ShopItem } => !!x.item)
    .sort((a, b) => (CAT_ORDER.get(a.item.cat) ?? 99) - (CAT_ORDER.get(b.item.cat) ?? 99));

  const check = (entry: ListEntry, item: ShopItem) => {
    setLeaving((l) => [...l, entry.itemId]);
    setTimeout(() => {
      shopping.check(entry.itemId);
      setLeaving((l) => l.filter((x) => x !== entry.itemId));
      setUndo({ label: `${item.emoji} ${item.name}`, fn: () => shopping.restore(entry) });
    }, 350);
  };

  if (size === 's') {
    return (
      <div className="dw-count">
        <Head icon="🛒" title={t('dashboard.shopping')} />
        <div className="dw-count-num">{list.length}</div>
        <div className="dw-count-label">{t('dashboard.onList', { n: list.length })}</div>
        <div className="dw-count-emoji">
          {list.slice(0, 6).map(({ e, item }) => (
            <span key={e.itemId} style={{ '--cat': paint(CATEGORIES.find((c) => c.id === item.cat)?.color) } as CSSProperties}>
              <Sym emoji={item.emoji} fallback={CAT_ICON.get(item.cat)} />
            </span>
          ))}
        </div>
        {undoNode}
      </div>
    );
  }

  return (
    <div className={`dw-shop ${size}`}>
      <Head icon="🛒" title={t('dashboard.widgets.shopping.title')} meta={list.length || undefined} />
      <div className={`dw-body dw-scroll ${size === 'm' || size === 'l' ? 'tiles' : ''}`}>
        {list.length === 0 && <div className="dw-none">{t('dashboard.listEmpty')}</div>}
        {list.map(({ e, item }) => {
          const color = paint(CATEGORIES.find((c) => c.id === item.cat)?.color);
          return (
            <button
              key={e.itemId}
              className={`dw-shop-item ${leaving.includes(e.itemId) ? 'leaving' : ''}`}
              style={{ '--cat': color } as CSSProperties}
              onClick={(ev) => {
                stop(ev);
                check(e, item);
              }}
              aria-label={t('dashboard.check', { name: item.name })}
            >
              <span className="dw-shop-emoji">
                <Sym emoji={item.emoji} fallback={CAT_ICON.get(item.cat)} />
              </span>
              <span className="dw-shop-name">{item.name}</span>
              {e.qty > 1 && <span className="dw-shop-qty">{e.qty}×</span>}
            </button>
          );
        })}
      </div>
      {undoNode}
    </div>
  );
}
