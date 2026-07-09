'use client';

import { useGameStore } from '@/lib/game/store';

/**
 * The dawn card (mockup "Sunrise Report"). After a Freeplay Sleep resolves, the night
 * overlay fades and this gentle summary rises: what grew, what wilted, which nodes
 * refilled, and the day's restored energy. Dismisses to the day with "Start the day".
 *
 * Freeplay only — `report` is never set true in puzzle mode, so the card never leaks
 * into a puzzle. Reads the four night tallies straight off the `night` payload.
 */
export function SunriseReport() {
  const report = useGameStore((s) => s.report);
  const night = useGameStore((s) => s.night);
  const day = useGameStore((s) => s.day);
  const maxEnergy = useGameStore((s) => s.maxEnergy);
  const closeReport = useGameStore((s) => s.closeReport);

  if (!report) return null;

  const grew = night.grew ?? 0;
  const wilted = night.wilted ?? 0;
  const restocked = night.restocked ?? 0;
  const recovered = night.recovered ?? 0;
  const quiet = !grew && !wilted && !restocked && !recovered;

  const rows: { color: string; text: string }[] = [];
  if (quiet) rows.push({ color: 'var(--la-title-lilac)', text: 'A quiet night on the farm' });
  if (grew)
    rows.push({
      color: 'var(--la-leaf)',
      text: `${grew} ${grew === 1 ? 'crop grew' : 'crops grew'} overnight`,
    });
  if (wilted)
    rows.push({
      color: 'var(--la-danger)',
      text: `Aw — ${wilted} dried out. Clear ${wilted === 1 ? 'it' : 'them'} when you can`,
    });
  if (restocked)
    rows.push({
      color: 'var(--la-node-pond)',
      text: restocked === 1 ? 'The pond restocked with fish' : 'The ponds restocked with fish',
    });
  if (recovered)
    rows.push({
      color: 'var(--la-node-rock)',
      text: recovered === 1 ? 'The rock feels rested and ready' : 'The rocks feel rested and ready',
    });
  rows.push({ color: 'var(--la-energy-icon)', text: `Energy restored — ${maxEnergy} for the day` });

  return (
    <div
      className="absolute inset-0 z-[22] flex items-center justify-center p-[18px]"
      style={{ background: 'rgba(70,55,35,.32)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="la-anim la-notch-6 w-full max-w-[340px] bg-[var(--la-modal)] px-5 pb-[18px] pt-[22px]"
        style={{
          boxShadow: 'inset 0 4px 0 rgba(255,255,255,.8), inset 0 0 0 4px var(--la-panel-line)',
          filter:
            'drop-shadow(0 7px 0 var(--la-panel-shadow)) drop-shadow(0 14px 24px rgba(120,85,25,.28))',
          animation: 'la-rise .28s cubic-bezier(.34,1.4,.64,1)',
        }}
      >
        <div className="mb-3.5 text-center">
          <span
            className="mb-2 inline-block h-11 w-11 rounded-full bg-[var(--la-coin)]"
            style={{
              boxShadow: 'inset -6px -6px 0 rgba(200,140,10,.35), 0 0 26px rgba(247,201,72,.55)',
            }}
          />
          <div className="font-pixel text-2xl font-semibold text-[var(--la-text)]">
            Sunrise Report
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--la-muted)]">Day {day} begins</div>
        </div>

        <div className="mb-4 flex flex-col gap-[7px]">
          {rows.map((row, i) => (
            <div
              key={i}
              className="la-notch-3 flex items-center gap-2.5 bg-[var(--la-card)] px-3 py-2.5"
              style={{ boxShadow: 'inset 0 0 0 3px var(--la-card-line)' }}
            >
              <span
                className="la-notch h-[26px] w-[26px] flex-none"
                style={{
                  background: row.color,
                  boxShadow:
                    'inset 0 -3px 0 rgba(0,0,0,.14), inset 0 0 0 2px rgba(255,255,255,.35)',
                }}
              />
              <span className="text-[13px] font-medium text-[var(--la-ink)]">{row.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={closeReport}
          className="la-notch-3 la-btn-green w-full py-3 font-pixel text-base font-semibold active:translate-y-0.5"
        >
          Start the day
        </button>
      </div>
    </div>
  );
}
