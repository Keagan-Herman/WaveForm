/**
 * SearchOverlay.tsx — v3 (final)
 *
 * Accepts two additional props vs Phase 6:
 * - filteredTrackIds: when a genre is selected in the graph, only matching
 *   tracks are visually highlighted. Non-matching tracks are dimmed.
 *   Passing null clears the filter.
 * - onResultsChange: unchanged from Phase 6
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSpotifySearch } from '@/hooks/useSpotifySearch'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/library/TrackRow'
import type { SpotifyTrack } from '@/lib/spotifyApi'

interface SearchOverlayProps {
  onResultsChange?: (tracks: SpotifyTrack[]) => void
  filteredTrackIds?: string[] | null
}

export function SearchOverlay({
  onResultsChange,
  filteredTrackIds,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { tracks, isLoading, error } = useSpotifySearch(query)
  const { currentTrack, setTrack, setIsPlaying, setQueue } = usePlayerStore()

  useEffect(() => {
    onResultsChange?.(tracks)
  }, [tracks, onResultsChange])

  const handleSelectTrack = useCallback(
    (track: SpotifyTrack, index: number) => {
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

  // Determine if a track is dimmed due to genre filter
  const isFiltered = filteredTrackIds !== null && filteredTrackIds !== undefined
  const isTrackVisible = (track: SpotifyTrack) =>
    !isFiltered || filteredTrackIds!.includes(track.id)

  return (
    <div style={styles.panel}>
      <div style={styles.inputWrap}>
        <span style={styles.searchIcon}>⌕</span>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="Search tracks... (press /)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search for tracks"
          spellCheck={false}
        />
        {isLoading && <span style={styles.loadingPip} aria-label="Loading" />}
        {query && !isLoading && (
          <button
            style={styles.clearBtn}
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Genre filter indicator */}
      {isFiltered && (
        <div style={styles.filterBanner}>
          <span style={styles.filterDot} />
          Showing {filteredTrackIds!.length} tracks matching selected genre
        </div>
      )}

      {tracks.length > 0 && (
        <div style={styles.columnHeaders}>
          <span style={{ gridColumn: '1 / 3' }}>#</span>
          <span>Title</span>
          <span>Album</span>
          <span>Duration</span>
        </div>
      )}

      <div style={styles.results} role="list" aria-label="Search results">
        {!query.trim() && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon}>♫</p>
            <p style={styles.stateTitle}>Find something to play</p>
            <p style={styles.stateDesc}>
              Search for any track. Only results with 30-second previews are shown.
            </p>
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
            <p style={styles.stateTitle}>No previews available</p>
            <p style={styles.stateDesc}>
              "{query}" returned results but none have 30-second previews.
            </p>
          </div>
        )}

        {!isLoading && !error && tracks.length > 0 && (
          <div style={styles.trackList}>
            {tracks.map((track, i) => (
              <div
                key={track.id}
                role="listitem"
                style={{
                  opacity: isTrackVisible(track) ? 1 : 0.2,
                  transition: 'opacity 0.2s',
                }}
              >
                <TrackRow
                  track={track}
                  index={i}
                  isActive={currentTrack?.id === track.id}
                  onSelect={handleSelectTrack}
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
    borderRight: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    gap: '0.5rem',
  },
  searchIcon: {
    fontSize: '1.1rem',
    opacity: 0.3,
    flexShrink: 0,
    lineHeight: 1,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#e8f5e8',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    outline: 'none',
    minWidth: 0,
  },
  loadingPip: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#1db954',
    flexShrink: 0,
    animation: 'pulse 1s ease-in-out infinite',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(232,245,232,0.3)',
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
    background: 'rgba(29,185,84,0.06)',
    borderBottom: '1px solid rgba(29,185,84,0.12)',
    fontSize: '0.65rem',
    color: 'rgba(29,185,84,0.7)',
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#1db954',
    flexShrink: 0,
  },
  columnHeaders: {
    display: 'grid',
    gridTemplateColumns: '32px 36px 1fr 1fr auto',
    gap: '0.75rem',
    padding: '0.4rem 0.75rem',
    fontSize: '0.6rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    opacity: 0.2,
    fontFamily: 'monospace',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    flexShrink: 0,
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.5rem',
  },
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    textAlign: 'center',
    gap: '0.5rem',
  },
  stateIcon: {
    fontSize: '2rem',
    opacity: 0.15,
    marginBottom: '0.5rem',
  },
  stateTitle: {
    fontSize: '0.85rem',
    opacity: 0.5,
  },
  stateDesc: {
    fontSize: '0.75rem',
    opacity: 0.25,
    lineHeight: 1.6,
    maxWidth: 260,
  },
  skeletonWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0.25rem 0',
  },
  skeleton: {
    height: 52,
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.04)',
    animation: 'shimmer 1.5s ease-in-out infinite',
  },
  trackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
}