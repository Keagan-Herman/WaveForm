/**
 * Simple Canvas Recorder using MediaRecorder API
 */
export class CanvasRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  constructor(private canvas: HTMLCanvasElement) {}

  start() {
    this.chunks = []
    this.stream = this.canvas.captureStream(60) // 60 FPS

    // Check supported types
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const type = types.find(t => MediaRecorder.isTypeSupported(t)) || ''

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: type,
      videoBitsPerSecond: 5000000 // 5Mbps
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `waveform-capture-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }

    this.mediaRecorder.start()
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
  }
}
