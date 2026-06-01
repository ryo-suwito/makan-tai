import type { ThreadsConnectionStatus } from '@/components/home/types';

interface ConnectedCockpitSectionProps {
  onConnectThreads: () => void;
  threadsConnection: ThreadsConnectionStatus | null;
}

export function ConnectedCockpitSection({
  onConnectThreads,
  threadsConnection,
}: ConnectedCockpitSectionProps) {
  const statusKnown = threadsConnection !== null;
  const configured = threadsConnection?.configured ?? false;
  const connected = threadsConnection?.connected ?? false;
  const statusLabel = !statusKnown
    ? 'Checking'
    : !configured
      ? 'Missing config'
      : connected
        ? 'Connected'
        : 'Ready to connect';
  const buttonLabel = !statusKnown
    ? 'Checking Threads...'
    : !configured
      ? 'Config required'
      : connected
        ? 'Reconnect Threads'
        : 'Connect Threads';

  return (
    <div className="gemini-section mt-6">
      <div className="gemini-section-header">
        <p className="voice-section-kicker">Integrations</p>
        <h2 className="text-xl font-bold mb-2">Connected Cockpit</h2>
        <p className="text-sm text-gray-600">
          Connect external services here before you generate content. This section is meant to grow as more third-party publishing targets get added.
        </p>
      </div>

      <div className="cockpit-grid">
        <div className="cockpit-card">
          <div className="cockpit-card-header">
            <div>
              <strong>Threads</strong>
              <p className="cockpit-copy">
                Publish one-shot text output directly to Threads.
              </p>
            </div>
            <span className={`cockpit-status-pill${connected ? ' cockpit-status-pill-connected' : ''}`}>
              {statusLabel}
            </span>
          </div>

          <div className="cockpit-meta-grid">
            <div className="cockpit-meta-item">
              <span className="cockpit-meta-label">Callback URL</span>
              <code className="cockpit-meta-value">
                {threadsConnection?.callbackUrl ?? 'Loading callback URL...'}
              </code>
            </div>

            {threadsConnection?.userId && (
              <div className="cockpit-meta-item">
                <span className="cockpit-meta-label">Threads user</span>
                <span className="cockpit-meta-value">{threadsConnection.userId}</span>
              </div>
            )}

            {threadsConnection?.expiresAt && (
              <div className="cockpit-meta-item">
                <span className="cockpit-meta-label">Token expires</span>
                <span className="cockpit-meta-value">{new Date(threadsConnection.expiresAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="gemini-action-row">
            <button
              type="button"
              className="threads-publish-button"
              onClick={onConnectThreads}
              disabled={!statusKnown || !configured}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
