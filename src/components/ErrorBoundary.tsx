import { Component, type ReactNode } from 'react';

/** A crashing tool must never blank the whole app (shows recovery UI instead). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-bold">WinKit hit an unexpected error.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Your files are safe - nothing was uploaded. Reload to start fresh.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
