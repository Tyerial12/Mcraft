import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error) {
    console.error('VeinForge ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyDetail = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message);
      if (parsed?.operationType && parsed?.error) {
        friendlyDetail = `Cloud Sync (${parsed.operationType}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e131a] p-6 text-[#f4efe6]">
        <div className="w-full max-w-lg rounded-lg border border-[#d4a14a]/35 bg-[#131820] p-6">
          <h2 className="font-display text-xl font-semibold text-[#e3b868]">
            Expedition Interrupted
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#9ba7b8]">
            VeinForge: Voxel Frontier encountered an unexpected runtime error. Your local save slots remain intact.
          </p>
          <pre className="mt-4 max-h-36 overflow-auto rounded border border-white/10 bg-[#0e131a] p-3 font-mono text-xs text-[#e2e8f0] whitespace-pre-wrap">
            {friendlyDetail}
          </pre>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="rounded border border-[#d4a14a]/40 bg-[#d4a14a] px-4 py-2 text-sm font-semibold text-[#0e131a] hover:bg-[#e3b868] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Resume Session
            </button>
          </div>
        </div>
      </div>
    );
  }
}
