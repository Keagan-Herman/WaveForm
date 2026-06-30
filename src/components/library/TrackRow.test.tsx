import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackRow } from './TrackRow'
import type { DeezerTrack } from '@/types/track'

const mockTrack: DeezerTrack = {
  id: 1,
  title: 'Test Track',
  duration: 180,
  preview: 'https://test.com/preview.mp3',
  artist: { id: 1, name: 'Test Artist', picture_medium: '', picture_big: '' },
  album: { id: 1, title: 'Test Album', cover_medium: '', cover_big: '' },
  source: 'deezer',
  rank: 1000,
  explicit_lyrics: false,
}

describe('TrackRow', () => {
  it('renders track information correctly', () => {
    render(<TrackRow track={mockTrack} isActive={false} index={0} onSelect={() => {}} />)

    expect(screen.getByText('Test Track')).toBeDefined()
    expect(screen.getByText('Test Artist')).toBeDefined()
    expect(screen.getByText('Test Album')).toBeDefined()
    expect(screen.getByText('03:00')).toBeDefined() // 180 seconds
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<TrackRow track={mockTrack} isActive={false} index={5} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockTrack, 5)
  })

  it('shows playing indicator when active and playing', () => {
    render(
      <TrackRow track={mockTrack} isActive={true} isPlaying={true} index={0} onSelect={() => {}} />
    )

    // PlayingBars is aria-hidden, so we check for its container if possible
    // or we can check that the index is NOT shown.
    expect(screen.queryByText('1')).toBeNull()
  })

  it('shows explicit badge if track is explicit', () => {
    const explicitTrack = { ...mockTrack, explicit_lyrics: true }
    render(<TrackRow track={explicitTrack} isActive={false} index={0} onSelect={() => {}} />)

    expect(screen.getByLabelText('Explicit content')).toBeDefined()
  })
})
