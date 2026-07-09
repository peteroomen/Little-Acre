'use client';

import { useState, type ReactNode } from 'react';
import { useGameStore } from '@/lib/game/store';
import { BOARD_TIERS, CROPS, LAND, STRUCT } from '@/lib/game/tiles';
import { isMaxed, UPGRADE_DEFS, UPGRADE_IDS, upgradeCost } from '@/lib/game/upgrades';

/**
 * Store modal — restyled to the mockup Store screen (docs/design/mockups/Little Acre.dc.html,
 * data-screen-label="Store"). Five tabs:
 *   Shop     — presentational (seeds/tools/land land with the tool + Tier-2 systems, later slices)
 *   Expand   — REAL: board-size tiers, wired to boardTier / buyExpansion
 *   Boost    — REAL: levelled upgrades, wired to buyUpgrade (+ a quiet Rebloom)
 *   Craft    — presentational: the workshop is being built; recipe cards preview the system
 *   Almanac  — REAL discovery guide (behaviour unchanged)
 * Craft + Expand aren't in the store's StoreTab union (store logic is untouched here), so the
 * active tab is local UI state. All chrome hexes live in the `/* S3: store *​/` block in globals.css.
 */

type Tab = 'shop' | 'expand' | 'boost' | 'craft' | 'guide';
const TABS: { id: Tab; label: string }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'expand', label: 'Expand' },
  { id: 'boost', label: 'Boost' },
  { id: 'craft', label: 'Craft' },
  { id: 'guide', label: 'Almanac' },
];

// Presentational storefront — arrives with the seed-unlock & tool systems (see ROADMAP). Colours
// are sampled from the live crop/land/structure defs so the swatches match the real art.
const SHOP_ITEMS: { name: string; tag: string; color: string; desc: string }[] = [
  {
    name: 'Star Lettuce',
    tag: 'Seed · Tier II',
    color: 'var(--la-leaf)',
    desc: 'Premium greens — sells for far more than a carrot.',
  },
  {
    name: 'Golden Pumpkin',
    tag: 'Seed · Tier II',
    color: 'var(--la-coin)',
    desc: 'Slow to swell, but stacks beautifully with Bloom.',
  },
  {
    name: 'Copper Rod',
    tag: 'Tool · Tier I',
    color: STRUCT.sprinkler.color,
    desc: 'The pond holds one extra fish each day.',
  },
  {
    name: 'Copper Pick',
    tag: 'Tool · Tier I',
    color: LAND.rock.color,
    desc: 'Rocks take one extra strike before they rest.',
  },
  {
    name: 'Pond Tile',
    tag: 'Land',
    color: LAND.pond.color,
    desc: 'A ready-made pond — also placed from the radial.',
  },
  {
    name: 'Rock Tile',
    tag: 'Land',
    color: LAND.rock.color,
    desc: 'A mineable outcrop — also placed from the radial.',
  },
];

// Presentational craft previews — no live machines yet, so every button is disabled (never a
// toast pretending to work). Colours reuse existing accent tokens; locked recipes grey out.
const CRAFTS: {
  name: string;
  tag: string;
  color: string;
  btn: string;
  note?: string;
  ing: { label: string; ok: boolean }[];
}[] = [
  {
    name: 'Copper Bar',
    tag: 'Forge · smelt raw ore',
    color: 'var(--la-orange)',
    btn: 'Forge',
    ing: [{ label: '5 × Copper Ore', ok: true }],
  },
  {
    name: 'Sturdy Pick II',
    tag: 'Tool · Tier II',
    color: 'var(--la-ore)',
    btn: 'Craft',
    ing: [
      { label: '0 / 2 × Copper Bar', ok: false },
      { label: '1 × Oak Handle', ok: true },
    ],
  },
  {
    name: 'Smoked Fish',
    tag: 'Artisan good · worth 3× fresh',
    color: 'var(--la-fish)',
    btn: 'Smoke',
    note: 'Needs Furnace',
    ing: [
      { label: '2 × Fish', ok: true },
      { label: '1 × Oak Chips', ok: true },
    ],
  },
  {
    name: 'Berry Preserves',
    tag: 'Artisan good · worth 4× fresh',
    color: 'var(--la-coin)',
    btn: 'Brew',
    note: 'Needs Keg',
    ing: [{ label: '3 × Berries', ok: true }],
  },
];

const GUIDE: {
  title: string;
  items: { key: string; name: string; color: string; desc: string }[];
}[] = [
  {
    title: 'Crops',
    items: [
      {
        key: 'carrot',
        name: 'Carrot',
        color: CROPS.carrot.color,
        desc: 'Cheap & fast — ripe in 2 nights.',
      },
      {
        key: 'potato',
        name: 'Potato',
        color: CROPS.potato.color,
        desc: 'Reliable staple — 3 nights.',
      },
      {
        key: 'tomato',
        name: 'Tomato',
        color: CROPS.tomato.color,
        desc: 'Plant once, re-harvest on the vine.',
      },
    ],
  },
  {
    title: 'Land & Features',
    items: [
      {
        key: 'plot',
        name: 'Tilled Plot',
        color: LAND.plot.color,
        desc: 'Soft soil, ready to plant.',
      },
      {
        key: 'flower',
        name: 'Wildflowers',
        color: LAND.flower.color,
        desc: 'Pollinators adore them.',
      },
      {
        key: 'pond',
        name: 'Pond',
        color: LAND.pond.color,
        desc: 'Cast for fish · restocks overnight.',
      },
      {
        key: 'rock',
        name: 'Rock',
        color: LAND.rock.color,
        desc: 'Mine for ore · rests when spent.',
      },
    ],
  },
  {
    title: 'Structures',
    items: [
      {
        key: 'sprinkler',
        name: 'Sprinkler',
        color: STRUCT.sprinkler.color,
        desc: 'Waters its tile + neighbours.',
      },
      {
        key: 'scarecrow',
        name: 'Scarecrow',
        color: STRUCT.scarecrow.color,
        desc: 'Keeps dry crops from wilting.',
      },
    ],
  },
  {
    title: 'Goods',
    items: [
      {
        key: 'coin',
        name: 'Coins',
        color: 'var(--la-coin)',
        desc: 'Spent on seeds, land & tools.',
      },
      {
        key: 'gem',
        name: 'Gems',
        color: 'var(--la-gem)',
        desc: 'A rare, lucky strike from mining.',
      },
      { key: 'fish', name: 'Fish', color: 'var(--la-fish)', desc: 'Caught at ponds for coins.' },
      { key: 'ore', name: 'Ore', color: 'var(--la-ore)', desc: 'Chipped from rocky outcrops.' },
    ],
  },
];

const GUIDE_KEYS = GUIDE.flatMap((c) => c.items.map((i) => i.key));

export function StoreModal() {
  const open = useGameStore((s) => s.storeOpen);
  const seen = useGameStore((s) => s.seen);
  const coins = useGameStore((s) => s.coins);
  const upgrades = useGameStore((s) => s.upgrades);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const boardTier = useGameStore((s) => s.boardTier);
  const buyExpansion = useGameStore((s) => s.buyExpansion);
  const closeStore = useGameStore((s) => s.closeStore);
  const rebloom = useGameStore((s) => s.rebloom);
  const goMenu = useGameStore((s) => s.goMenu);

  const [tab, setTab] = useState<Tab>('shop');

  if (!open) return null;

  const seenCount = GUIDE_KEYS.filter((k) => seen[k]).length;

  return (
    <div
      onClick={closeStore}
      className="absolute inset-0 z-20 flex items-center justify-center p-4"
      style={{ background: 'rgba(80,60,35,.3)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="la-anim la-notch-7 max-h-[86vh] w-full max-w-[620px] overflow-auto"
        style={{
          background: 'var(--la-modal)',
          boxShadow: 'inset 0 0 0 4px var(--la-panel-line)',
          filter: 'drop-shadow(0 8px 0 var(--la-panel-shadow))',
          animation: 'la-pop .16s ease-out',
        }}
      >
        <div
          className="sticky top-0 z-[2] flex items-start justify-between gap-2 px-4 pb-2.5 pt-4"
          style={{ background: 'var(--la-modal)' }}
        >
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <TabButton
                key={t.id}
                label={t.label}
                on={tab === t.id}
                onClick={() => setTab(t.id)}
              />
            ))}
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <button
              onClick={goMenu}
              className="la-notch h-[34px] px-3 font-pixel text-[13px] font-semibold text-[var(--la-quiet-text)] active:translate-y-0.5"
              style={{
                background: 'var(--la-quiet)',
                boxShadow: 'inset 0 0 0 3px var(--la-panel-line)',
              }}
            >
              Exit
            </button>
            <button
              onClick={closeStore}
              className="la-notch-3 h-[34px] w-[34px] text-base text-[var(--la-quiet-text)]"
              style={{
                background: 'var(--la-quiet)',
                boxShadow: 'inset 0 0 0 3px var(--la-panel-line)',
              }}
              aria-label="Close store"
            >
              ✕
            </button>
          </div>
        </div>

        {tab === 'shop' && <ShopPanel />}
        {tab === 'expand' && (
          <ExpandPanel boardTier={boardTier} coins={coins} onBuy={buyExpansion} />
        )}
        {tab === 'boost' && (
          <BoostPanel coins={coins} upgrades={upgrades} onBuy={buyUpgrade} onRebloom={rebloom} />
        )}
        {tab === 'craft' && <CraftPanel />}
        {tab === 'guide' && (
          <GuidePanel seen={seen} seenCount={seenCount} total={GUIDE_KEYS.length} />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Shop ─────────────────────────── */

function ShopPanel() {
  return (
    <div className="px-4 pb-4.5 pt-1">
      <InfoBanner tone="warm">
        The market stall is still stocking — seeds & tools open up with the shop system.
      </InfoBanner>
      <div
        className="mt-2.5 grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(178px,1fr))' }}
      >
        {SHOP_ITEMS.map((it) => (
          <div
            key={it.name}
            className="la-notch flex flex-col gap-2 p-3"
            style={{
              background: 'var(--la-card)',
              boxShadow: 'inset 0 0 0 3px var(--la-card-line)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <Swatch color={it.color} size={34} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--la-ink)]">{it.name}</div>
                <div className="text-[11px] text-[var(--la-muted-2)]">{it.tag}</div>
              </div>
            </div>
            <div className="min-h-[32px] text-xs leading-snug text-[var(--la-body)]">{it.desc}</div>
            <PriceButton state="done" label="Soon" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Expand ─────────────────────────── */

function ExpandPanel({
  boardTier,
  coins,
  onBuy,
}: {
  boardTier: number;
  coins: number;
  onBuy: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-4.5 pt-1">
      <InfoBanner tone="green">
        Grow your little acre. Each expansion re-centres the farm and keeps every tile.
      </InfoBanner>
      {BOARD_TIERS.map((t, i) => {
        const owned = i <= boardTier;
        const isNext = i === boardTier + 1;
        const cost = t.cost;
        const afford = coins >= cost;
        const prevSize = i > 0 ? BOARD_TIERS[i - 1].size : t.size;
        return (
          <div
            key={t.size}
            className="la-notch flex items-center gap-3 px-3.5 py-3"
            style={{
              background: 'var(--la-expand-bg)',
              boxShadow: 'inset 0 0 0 3px var(--la-expand-line)',
              opacity: owned || isNext ? 1 : 0.62,
            }}
          >
            <MiniGrid size={t.size} faint={!owned && !isNext} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--la-expand-ink)]">
                  {t.size}×{t.size} Farm
                </span>
                {owned && (
                  <span
                    className="font-pixel text-xs text-[var(--la-expand-pill-text)] px-1.5 py-px"
                    style={{ background: 'var(--la-expand-pill-bg)' }}
                  >
                    {i === boardTier ? 'Current' : 'Owned'}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-[var(--la-expand-sub)]">
                {i === 0
                  ? 'Where every farm begins.'
                  : owned
                    ? `${t.size * t.size} tiles of tended ground.`
                    : isNext
                      ? `Room for ${t.size * t.size} tiles.`
                      : `Unlock the ${prevSize}×${prevSize} farm first.`}
              </div>
            </div>
            {owned ? (
              <PriceButton state="done" label="✓" />
            ) : isNext ? (
              <PriceButton
                state={afford ? 'buy' : 'cant'}
                tone="green"
                coin
                label={String(cost)}
                onClick={onBuy}
              />
            ) : (
              <PriceButton state="done" label="Locked" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A size×size mini-grid glyph previewing the board footprint. */
function MiniGrid({ size, faint }: { size: number; faint: boolean }) {
  const cells = Array.from({ length: size * size });
  return (
    <span
      className="la-notch-3 grid flex-none gap-px p-1"
      aria-hidden
      style={{
        width: 42,
        height: 42,
        gridTemplateColumns: `repeat(${size},1fr)`,
        background: 'var(--la-expand-line)',
      }}
    >
      {cells.map((_, i) => (
        <span
          key={i}
          style={{ background: faint ? 'var(--la-expand-cell-off)' : 'var(--la-expand-cell-on)' }}
        />
      ))}
    </span>
  );
}

/* ─────────────────────────── Boost ─────────────────────────── */

function BoostPanel({
  coins,
  upgrades,
  onBuy,
  onRebloom,
}: {
  coins: number;
  upgrades: Record<'energy' | 'fertilizer', number>;
  onBuy: (id: 'energy' | 'fertilizer') => void;
  onRebloom: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-4.5 pt-1">
      {UPGRADE_IDS.map((id) => {
        const def = UPGRADE_DEFS[id];
        const level = upgrades[id];
        const maxed = isMaxed(id, level);
        const cost = upgradeCost(id, level);
        const afford = coins >= cost;
        return (
          <div
            key={id}
            className="la-notch flex items-center gap-3 px-3.5 py-3"
            style={{
              background: 'var(--la-card)',
              boxShadow: 'inset 0 0 0 3px var(--la-card-line)',
            }}
          >
            <Swatch color={def.color} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--la-ink)]">{def.name}</span>
                <span
                  className="font-pixel text-xs text-[var(--la-orange)] px-1.5 py-px"
                  style={{ background: 'var(--la-lvl-bg)' }}
                >
                  Lv {level}
                  {def.maxLevel ? `/${def.maxLevel}` : ''}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--la-body)]">
                {level > 0 ? `${def.effect(level)} · ` : ''}
                {maxed ? def.desc : `next: ${def.effect(level + 1)}`}
              </div>
            </div>
            <PriceButton
              state={maxed ? 'done' : afford ? 'buy' : 'cant'}
              tone="amber"
              coin={!maxed}
              label={maxed ? 'Maxed' : String(cost)}
              onClick={() => onBuy(id)}
            />
          </div>
        );
      })}

      {/* Prestige kept functional but deliberately quiet — the design direction is not to feature it. */}
      <div
        className="la-notch mt-1 flex items-center gap-3 px-3.5 py-2.5"
        style={{
          background: 'var(--la-panel-soft)',
          boxShadow: 'inset 0 0 0 3px var(--la-gold-line)',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--la-gem-deep)]">Rebloom</div>
          <div className="text-[11px] text-[var(--la-muted-2)]">
            Reset the farm for a permanent ×1.6 harvest & 8 gems.
          </div>
        </div>
        <button
          onClick={onRebloom}
          className="la-notch-3 flex-none px-3 py-1.5 font-pixel text-[12px] font-semibold text-[var(--la-quiet-text)] active:translate-y-0.5"
          style={{
            background: 'var(--la-quiet)',
            boxShadow: 'inset 0 0 0 3px var(--la-panel-line)',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Craft ─────────────────────────── */

function CraftPanel() {
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-4.5 pt-1">
      <InfoBanner tone="cool">
        The workshop is still being built — machines arrive in a later season. Here is a peek.
      </InfoBanner>
      {CRAFTS.map((cr) => {
        const locked = !!cr.note;
        return (
          <div
            key={cr.name}
            className="la-notch px-3.5 py-3"
            style={{
              background: 'var(--la-card)',
              boxShadow: 'inset 0 0 0 3px var(--la-card-line)',
              opacity: locked ? 0.72 : 1,
            }}
          >
            <div className="flex items-center gap-3">
              <Swatch color={cr.color} size={38} locked={locked} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--la-ink)]">{cr.name}</span>
                  {cr.note && (
                    <span
                      className="font-pixel text-[11px] text-[var(--la-quiet-text)] px-1.5 py-px"
                      style={{
                        background: 'var(--la-tab-off-bg)',
                        boxShadow: 'inset 0 0 0 2px var(--la-settings-line)',
                      }}
                    >
                      {cr.note}
                    </span>
                  )}
                </div>
                <div className="mt-px text-[11px] text-[var(--la-muted-2)]">{cr.tag}</div>
              </div>
              <PriceButton state="done" label={cr.btn} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {cr.ing.map((ig) => (
                <span
                  key={ig.label}
                  className="la-notch-3 font-pixel text-[11px] px-2 py-1"
                  style={
                    ig.ok
                      ? {
                          background: 'var(--la-locked-bg)',
                          color: 'var(--la-body)',
                          boxShadow: 'inset 0 0 0 2px var(--la-locked-line)',
                        }
                      : {
                          background: 'var(--la-need-bg)',
                          color: 'var(--la-need-text)',
                          boxShadow: 'inset 0 0 0 2px var(--la-need-line)',
                        }
                  }
                >
                  {ig.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Almanac / Guide ─────────────────────────── */

function GuidePanel({
  seen,
  seenCount,
  total,
}: {
  seen: Record<string, unknown>;
  seenCount: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3.5 px-4 pb-4.5 pt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--la-muted-2)]">
          Everything you have met on your acre.
        </span>
        <span
          className="font-pixel text-[13px] text-[var(--la-coin-text)] px-2 py-0.5"
          style={{
            background: 'var(--la-coin-soft)',
            boxShadow: 'inset 0 0 0 2px var(--la-gold-line)',
          }}
        >
          {seenCount} / {total}
        </span>
      </div>
      {GUIDE.map((cat) => (
        <div key={cat.title}>
          <div className="mb-1.5 font-pixel text-xs uppercase tracking-wider text-[var(--la-label)]">
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
                  className="la-notch flex items-center gap-2.5 px-2.5 py-2.5"
                  style={{
                    background: 'var(--la-card)',
                    boxShadow: 'inset 0 0 0 3px var(--la-card-line)',
                    opacity: on ? 1 : 0.5,
                  }}
                >
                  <Swatch color={on ? g.color : 'var(--la-locked-swatch)'} size={30} />
                  <div className="min-w-0">
                    <div className="font-pixel text-[13px] text-[var(--la-ink)]">
                      {on ? g.name : '? ? ?'}
                    </div>
                    <div className="text-[11px] leading-tight text-[var(--la-muted-2)]">
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
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */

function InfoBanner({ tone, children }: { tone: 'warm' | 'cool' | 'green'; children: ReactNode }) {
  const skin =
    tone === 'cool'
      ? {
          bg: 'var(--la-craft-bg)',
          line: 'var(--la-craft-line)',
          dot: 'var(--la-craft-dot)',
          dotLine: 'var(--la-craft-dot-line)',
          text: 'var(--la-craft-text)',
        }
      : tone === 'green'
        ? {
            bg: 'var(--la-expand-bg)',
            line: 'var(--la-expand-line)',
            dot: 'var(--la-expand-cell-on)',
            dotLine: 'var(--la-expand-pill-bg)',
            text: 'var(--la-expand-sub)',
          }
        : {
            bg: 'var(--la-panel-soft)',
            line: 'var(--la-gold-line)',
            dot: 'var(--la-coin)',
            dotLine: 'var(--la-coin-ring)',
            text: 'var(--la-muted-2)',
          };
  return (
    <div
      className="la-notch-3 flex items-center gap-2.5 px-3 py-2.5"
      style={{ background: skin.bg, boxShadow: `inset 0 0 0 3px ${skin.line}` }}
    >
      <span
        className="h-2.5 w-2.5 flex-none"
        style={{ background: skin.dot, boxShadow: `inset 0 0 0 2px ${skin.dotLine}` }}
      />
      <span className="text-xs font-semibold leading-snug" style={{ color: skin.text }}>
        {children}
      </span>
    </div>
  );
}

function Swatch({
  color,
  size,
  locked = false,
}: {
  color: string;
  size: number;
  locked?: boolean;
}) {
  return (
    <span
      className={`la-notch-5 la-swatch flex-none${locked ? ' la-swatch-locked' : ''}`}
      aria-hidden
      style={{ width: size, height: size, background: color }}
    />
  );
}

function CoinPixel() {
  return (
    <span
      className="la-notch-3 h-3.5 w-3.5"
      style={{ background: 'var(--la-coin)', boxShadow: 'inset 0 0 0 2px var(--la-coin-ring)' }}
    />
  );
}

/**
 * Price / action button. `state`:
 *   buy  — interactive sticker (tone green or amber)
 *   cant — unaffordable (disabled, warm-red price)
 *   done — owned / maxed / locked / presentational "Soon" (disabled, muted)
 */
function PriceButton({
  state,
  tone = 'green',
  label,
  coin = false,
  onClick,
}: {
  state: 'buy' | 'cant' | 'done';
  tone?: 'green' | 'amber';
  label: string;
  coin?: boolean;
  onClick?: () => void;
}) {
  const base =
    'la-notch mt-auto flex flex-none items-center justify-center gap-1.5 px-3 py-2 font-pixel text-sm font-semibold';
  if (state === 'buy') {
    return (
      <button
        onClick={onClick}
        className={`${base} active:translate-y-0.5 ${tone === 'amber' ? 'la-btn-amber' : 'la-btn-green'}`}
      >
        {coin && <CoinPixel />}
        {label}
      </button>
    );
  }
  const color = state === 'cant' ? 'var(--la-cant-text)' : 'var(--la-locked-ink)';
  return (
    <button
      disabled
      className={`${base} cursor-not-allowed`}
      style={{
        background: 'var(--la-disabled-bg)',
        color,
        boxShadow: 'inset 0 0 0 3px var(--la-disabled-line)',
      }}
    >
      {coin && state === 'cant' && <CoinPixel />}
      {label}
    </button>
  );
}

function TabButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="la-notch px-[13px] py-2 font-pixel text-sm font-semibold"
      style={{
        color: on ? 'var(--la-text)' : 'var(--la-settings-text)',
        background: on ? 'var(--la-tab-on-bg)' : 'var(--la-tab-off-bg)',
        boxShadow: `inset 0 0 0 3px ${on ? 'var(--la-tab-on-line)' : 'var(--la-settings-line)'}`,
      }}
    >
      {label}
    </button>
  );
}
