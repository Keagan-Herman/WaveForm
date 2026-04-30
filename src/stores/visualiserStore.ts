/**
 * visualiserStore.ts
 *
 * Zustand store for derived audio state that needs to cross the
 * canvas/React/R3F boundary.
 *
 * WHAT LIVES HERE:
 * - beat: boolean — fired by BeatDetector, consumed by R3F album field
 * - bassPower: number (0–1) — consumed by BackgroundPulse
 *
 * WHAT DOES NOT LIVE HERE:
 * - Raw Uint8Array frequency data — that stays in the rAF loop and goes
 *   directly to canvas callbacks. Never put it in Zustand.
 */

import { create } from 'zustand'

interface VisualiserStore {
  beat: boolean
  bassPower: number
  setBeat: (beat: boolean) => void
  setBassPower: (power: number) => void
}

export const useVisualiserStore = create<VisualiserStore>(set => ({
  beat: false,
  bassPower: 0,
  setBeat: beat => set({ beat }),
  setBassPower: bassPower => set({ bassPower }),
}))