/**
 * SearchOverlay.tsx — genre filter now removes tracks
 *
 * When filteredTrackIds is set, only matching tracks are shown.
 * Non-matching tracks are completely removed from the rendered list,
 * not just dimmed. This makes the filter feel decisive and useful.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDeezerSearch } from '@/hooks/useDeezerSearch'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackRow } from '@/components/library/TrackRow'
import type { Track, DeezerTrack } from '@/types/track'

interface SearchOverlayProps {
  onResultsChange?: (tracks: DeezerTrack[]) => void
  filteredTrackIds?: string[] | null
  accentColour?: string
}

export function SearchOverlay({
  onResultsChange,
  filteredTrackIds,
  accentColour = '#7a8fa6',
}: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { tracks, isLoading, error } = useDeezerSearch(query)
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const setTrack = usePlayerStore(state => state.setTrack)
  const play = usePlayerStore(state => state.play)
  const addToQueue = usePlayerStore(state => state.addToQueue)
  const clearQueue = usePlayerStore(state => state.clearQueue)

  useEffect(() => {
    onResultsChange?.(tracks)
  }, [tracks, onResultsChange])

  // Filter tracks — completely remove non-matching ones
  const isFiltered = filteredTrackIds !== null && filteredTrackIds !== undefined
  const visibleTracks = (isFiltered
    ? tracks.filter(t => filteredTrackIds!.includes(String(t.id)))
    : tracks) as Track[]

  const handleSelectTrack = useCallback(
    (track: Track) => {
      // Rebuild queue from visible tracks
      clearQueue()
      visibleTracks.forEach(t => addToQueue(t))
      setTrack(track)
      play()
    },
    [visibleTracks, clearQueue, addToQueue, setTrack, play]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'

      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        setFocusedIndex(-1)
      }

      if (
        focusedIndex !== -1 ||
        (document.activeElement === inputRef.current && visibleTracks.length > 0)
      ) {
        const isInputFocused = document.activeElement === inputRef.current

        if (e.key === 'ArrowDown' || (!isInputFocused && e.key.toLowerCase() === 'j')) {
          e.preventDefault()
          setFocusedIndex(prev => Math.min(prev + 1, visibleTracks.length - 1))
          if (isInputFocused) inputRef.current?.blur()
        } else if (e.key === 'ArrowUp' || (!isInputFocused && e.key.toLowerCase() === 'k')) {
          e.preventDefault()
          setFocusedIndex(prev => Math.max(prev - 1, 0))
          if (isInputFocused) inputRef.current?.blur()
        } else if (e.key === 'Enter' && focusedIndex !== -1) {
          e.preventDefault()
          handleSelectTrack(visibleTracks[focusedIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visibleTracks, focusedIndex, handleSelectTrack])

  useEffect(() => {
    if (focusedIndex !== -1) {
      const el = listRef.current?.children[focusedIndex] as HTMLElement
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusedIndex(prev => (prev === -1 ? prev : -1))
  }, [query, filteredTrackIds])

  return (
    <div style={styles.panel}>
      {/* Search input */}
      <div style={styles.inputWrap}>
        <span style={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="Search tracks... (/)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search for tracks"
          spellCheck={false}
        />
        {isLoading && <span style={{ ...styles.loadingPip, background: accentColour }} />}
        {query && !isLoading && (
          <button style={styles.clearBtn} onClick={() => setQuery('')} aria-label="Clear">
            ✕
          </button>
        )}
      </div>

      {/* Genre filter banner */}
      {isFiltered && (
        <div
          style={{
            ...styles.filterBanner,
            color: accentColour,
            borderBottomColor: `${accentColour}25`,
          }}
        >
          <span style={{ ...styles.filterDot, background: accentColour }} />
          {visibleTracks.length} of {tracks.length} tracks · genre filtered
        </div>
      )}

      {/* Column headers */}
      {visibleTracks.length > 0 && (
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
            <p style={styles.stateIcon} aria-hidden="true">
              ♫
            </p>
            <p style={styles.stateTitle}>Find something to play</p>
            <p style={styles.stateDesc}>All results include a 30-second preview.</p>
          </div>
        )}

        {isLoading && (
          <div style={styles.skeletonWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1 - i * 0.1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={styles.skeleton}
              />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon} aria-hidden="true">
              ⚠
            </p>
            <p style={styles.stateTitle}>Something went wrong</p>
            <p style={styles.stateDesc}>{error}</p>
          </div>
        )}

        {!isLoading && !error && tracks.length === 0 && query.trim() && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon} aria-hidden="true">
              ∅
            </p>
            <p style={styles.stateTitle}>No results found</p>
            <p style={styles.stateDesc}>Try a different search term.</p>
          </div>
        )}

        {/* Filtered empty state */}
        {!isLoading && !error && isFiltered && visibleTracks.length === 0 && tracks.length > 0 && (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon} aria-hidden="true">
              ∅
            </p>
            <p style={styles.stateTitle}>No tracks in this genre</p>
            <p style={styles.stateDesc}>Click the genre again to clear the filter.</p>
          </div>
        )}

        {!isLoading && !error && visibleTracks.length > 0 && (
          <div style={styles.trackList} ref={listRef}>
            <AnimatePresence mode="popLayout">
              {visibleTracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  role="listitem"
                >
                  <TrackRow
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    isFocused={focusedIndex === i}
                    onSelect={handleSelectTrack}
                    accentColour={accentColour}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
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
    padding: '0.7rem 0.9rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
    gap: '0.5rem',
  },
  searchIcon: { fontSize: '1rem', opacity: 0.4, flexShrink: 0, lineHeight: 1 },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    fontSize: '0.82rem',
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
    color: 'rgba(240,240,240,0.35)',
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
    padding: '0.35rem 0.9rem',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    letterSpacing: '0.04em',
    flexShrink: 0,
    transition: 'color 1s ease',
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
    padding: '0.3rem 0.7rem',
    fontSize: '0.6rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.3,
    fontFamily: 'monospace',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.35rem',
  },
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2.5rem 1.5rem',
    textAlign: 'center',
    gap: '0.4rem',
  },
  stateIcon: { fontSize: '1.75rem', opacity: 0.18, marginBottom: '0.4rem' },
  stateTitle: { fontSize: '0.82rem', opacity: 0.55 },
  stateDesc: { fontSize: '0.7rem', opacity: 0.3, lineHeight: 1.6, maxWidth: 220 },
  skeletonWrap: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '0.2rem 0' },
  skeleton: {
    height: 48,
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.05)',
    animation: 'shimmer 1.5s ease-in-out infinite',
  },
  trackList: { display: 'flex', flexDirection: 'column', gap: '2px' },
}
