/**
 * SearchOverlay.tsx — Redesigned for Functionalism & Japanese Minimalism
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
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
  const [isInputFocused, setIsInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const { tracks, isLoading, error } = useDeezerSearch(query)
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const queue = usePlayerStore(state => state.queue)
  const setTrack = usePlayerStore(state => state.setTrack)
  const play = usePlayerStore(state => state.play)
  const addToQueue = usePlayerStore(state => state.addToQueue)
  const clearQueue = usePlayerStore(state => state.clearQueue)

  useEffect(() => {
    onResultsChange?.(tracks)
  }, [tracks, onResultsChange])

  const isFiltered = filteredTrackIds !== null && filteredTrackIds !== undefined
  const visibleTracks = (
    isFiltered ? tracks.filter(t => filteredTrackIds!.includes(String(t.id))) : tracks
  ) as Track[]

  const handleSelectTrack = useCallback(
    (track: Track) => {
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
        if (query) {
          setQuery('')
        } else {
          inputRef.current?.blur()
          setFocusedIndex(-1)
        }
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
          if (focusedIndex === 0) {
            setFocusedIndex(-1)
            inputRef.current?.focus()
          } else {
            setFocusedIndex(prev => Math.max(prev - 1, 0))
          }
          if (isInputFocused) inputRef.current?.blur()
        } else if (e.key === 'Enter' && focusedIndex !== -1) {
          e.preventDefault()
          handleSelectTrack(visibleTracks[focusedIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visibleTracks, focusedIndex, handleSelectTrack, query])

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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  }

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      x: -8,
      ...(prefersReducedMotion ? {} : { filter: 'blur(4px)' }),
    },
    visible: {
      opacity: 1,
      x: 0,
      ...(prefersReducedMotion ? {} : { filter: 'blur(0px)' }),
      transition: { duration: prefersReducedMotion ? 0.15 : 0.4, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <div style={styles.panel}>
      <div style={styles.inputArea}>
        <div
          style={{
            ...styles.inputWrap,
            borderColor: isInputFocused ? accentColour : 'var(--border-color)',
            boxShadow: isInputFocused
              ? `0 0 15px ${accentColour}22, inset 0 0 10px ${accentColour}11`
              : 'none',
            transform: isInputFocused ? 'translateY(-1px)' : 'none',
          }}
        >
          <input
            ref={inputRef}
            style={styles.input}
            type="text"
            placeholder="Search tracks and artists"
            aria-label="Search tracks and artists"
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
          <AnimatePresence>
            {(isLoading || isInputFocused) && (
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{
                  scaleX: isLoading ? [0, 1, 0] : [0, 1],
                  x: isLoading ? ['0%', '0%', '100%'] : '0%',
                  opacity: isLoading ? [0.5, 1, 0.5] : [0.2, 0.4],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: isLoading ? 1.5 : 0.4,
                  repeat: isLoading ? Infinity : 0,
                  ease: 'easeInOut',
                }}
                style={{ ...styles.scanner, backgroundColor: accentColour }}
              />
            )}
          </AnimatePresence>
          {isInputFocused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, transparent, ${accentColour}05, transparent)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      {isFiltered && (
        <div style={{ ...styles.filterTag, color: accentColour }}>
          {visibleTracks.length} results filtered
        </div>
      )}

      <div style={styles.results} role="list">
        {!isLoading && !error && visibleTracks.length > 0 && (
          <motion.div
            style={styles.trackList}
            ref={listRef}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <AnimatePresence mode="popLayout">
              {visibleTracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  layout
                  variants={itemVariants}
                  exit={{ opacity: 0, x: -10, transition: { duration: 0.2 } }}
                  role="listitem"
                >
                  <TrackRow
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    isFocused={focusedIndex === i}
                    isQueued={queue.some(q => q.id === track.id)}
                    onSelect={handleSelectTrack}
                    accentColour={accentColour}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {error && (
          <div role="alert" style={{ ...styles.errorState, color: 'var(--color-error, #ff4444)' }}>
            Couldn&apos;t reach Deezer. Check your connection and try again.
          </div>
        )}

        {!error && !query.trim() && visibleTracks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.emptyState}
          >
            <div style={styles.emptyHeader}>
              <div style={{ ...styles.statusDot, backgroundColor: accentColour }} />
              <span style={styles.statusText}>Ready</span>
            </div>
            <div style={styles.emptyBody}>
              <div style={styles.emptyIcon}>
                <motion.div
                  animate={prefersReducedMotion ? {} : { opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="4"
                      y="4"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </motion.div>
              </div>
              <div style={styles.emptyText}>Start typing to search</div>
              <div style={styles.hintContainer}>
                <div style={styles.hintItem}>
                  <span style={styles.hintKey}>/</span>
                  <span style={styles.hintDesc}>FOCUS</span>
                </div>
                <div style={styles.hintItem}>
                  <span style={styles.hintKey}>SPACE</span>
                  <span style={styles.hintDesc}>PLAY</span>
                </div>
                <div style={styles.hintItem}>
                  <span style={styles.hintKey}>↑↓</span>
                  <span style={styles.hintDesc}>NAV</span>
                </div>
              </div>
            </div>
          </motion.div>
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
  },
  inputArea: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    borderBottom: '1px solid var(--border-color)',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0.02), transparent)',
  },
  inputWrap: {
    position: 'relative',
    border: '1px solid var(--border-color)',
    padding: '0.65rem 0.85rem',
    backgroundColor: 'var(--surface-overlay)',
    transition:
      'border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    borderRadius: '2px',
  },
  input: {
    width: '100%',
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-color)',
  },
  scanner: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 1,
    width: '100%',
    transformOrigin: 'left',
  },
  filterTag: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.5rem 1.5rem',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 600,
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
  },
  trackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  emptyState: {
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    height: '280px',
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.01)',
    marginTop: '1.5rem',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  emptyHeader: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.02)',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '0.65rem',
    letterSpacing: '0.2em',
    opacity: 0.55,
    fontWeight: 700,
  },
  emptyBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.25rem',
    padding: '2rem',
  },
  emptyIcon: {
    opacity: 0.3,
    color: 'inherit',
  },
  emptyText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.3em',
    fontWeight: 700,
    opacity: 0.5,
  },
  hintContainer: {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '0.5rem',
  },
  hintItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  hintKey: {
    fontSize: '0.6rem',
    fontFamily: 'var(--font-mono)',
    background: 'rgba(255,255,255,0.05)',
    padding: '0.1rem 0.4rem',
    borderRadius: '2px',
    border: '1px solid var(--border-color)',
    opacity: 0.6,
  },
  hintDesc: {
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    opacity: 0.5,
    fontWeight: 600,
  },
  errorState: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '1rem 1.5rem',
    opacity: 0.5,
    borderBottom: '1px solid var(--border-color)',
  },
}
