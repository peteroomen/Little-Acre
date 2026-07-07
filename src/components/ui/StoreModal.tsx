'use client';

import { useGameStore, type StoreTab } from '@/lib/game/store';

// Shop / Boost content is presentational for M0 — the real economy (buyable seeds,
// tools, upgrades) is still being modelled. See docs/design/GDD.md "Open questions".
const SHOP_ITEMS = [
  {
    name: 'Star Lettuce',
    tag: 'Seed · Rare',
    color: '#8fce5e',
    desc: 'Sells for far more than carrots.',
    price: '120',
  },
  {
    name: 'Golden Wheat',
    tag: 'Seed · Rare',
    color: '#eecf5f',
    desc: 'Slow, but stacks with Bloom boost.',
    price: '90',
  },
  {
    name: 'Fishing Rod',
    tag: 'Tool',
    color: '#6cc3de',
    desc: 'Cast at ponds to catch fish.',
    price: '400',
  },
  {
    name: 'Iron Pickaxe',
    tag: 'Tool',
    color: '#b7ad93',
    desc: 'Break rocks for ore & gems.',
    price: '650',
  },
  {
    name: 'Pond Tile',
    tag: 'Land',
    color: '#8fd3e0',
    desc: 'Also placeable via the Build tool.',
    price: '90',
  },
  {
    name: 'Rock Tile',
    tag: 'Land',
    color: '#b7ad93',
    desc: 'Also placeable via the Build tool.',
    price: '140',
  },
];

const UPGRADES = [
  {
    name: 'Auto-Harvester',
    level: 'Lv 2',
    color: '#eecf5f',
    desc: 'Collects ripe crops for you every 8s.',
    price: '150',
  },
  {
    name: 'Sprinkler System',
    level: 'Lv 1',
    color: '#8fd3e0',
    desc: 'Auto-waters all tiles overnight.',
    price: '220',
  },
  {
    name: 'Rich Fertilizer',
    level: 'Lv 3',
    color: '#c69c6d',
    desc: 'Feed advances two stages at once.',
    price: '180',
  },
  {
    name: 'Extra Energy',
    level: 'Lv 1',
    color: '#f5a623',
    desc: '+4 clicks each day.',
    price: '260',
  },
];

const GUIDE: {
  title: string;
  items: { key: string; name: string; color: string; desc: string }[];
}[] = [
  {
    title: 'Crops',
    items: [
      { key: 'carrot', name: 'Carrot', color: '#f0894a', desc: 'Cheap & fast — ripe in 2 nights.' },
      { key: 'potato', name: 'Potato', color: '#c49a5c', desc: 'Reliable staple — 3 nights.' },
      {
        key: 'tomato',
        name: 'Tomato',
        color: '#ef6a4e',
        desc: 'Plant once, re-harvest 3× on the vine.',
      },
    ],
  },
  {
    title: 'Land & Features',
    items: [
      { key: 'plot', name: 'Plot', color: '#c69c6d', desc: 'Tilled soil, ready to plant.' },
      {
        key: 'flower',
        name: 'Wildflowers',
        color: '#c9a6ff',
        desc: 'Attracts pollinators for a boost.',
      },
      { key: 'pond', name: 'Pond', color: '#8fd3e0', desc: 'Click to fish for coins.' },
      { key: 'rock', name: 'Rock', color: '#b7ad93', desc: 'Mine for ore & rare gems.' },
    ],
  },
  {
    title: 'Structures',
    items: [
      {
        key: 'sprinkler',
        name: 'Sprinkler',
        color: '#6cc3de',
        desc: 'Auto-waters its tile overnight.',
      },
      { key: 'scarecrow', name: 'Scarecrow', color: '#c79a5a', desc: 'Keeps crops from wilting.' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { key: 'coin', name: 'Coins', color: '#f7c948', desc: 'Spent on seeds, land & tools.' },
      { key: 'gem', name: 'Gems', color: '#a98bf0', desc: 'Rare drop from mining rocks.' },
      { key: 'fish', name: 'Fish', color: '#f0894a', desc: 'Caught at ponds for coins.' },
      { key: 'ore', name: 'Ore', color: '#b3ab92', desc: 'Mined from rocky outcrops.' },
    ],
  },
];

export function StoreModal() {
  const open = useGameStore((s) => s.storeOpen);
  const tab = useGameStore((s) => s.storeTab);
  const seen = useGameStore((s) => s.seen);
  const closeStore = useGameStore((s) => s.closeStore);
  const setStoreTab = useGameStore((s) => s.setStoreTab);
  const rebloom = useGameStore((s) => s.rebloom);

  if (!open) return null;

  return (
    <div
      onClick={closeStore}
      className="absolute inset-0 z-20 flex items-center justify-center p-4"
      style={{ background: 'rgba(80,60,35,.3)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="la-anim max-h-[86vh] w-full max-w-[640px] overflow-auto bg-[#fdf6e7] shadow-[inset_0_0_0_4px_#e7cfa5]"
        style={{ animation: 'la-pop .16s ease-out' }}
      >
        <div className="sticky top-0 z-[2] flex items-center justify-between bg-[#fdf6e7] px-4 pb-2.5 pt-4">
          <div className="flex gap-1.5">
            {(['shop', 'boost', 'guide'] as StoreTab[]).map((t) => (
              <Tab key={t} label={t} on={tab === t} onClick={() => setStoreTab(t)} />
            ))}
          </div>
          <button
            onClick={closeStore}
            className="la-notch h-[34px] w-[34px] bg-[#fff1dd] text-base text-[#a0895f] shadow-[inset_0_0_0_3px_#e7cfa5]"
            aria-label="Close store"
          >
            ✕
          </button>
        </div>

        {tab === 'shop' && (
          <div
            className="grid gap-2.5 px-4 pb-4.5 pt-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(178px,1fr))' }}
          >
            {SHOP_ITEMS.map((it) => (
              <div
                key={it.name}
                className="la-notch flex flex-col gap-2 bg-[#fffaf0] p-3 shadow-[inset_0_0_0_3px_#f0e0c4]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="la-notch h-[34px] w-[34px] flex-none"
                    style={{ background: it.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#5a462f]">{it.name}</div>
                    <div className="text-[11px] text-[#a08862]">{it.tag}</div>
                  </div>
                </div>
                <div className="min-h-[32px] text-xs leading-snug text-[#7a6547]">{it.desc}</div>
                <PriceButton price={it.price} />
              </div>
            ))}
          </div>
        )}

        {tab === 'boost' && (
          <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1">
            {UPGRADES.map((up) => (
              <div
                key={up.name}
                className="la-notch flex items-center gap-3 bg-[#fffaf0] px-3.5 py-3 shadow-[inset_0_0_0_3px_#f0e0c4]"
              >
                <span className="la-notch h-10 w-10 flex-none" style={{ background: up.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-[#5a462f]">{up.name}</span>
                    <span className="font-pixel text-xs text-[#c46d38] bg-[#ffe6cf] px-1.5 py-px">
                      {up.level}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#7a6547]">{up.desc}</div>
                </div>
                <PriceButton price={up.price} amber />
              </div>
            ))}
            <div className="la-notch mt-1.5 flex items-center gap-3 bg-[#efe4ff] p-3.5 shadow-[inset_0_0_0_3px_#d3bff2]">
              <span className="h-10 w-10 flex-none rotate-45 bg-[var(--la-gem)] shadow-[inset_0_0_0_3px_#c3aef8]" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[#6a4bb0]">Prestige · Bloom Reset</div>
                <div className="mt-0.5 text-xs text-[#8a73c0]">
                  Reset your farm for a permanent ×1.6 harvest multiplier and 8 gems.
                </div>
              </div>
              <button
                onClick={rebloom}
                className="la-notch flex-none bg-[#a98bf5] px-3.5 py-2.5 font-pixel text-[13px] font-semibold text-white shadow-[inset_0_3px_0_rgba(255,255,255,.35),inset_0_-5px_0_rgba(60,40,120,.35),inset_0_0_0_3px_#c3aef8] active:translate-y-0.5"
              >
                Rebloom
              </button>
            </div>
          </div>
        )}

        {tab === 'guide' && (
          <div className="flex flex-col gap-3.5 px-4 pb-4.5 pt-1">
            {GUIDE.map((cat) => (
              <div key={cat.title}>
                <div className="mb-1.5 font-pixel text-xs uppercase tracking-wider text-[#c99a6e]">
                  {cat.title}
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(158px,1fr))' }}
                >
                  {cat.items.map((g) => {
                    const on = !!seen[g.key];
                    return (
                      <div
                        key={g.key}
                        className="la-notch flex items-center gap-2.5 bg-[#fffaf0] px-2.5 py-2.5 shadow-[inset_0_0_0_3px_#f0e0c4]"
                        style={{ opacity: on ? 1 : 0.5 }}
                      >
                        <span
                          className="la-notch h-[30px] w-[30px] flex-none"
                          style={{ background: on ? g.color : '#d7c8ac' }}
                        />
                        <div className="min-w-0">
                          <div className="font-pixel text-[13px] text-[#5a462f]">
                            {on ? g.name : '? ? ?'}
                          </div>
                          <div className="text-[11px] leading-tight text-[#a08862]">
                            {on ? g.desc : 'Not yet discovered'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="la-notch px-3.5 py-2 font-pixel text-[15px] font-semibold capitalize"
      style={{
        color: on ? '#6b5236' : '#b0996f',
        background: on ? '#ffe6bd' : '#f3e6cc',
        boxShadow: `inset 0 0 0 3px ${on ? '#e6c489' : '#e7d6b4'}`,
      }}
    >
      {label}
    </button>
  );
}

function PriceButton({ price, amber }: { price: string; amber?: boolean }) {
  return (
    <button
      className={`la-notch mt-auto flex items-center justify-center gap-1.5 px-3 py-2 font-pixel text-sm font-semibold active:translate-y-0.5 ${
        amber
          ? 'bg-[#ffd79b] text-[#7a4a12] shadow-[inset_0_0_0_3px_#ffe6bd]'
          : 'bg-[var(--la-leaf)] text-[var(--la-leaf-text)] shadow-[inset_0_0_0_3px_#bfe89b]'
      }`}
    >
      <span className="h-3.5 w-3.5 bg-[var(--la-coin)] shadow-[inset_0_0_0_2px_#fce9b0]" />
      {price}
    </button>
  );
}
