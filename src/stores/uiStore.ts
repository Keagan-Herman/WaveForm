import { create } from 'zustand'

interface UIStore {
  selectedArtistId: number | null
  setSelectedArtistId: (id: number | null) => void
}

export const useUIStore = create<UIStore>(set => ({
  selectedArtistId: null,
  setSelectedArtistId: id => set({ selectedArtistId: id }),
}))
