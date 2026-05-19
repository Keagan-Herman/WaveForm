import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerBar } from './PlayerBar'
import { usePlayerStore } from '../../stores/playerStore'
import { DeezerTrack } from '../../lib/deezerApi'
import { AlbumColour } from '../../hooks/useAlbumColour'

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

const mockAccent = {
  h: 141,
  s: 73,
  l: 42,
  hex: '#1db954',
  palette: {
    background: '#050e05',
    surface: '#081208',
    primary: '#1db954',
    secondary: '#1db954',
    accent: '#1db954',
    text: '#f0f0f0',
    textDim: 'rgba(255,255,255,0.5)',
    border: 'rgba(29, 185, 84, 0.2)',
  },
}

describe('PlayerBar', () => {
  beforeEach(() => {
    usePlayerStore.getState().clearQueue()
    usePlayerStore.setState({ currentTrack: null, isPlaying: false, currentTime: 0 })
  })

  it('renders "Nothing playing" when no track is set', () => {
    render(<PlayerBar accent={mockAccent} />)
    expect(screen.getByText('Nothing playing')).toBeDefined()
  })

  it('renders track info when a track is playing', () => {
    usePlayerStore.setState({ currentTrack: mockTrack, isPlaying: true })
    render(<PlayerBar accent={mockAccent} />)

    expect(screen.getByText('Test Track')).toBeDefined()
    expect(screen.getByText('Test Artist')).toBeDefined()
  })

  it('toggles playback when play/pause button is clicked', () => {
    render(<PlayerBar accent={mockAccent} />)
    const playButton = screen.getByLabelText('Play')

    fireEvent.click(playButton)
    expect(usePlayerStore.getState().isPlaying).toBe(true)

    // After state update, it should show Pause
    // Note: In a real React app, re-render happens automatically.
    // RTL's render keeps the component mounted and responding to store changes.
    expect(screen.getByLabelText('Pause')).toBeDefined()

    fireEvent.click(screen.getByLabelText('Pause'))
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })

  it('shows progress time', () => {
    usePlayerStore.setState({ currentTrack: mockTrack, currentTime: 65 })
    render(<PlayerBar accent={mockAccent} />)

    expect(screen.getByText('1:05')).toBeDefined()
    expect(screen.getByText('3:00')).toBeDefined()
  })
})
