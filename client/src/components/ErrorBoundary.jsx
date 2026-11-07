import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container py-5">
          <div className="alert alert-danger">
            Something went wrong in this view. Reload the page. The failure was contained so the rest of the portal can keep running.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
