import { uid } from './id';
import { arrayOf, isRecord, isString, persisted, usePersisted } from './persisted';

const KEY = 'fc.shopping';

export type CategoryId =
  'produce' | 'bakery' | 'dairy' | 'meat' | 'pantry' | 'breakfast' | 'drinks' | 'frozen' | 'care' | 'household' | 'other';

/** Order roughly follows a walk through a German supermarket. */
export const CATEGORIES: { id: CategoryId; label: string; /** chip label */ short: string; icon: string; color: string }[] = [
  { id: 'produce', label: 'Obst & Gemüse', short: 'Obst & Gemüse', icon: '🥦', color: '#4caf50' },
  { id: 'bakery', label: 'Brot & Backwaren', short: 'Brot', icon: '🥐', color: '#c58b45' },
  { id: 'dairy', label: 'Milch, Käse & Eier', short: 'Milch & Käse', icon: '🧀', color: '#e3b72c' },
  { id: 'meat', label: 'Fleisch, Wurst & Fisch', short: 'Fleisch & Wurst', icon: '🥩', color: '#d9534f' },
  { id: 'pantry', label: 'Nudeln, Backen & Würzen', short: 'Nudeln & Co.', icon: '🍝', color: '#d98a3a' },
  { id: 'breakfast', label: 'Frühstück, Kaffee & Süßes', short: 'Frühstück & Süßes', icon: '🍯', color: '#a0673c' },
  { id: 'drinks', label: 'Getränke', short: 'Getränke', icon: '🥤', color: '#3b8fd9' },
  { id: 'frozen', label: 'Tiefkühl', short: 'Tiefkühl', icon: '🧊', color: '#5bb8d6' },
  { id: 'care', label: 'Drogerie & Pflege', short: 'Drogerie', icon: '🧴', color: '#b06ad1' },
  { id: 'household', label: 'Haushalt', short: 'Haushalt', icon: '🧻', color: '#7d8a99' },
  { id: 'other', label: 'Sonstiges', short: 'Sonstiges', icon: '🛒', color: '#8a8f98' },
];

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  cat: CategoryId;
  /** created by the family, not part of the built-in catalogue */
  custom?: boolean;
}

// [id, name, emoji]
const CATALOG: Record<Exclude<CategoryId, 'other'>, [string, string, string][]> = {
  produce: [
    ['apples', 'Äpfel', '🍎'],
    ['bananas', 'Bananen', '🍌'],
    ['pears', 'Birnen', '🍐'],
    ['grapes', 'Trauben', '🍇'],
    ['strawberries', 'Erdbeeren', '🍓'],
    ['blueberries', 'Heidelbeeren', '🫐'],
    ['oranges', 'Orangen', '🍊'],
    ['mandarins', 'Mandarinen', '🍊'],
    ['lemons', 'Zitronen', '🍋'],
    ['kiwis', 'Kiwis', '🥝'],
    ['melon', 'Melone', '🍉'],
    ['pineapple', 'Ananas', '🍍'],
    ['avocado', 'Avocado', '🥑'],
    ['tomatoes', 'Tomaten', '🍅'],
    ['cucumber', 'Gurke', '🥒'],
    ['peppers', 'Paprika', '🫑'],
    ['lettuce', 'Salat', '🥬'],
    ['potatoes', 'Kartoffeln', '🥔'],
    ['sweetpotatoes', 'Süßkartoffeln', '🍠'],
    ['onions', 'Zwiebeln', '🧅'],
    ['garlic', 'Knoblauch', '🧄'],
    ['carrots', 'Möhren', '🥕'],
    ['kohlrabi', 'Kohlrabi', '🥬'],
    ['cauliflower', 'Blumenkohl', '🥦'],
    ['broccoli', 'Brokkoli', '🥦'],
    ['zucchini', 'Zucchini', '🥒'],
    ['mushrooms', 'Champignons', '🍄'],
    ['corn', 'Mais', '🌽'],
    ['herbs', 'Kräuter', '🌿'],
  ],
  bakery: [
    ['bread', 'Brot', '🍞'],
    ['toast', 'Toastbrot', '🍞'],
    ['rolls', 'Brötchen', '🥖'],
    ['chocrolls', 'Schokobrötchen', '🥐'],
    ['croissants', 'Croissants', '🥐'],
    ['pretzels', 'Brezeln', '🥨'],
    ['crispbread', 'Knäckebrot', '🍘'],
    ['wraps', 'Wraps', '🌯'],
  ],
  dairy: [
    ['milk', 'Milch', '🥛'],
    ['lfmilk', 'Laktosefreie Milch', '🥛'],
    ['yogurt', 'Joghurt', '🥣'],
    ['quark', 'Quark', '🥣'],
    ['butter', 'Butter', '🧈'],
    ['saltbutter', 'Salzige Butter', '🧈'],
    ['cheeseslices', 'Käsescheiben', '🧀'],
    ['gouda', 'Gouda', '🧀'],
    ['creamcheese', 'Frischkäse', '🧀'],
    ['mozzarella', 'Mozzarella', '🧀'],
    ['parmesan', 'Parmesan', '🧀'],
    ['cream', 'Sahne', '🥛'],
    ['eggs', 'Eier', '🥚'],
    ['pudding', 'Pudding', '🍮'],
  ],
  meat: [
    ['salami', 'Salami', '🍖'],
    ['liverwurst', 'Leberwurst', '🌭'],
    ['teewurst', 'Teewurst', '🥪'],
    ['ham', 'Schinken', '🥓'],
    ['mince', 'Hackfleisch', '🥩'],
    ['chicken', 'Hähnchen', '🍗'],
    ['schnitzel', 'Schnitzel', '🥩'],
    ['sausages', 'Würstchen', '🌭'],
    ['salmon', 'Lachs', '🐟'],
  ],
  pantry: [
    ['pasta', 'Nudeln', '🍝'],
    ['rice', 'Reis', '🍚'],
    ['flour', 'Mehl', '🌾'],
    ['sugar', 'Zucker', '🍬'],
    ['salt', 'Salz', '🧂'],
    ['pepper', 'Pfeffer', '🌶️'],
    ['oil', 'Öl', '🫒'],
    ['vinegar', 'Essig', '🍶'],
    ['bakingpowder', 'Backpulver', '🧁'],
    ['tomatosauce', 'Passierte Tomaten', '🥫'],
    ['broth', 'Brühe', '🍲'],
    ['ketchup', 'Ketchup', '🍅'],
    ['mustard', 'Senf', '🌭'],
    ['oats', 'Haferflocken', '🌾'],
    ['lentils', 'Linsen', '🫘'],
  ],
  breakfast: [
    ['muesli', 'Müsli', '🥣'],
    ['cornflakes', 'Cornflakes', '🥣'],
    ['honey', 'Honig', '🍯'],
    ['jam', 'Marmelade', '🍓'],
    ['nutella', 'Nuss-Nougat-Creme', '🌰'],
    ['cocoa', 'Kakaopulver', '🍫'],
    ['corny', 'Corny', '🍫'],
    ['chocolate', 'Schokolade', '🍫'],
    ['cookies', 'Kekse', '🍪'],
    ['gummies', 'Gummibärchen', '🐻'],
    ['chips', 'Chips', '🍟'],
    ['popcorn', 'Popcorn', '🍿'],
    ['espresso', 'Espressobohnen', '☕'],
    ['coffee', 'Kaffee', '☕'],
    ['tea', 'Tee', '🍵'],
  ],
  drinks: [
    ['water', 'Wasser', '💧'],
    ['smallwater', 'Kleine Wasserflaschen', '💧'],
    ['applespritzer', 'Apfelschorle', '🧃'],
    ['applejuice', 'Apfelsaft', '🧃'],
    ['orangejuice', 'Orangensaft', '🧃'],
    ['cola', 'Cola', '🥤'],
    ['sprite', 'Sprite', '🥤'],
    ['fanta', 'Fanta', '🥤'],
    ['sodastream', 'Sodastream-Kartuschen', '🫧'],
    ['beer', 'Bier', '🍺'],
    ['wine', 'Wein', '🍷'],
  ],
  frozen: [
    ['pizza', 'Pizza', '🍕'],
    ['fries', 'Pommes', '🍟'],
    ['fishsticks', 'Fischstäbchen', '🐟'],
    ['frozenveg', 'TK-Gemüse', '🥦'],
    ['icecream', 'Eis', '🍦'],
  ],
  care: [
    ['toothpaste', 'Zahnpasta', '🪥'],
    ['kidstoothpaste', 'Kinderzahnpasta', '🪥'],
    ['toothbrushes', 'Zahnbürsten', '🪥'],
    ['shampoo', 'Shampoo', '🧴'],
    ['showergel', 'Duschgel', '🧴'],
    ['conditioner', 'Haarspülung', '🧴'],
    ['soap', 'Seife', '🧼'],
    ['deo', 'Deo', '🧴'],
    ['cottonbuds', 'Ohrstäbchen', '👂'],
    ['cottonpads', 'Wattepads', '☁️'],
    ['sunscreen', 'Sonnencreme', '☀️'],
    ['plasters', 'Pflaster', '🩹'],
    ['razor', 'Rasierer', '🪒'],
  ],
  household: [
    ['toiletpaper', 'Toilettenpapier', '🧻'],
    ['tissues', 'Papiertücher', '🤧'],
    ['kitchenroll', 'Küchenrolle', '🧻'],
    ['dishsoap', 'Spülmittel', '🧽'],
    ['dishtabs', 'Spülmaschinentabs', '🫧'],
    ['detergent', 'Waschmittel', '🧺'],
    ['softener', 'Weichspüler', '🧺'],
    ['bins', 'Müllbeutel', '🗑️'],
    ['foil', 'Alufolie', '📜'],
    ['bakingpaper', 'Backpapier', '📜'],
    ['sponges', 'Schwämme', '🧽'],
    ['cleaner', 'Allzweckreiniger', '🧴'],
    ['batteries', 'Batterien', '🔋'],
  ],
};

export const BUILTIN: ShopItem[] = Object.entries(CATALOG).flatMap(([cat, items]) =>
  items.map(([id, name, emoji]) => ({ id, name, emoji, cat: cat as CategoryId })),
);

/** Emoji offered when the family adds their own item. */
export const EMOJI_CHOICES = [
  '🛒',
  '🍎',
  '🥕',
  '🥬',
  '🍞',
  '🥛',
  '🧀',
  '🥩',
  '🐟',
  '🍝',
  '🥫',
  '🧂',
  '🍯',
  '🍫',
  '🍪',
  '☕',
  '🥤',
  '🧃',
  '🍺',
  '🧊',
  '🧴',
  '🧼',
  '🪥',
  '🧻',
  '🧽',
  '🧺',
  '🔋',
  '💊',
  '🐶',
  '🐱',
  '🎁',
  '🌷',
];

export interface ListEntry {
  itemId: string;
  qty: number;
  addedAt: number;
}

interface State {
  list: ListEntry[];
  custom: ShopItem[];
  /** built-in items the family does not need */
  hidden: string[];
  /** how often each item was bought, for the "Häufig" row */
  bought: Record<string, number>;
}

const EMPTY: State = { list: [], custom: [], hidden: [], bought: {} };

const isEntry = (e: unknown): e is ListEntry => isRecord(e) && typeof e.itemId === 'string' && typeof e.qty === 'number';
const isItem = (i: unknown): i is ShopItem => isRecord(i) && typeof i.id === 'string' && typeof i.name === 'string';

function parseState(raw: unknown): State {
  if (!isRecord(raw)) return EMPTY;
  const bought: Record<string, number> = {};
  if (isRecord(raw.bought)) for (const [k, v] of Object.entries(raw.bought)) if (typeof v === 'number') bought[k] = v;
  return {
    list: arrayOf(raw.list, isEntry),
    custom: arrayOf(raw.custom, isItem),
    hidden: arrayOf(raw.hidden, isString),
    bought,
  };
}

const shopping = persisted<State>(KEY, parseState);

/* actions – module functions, so they are stable for React */

/** tap in the pantry: put on the list, or one more if it is already there */
function add(itemId: string) {
  shopping.set((s) => {
    const has = s.list.some((e) => e.itemId === itemId);
    const list = has
      ? s.list.map((e) => (e.itemId === itemId ? { ...e, qty: Math.min(e.qty + 1, 99) } : e))
      : [...s.list, { itemId, qty: 1, addedAt: Date.now() }];
    return { ...s, list };
  });
}

function setQty(itemId: string, qty: number) {
  shopping.set((s) => ({
    ...s,
    list: qty <= 0 ? s.list.filter((e) => e.itemId !== itemId) : s.list.map((e) => (e.itemId === itemId ? { ...e, qty } : e)),
  }));
}

/** bought: off the list, remembered for the "Häufig" row */
function check(itemId: string) {
  shopping.set((s) => {
    if (!s.list.some((e) => e.itemId === itemId)) return s;
    return {
      ...s,
      list: s.list.filter((e) => e.itemId !== itemId),
      bought: { ...s.bought, [itemId]: (s.bought[itemId] ?? 0) + 1 },
    };
  });
}

/** undo a check */
function restore(entry: ListEntry) {
  shopping.set((s) => {
    if (s.list.some((e) => e.itemId === entry.itemId)) return s;
    const n = (s.bought[entry.itemId] ?? 1) - 1;
    const bought = { ...s.bought };
    if (n > 0) bought[entry.itemId] = n;
    else delete bought[entry.itemId];
    return { ...s, list: [...s.list, entry], bought };
  });
}

function createItem(name: string, emoji: string, cat: CategoryId): ShopItem {
  const item: ShopItem = { id: `c-${uid()}`, name, emoji, cat, custom: true };
  shopping.set((s) => ({ ...s, custom: [...s.custom, item] }));
  return item;
}

/** custom items are deleted, built-in ones only hidden */
function removeItem(item: ShopItem) {
  shopping.set((s) => ({
    ...s,
    list: s.list.filter((e) => e.itemId !== item.id),
    custom: item.custom ? s.custom.filter((c) => c.id !== item.id) : s.custom,
    hidden: item.custom || s.hidden.includes(item.id) ? s.hidden : [...s.hidden, item.id],
  }));
}

function unhideAll() {
  shopping.set((s) => ({ ...s, hidden: [] }));
}

/** The shopping list and pantry (per device; other tabs stay in sync). */
export function useShopping() {
  return { ...usePersisted(shopping), add, setQty, check, restore, createItem, removeItem, unhideAll };
}

/** Case- and umlaut-insensitive compare for the search box. */
export function norm(s: string): string {
  return s
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}
