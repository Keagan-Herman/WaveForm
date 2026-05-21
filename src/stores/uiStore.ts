import { create } from 'zustand'

export type MobileTab = 'library' | 'visualisers' | 'nowplaying' | 'genremap'

interface UIStore {
  selectedArtistId: number | null
  setSelectedArtistId: (id: number | null) => void
  activeTab: MobileTab
  setActiveTab: (tab: MobileTab) => void
}

export const useUIStore = create<UIStore>(set => ({
  selectedArtistId: null,
  setSelectedArtistId: id => set({ selectedArtistId: id }),
  activeTab: 'library',
  setActiveTab: tab => set({ activeTab: tab }),
}))
