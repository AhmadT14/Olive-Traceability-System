import { Component, Suspense } from "react";
import Button from "../Button";
import { Loading } from "../State";

// Wraps code that loads on demand. A file can fail to load (no connection, or
// a new version was deployed), so that gets a message instead of a blank page.
export default class LoadBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="state state--error" role="alert">
          <span>
            This part of the page could not load. Check your connection and
            reload.
          </span>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return <Suspense fallback={<Loading />}>{this.props.children}</Suspense>;
  }
}
