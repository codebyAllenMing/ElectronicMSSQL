import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-red-500">
          <p className="font-semibold">Runtime Error</p>
          <pre className="text-xs text-red-400 bg-red-950/20 rounded p-4 max-w-xl overflow-auto">
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
