import { Component } from 'react';

// If a 3D piece fails (WebGL refused, or a code chunk didn't load after a redeploy),
// show the fallback instead of taking the whole page down with it.
export default class SafeBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('A 3D section failed to load and was skipped:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}
