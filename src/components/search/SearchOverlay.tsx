/**
 * SearchOverlay.tsx — Redesigned for Functionalism & Japanese Minimalism
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
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

  const isFiltered = filteredTrackIds !== null && filteredTrackIds !== undefined
  const visibleTracks = (isFiltered
    ? tracks.filter(t => filteredTrackIds!.includes(String(t.id)))
    : tracks) as Track[]

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
    hidden: { opacity: 0, x: -5 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  }

  return (
    <div style={styles.panel}>
      <div style={styles.inputArea}>
        <div style={styles.inputLabel}>Registry Search</div>
        <div
          style={{
            ...styles.inputWrap,
            borderColor: isInputFocused ? accentColour : 'var(--border-color)',
          }}
        >
          <input
            ref={inputRef}
            style={styles.input}
            type="text"
            placeholder="Type to locate..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />
          {isLoading && <div style={{ ...styles.scanner, backgroundColor: accentColour }} />}
        </div>
      </div>

      {isFiltered && (
        <div style={{ ...styles.filterTag, color: accentColour }}>
          Topology Filter Active: {visibleTracks.length} Units
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
                    onSelect={handleSelectTrack}
                    accentColour={accentColour}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!query.trim() && visibleTracks.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>■</div>
            <div style={styles.emptyText}>Standing by for input.</div>
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
  },
  inputArea: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-color)',
  },
  inputLabel: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    opacity: 0.3,
    fontWeight: 700,
  },
  inputWrap: {
    position: 'relative',
    border: '1px solid var(--border-color)',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(255,255,255,0.01)',
    transition: 'border-color 0.2s ease',
  },
  input: {
    width: '100%',
    fontSize: '0.85rem',
    letterSpacing: '-0.01em',
  },
  scanner: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 1,
    width: '100%',
    opacity: 0.5,
    animation: 'shimmer 1.5s infinite linear',
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
    padding: '3rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    opacity: 0.2,
  },
  emptyIcon: {
    fontSize: '1rem',
  },
  emptyText: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
}
