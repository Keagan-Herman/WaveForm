import React from 'react';
import { useUIStore, type MobileTab } from '@/stores/uiStore';
import type { AlbumColour } from '@/hooks/useAlbumColour';

interface MobileNavProps {
  accent: AlbumColour;
}

export function MobileNav({ accent }: MobileNavProps) {
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const tabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'library', label: 'Library', icon: '♫' },
    { id: 'visualisers', label: 'Vis', icon: '◬' },
    { id: 'nowplaying', label: 'Playing', icon: '◎' },
    { id: 'genremap', label: 'Genres', icon: '◈' },
  ];

  return (
    <nav style={{ ...styles.nav, borderTopColor: `${accent.hex}22` }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              color: isActive ? accent.hex : 'var(--text-dim)',
              opacity: isActive ? 1 : 0.6,
            }}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span style={styles.label}>{tab.label}</span>
            {isActive && (
              <div
                style={{
                  ...styles.indicator,
                  background: accent.hex,
                  boxShadow: `0 0 10px ${accent.hex}`,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    position: 'fixed',
    bottom: 72,
    left: 0,
    right: 0,
    height: 60,
    background: 'rgba(5, 10, 5, 0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    zIndex: 150,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    gap: 4,
    padding: '8px 0',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s ease',
    fontFamily: 'monospace',
  },
  icon: {
    fontSize: '1.2rem',
    lineHeight: 1,
  },
  label: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: '40%',
    height: 2,
    borderRadius: '0 0 2px 2px',
  },
};
