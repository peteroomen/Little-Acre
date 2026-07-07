'use client';

import { useEffect } from 'react';

import { useGameStore } from '@/lib/game/store';

import { Game } from './Game';
import { MainMenu } from './ui/MainMenu';
import { PuzzleSelect } from './ui/PuzzleSelect';

/**
 * Top-level shell. Boots into the Main Menu, then renders Freeplay/Puzzle (Game) or the
 * Puzzle Select screen based on the store's `screen`. `init()` loads the save + puzzle stars
 * but deliberately lands on the menu rather than forcing into the game.
 */
export function App() {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    useGameStore.getState().init();
  }, []);

  if (screen === 'menu') return <MainMenu />;
  if (screen === 'puzzleSelect') return <PuzzleSelect />;
  return <Game />;
}
