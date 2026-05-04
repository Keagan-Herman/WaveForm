/**
 * SearchOverlay.tsx — v3 (final)
 *
 * Accepts two additional props vs Phase 6:
 * - filteredTrackIds: when a genre is selected in the graph, only matching
 *   tracks are visually highlighted. Non-matching tracks are dimmed.
 *   Passing null clears the filter.
 * - onResultsChange: unchanged from Phase 6
 */

/**
 * SearchOverlay.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - useSpotifySearch → useDeezerSearch
 * - SpotifyTrack → DeezerTrack
 * - track.id is number not string (Deezer uses numeric IDs)
 */

/**
 * SearchOverlay.tsx — enhanced
 *
 * Added accentColour prop for dynamic theming.
 * Contrast improved — opacity values throughout bumped up.
 * Active track highlight uses dynamic accent colour.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDeezerSearch } from '@/hooks/useDeezerSearch'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/library/TrackRow'
import type { DeezerTrack } from '@/lib/deezerApi'

interface SearchOverlayProps {
  onResultsChange?: (tracks: DeezerTrack[]) => void
  filteredTrackIds?: string[] | null
  accentColour?: string
}

export function SearchOverlay({
  onResultsChange,
  filteredTrackIds,
  accentColour = '#1db954',
}: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { tracks, isLoading, error } = useDeezerSearch(query)
  const { currentTrack, setTrack, setIsPlaying, setQueue } = usePlayerStore()

  useEffect(() => {
    onResultsChange?.(tracks)
  }, [tracks, onResultsChange])

  const handleSelectTrack = useCallback(
    (track: DeezerTrack, index: number) => {
      setQueue(tracks, index)
      setTrack(track)
      setIsPlaying(true)
    },
    [tracks, setQueue, setTrack, setIsPlaying]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') inputRef.current?.blur()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isFiltered = filteredTrackIds !== null && filteredTrackIds !== undefined
  const isTrackVisible = (track: DeezerTrack) =>
    !isFiltered || filteredTrackIds!.includes(String(track.id))

  return (
    <div style={styles.panel}>
      {/* Search input */}
      <div style={styles.inputWrap}>
        <span style={styles.searchIcon}>⌕</span>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="Search tracks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search for tracks"
          spellCheck={false}
        />
        {isLoading && (
          <span style={{ ...styles.loadingPip, background: accentColour }} />
        )}
        {query && !isLoading && (
          <button style={styles.clearBtn} onClick={() => setQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {/* Genre filter indicator */}
      {isFiltered && (
        <div style={{ ...styles.filterBanner, borderBottomColor: `${accentColour}22`, color: accentColour }}>
          <span style={{ ...styles.filterDot, background: accentColour }} />
          {filteredTrackIds!.length} tracks match selected genre
        </div>
      )}

      {/* Column headers */}
      {tracks.length > 0 && (
        <div style={styles.columnHeaders}>
          <span style={{ gridColumn: '1 / 3' }}>#</span>
          <span>Title</span>
          <span>Album</span>
          <span>Dur</span>
        </div>
      )}

      {/* Results */}
      <div style={styles.results} role="list">

        {!query.trim() && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon}>♫</p>
            <p style={styles.stateTitle}>Find something to play</p>
            <p style={styles.stateDesc}>All results include a 30-second preview.</p>
          </div>
        )}

        {isLoading && (
          <div style={styles.skeletonWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ ...styles.skeleton, opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon}>⚠</p>
            <p style={styles.stateTitle}>Something went wrong</p>
            <p style={styles.stateDesc}>{error}</p>
          </div>
        )}

        {!isLoading && !error && tracks.length === 0 && query.trim() && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon}>∅</p>
            <p style={styles.stateTitle}>No results found</p>
            <p style={styles.stateDesc}>Try a different search term.</p>
          </div>
        )}

        {!isLoading && !error && tracks.length > 0 && (
          <div style={styles.trackList}>
            {tracks.map((track, i) => (
              <div
                key={track.id}
                role="listitem"
                style={{
                  opacity: isTrackVisible(track) ? 1 : 0.18,
                  transition: 'opacity 0.2s',
                }}
              >
                <TrackRow
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  onSelect={handleSelectTrack}
                  accentColour={accentColour}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
    gap: '0.5rem',
  },
  searchIcon: { fontSize: '1.1rem', opacity: 0.45, flexShrink: 0, lineHeight: 1 },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    outline: 'none',
    minWidth: 0,
  },
  loadingPip: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    animation: 'pulse 1s ease-in-out infinite',
    transition: 'background 1s ease',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(240,240,240,0.4)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.2rem',
    flexShrink: 0,
    lineHeight: 1,
  },
  filterBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
    flexShrink: 0,
    transition: 'color 1s ease, border-color 1s ease',
  },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 1s ease',
  },
  columnHeaders: {
    display: 'grid',
    gridTemplateColumns: '28px 36px 1fr 1fr auto',
    gap: '0.75rem',
    padding: '0.35rem 0.75rem',
    fontSize: '0.56rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.35,
    fontFamily: 'monospace',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  results: { flex: 1, overflowY: 'auto', padding: '0.4rem' },
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    textAlign: 'center',
    gap: '0.5rem',
  },
  stateIcon: { fontSize: '2rem', opacity: 0.2, marginBottom: '0.5rem' },
  stateTitle: { fontSize: '0.85rem', opacity: 0.6 },
  stateDesc: { fontSize: '0.75rem', opacity: 0.35, lineHeight: 1.6, maxWidth: 240 },
  skeletonWrap: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '0.2rem 0' },
  skeleton: {
    height: 50,
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.05)',
    animation: 'shimmer 1.5s ease-in-out infinite',
  },
  trackList: { display: 'flex', flexDirection: 'column', gap: '2px' },
}