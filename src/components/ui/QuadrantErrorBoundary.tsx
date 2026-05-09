import React from 'react'

interface QuadrantErrorBoundaryProps {
  label: string
  children: React.ReactNode
  accent?: string
}

interface QuadrantErrorBoundaryState {
  hasError: boolean
}

export class QuadrantErrorBoundary extends React.Component<
  QuadrantErrorBoundaryProps,
  QuadrantErrorBoundaryState
> {
  constructor(props: QuadrantErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.label}] Visualiser error:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const color = this.props.accent || '#ff4444'
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            opacity: 0.5,
            padding: '2rem',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            textAlign: 'center',
            color: color,
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠</p>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {this.props.label} render error
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '1rem',
              background: 'transparent',
              border: `1px solid ${color}`,
              color: color,
              padding: '0.2rem 0.5rem',
              fontSize: '0.6rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
