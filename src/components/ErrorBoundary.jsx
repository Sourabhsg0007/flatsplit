import { Component } from 'react'
import { Button } from './ui/button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="brand">
              <span className="brand-mark">{'÷'}</span>
              <h1>Something went wrong</h1>
              <p className="brand-sub">
                A hiccup while rendering. Refresh to keep going — your data is safe.
              </p>
            </div>
            <Button className="block" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
