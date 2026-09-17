import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui'

interface State {
  error: Error | null
}

/** Last line of defence: an unexpected render error shows a recoverable panel instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="mx-auto my-16 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40"
      >
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{this.state.error.message}</p>
        <Button className="mt-4" variant="primary" onClick={() => window.location.reload()}>
          Reload the app
        </Button>
      </div>
    )
  }
}
