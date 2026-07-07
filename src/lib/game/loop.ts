import { useGameStore } from './store';

/**
 * The game loop. In Little Acre the day/night cycle advances only on an explicit
 * Sleep (see store.sleep), so unlike a real-time idle game there's no per-tick
 * simulation to run yet — the loop's job for M0 is durable autosave: every 10s and
 * on tab-hide / unload. Kept as a fixed-interval engine so passive systems
 * (auto-harvester, sprinklers-over-time — see ROADMAP M2/M3) can slot in here later.
 */
const SAVE_INTERVAL_MS = 10_000;

export function startLoop(): () => void {
  const intervalId = window.setInterval(() => {
    useGameStore.getState().save();
  }, SAVE_INTERVAL_MS);

  const persist = () => useGameStore.getState().save();
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.hidden) persist();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('beforeunload', persist);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('beforeunload', persist);
  };
}
