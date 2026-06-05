import { useEffect, useState } from 'react';
import type { ThreadsConnectionStatus, YouTubeConnectionStatus, YouTubeProfile } from '@/components/home/types';

interface YouTubeProfilePayload {
  channel_id: string | null;
  channel_title: string | null;
  google_account_email: string | null;
  google_account_id: string | null;
  name: string;
  refresh_token?: string | null;
}

interface ConnectedCockpitSectionProps {
  onConnectThreads: () => void;
  onDeleteYouTubeProfile: (id: number) => Promise<void>;
  onSaveYouTubeProfile: (payload: YouTubeProfilePayload, id?: number) => Promise<void>;
  threadsConnection: ThreadsConnectionStatus | null;
  youtubeConnection: YouTubeConnectionStatus | null;
  youtubeProfiles: YouTubeProfile[];
}

export function ConnectedCockpitSection({
  onConnectThreads,
  onDeleteYouTubeProfile,
  onSaveYouTubeProfile,
  threadsConnection,
  youtubeConnection,
  youtubeProfiles,
}: ConnectedCockpitSectionProps) {
  const [profileModal, setProfileModal] = useState<YouTubeProfile | 'new' | null>(null);
  const [profileDraft, setProfileDraft] = useState<YouTubeProfilePayload>(getEmptyProfileDraft());
  const [busyAction, setBusyAction] = useState<string | null>(null);
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
  const connectedYouTubeProfiles = youtubeProfiles.filter((profile) => profile.has_refresh_token || profile.has_access_token).length;
  const youtubeConfigured = youtubeConnection?.configured === true;

  useEffect(() => {
    if (!profileModal) {
      return;
    }

    setProfileDraft(profileModal === 'new'
      ? getEmptyProfileDraft()
      : {
        channel_id: profileModal.channel_id,
        channel_title: profileModal.channel_title,
        google_account_email: profileModal.google_account_email,
        google_account_id: profileModal.google_account_id,
        name: profileModal.name,
      });
  }, [profileModal]);

  const saveProfile = async () => {
    setBusyAction('profile');
    try {
      await onSaveYouTubeProfile(profileDraft, profileModal && profileModal !== 'new' ? profileModal.id : undefined);
      setProfileModal(null);
    } finally {
      setBusyAction(null);
    }
  };

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
        <details className="cockpit-card">
          <summary className="cockpit-card-header">
            <div>
              <strong>Threads</strong>
              <p className="cockpit-copy">
                Publish one-shot text output directly to Threads.
              </p>
            </div>
            <span className={`cockpit-status-pill${connected ? ' cockpit-status-pill-connected' : ''}`}>
              {statusLabel}
            </span>
          </summary>

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
        </details>

        <details className="cockpit-card">
          <summary className="cockpit-card-header">
            <div>
              <strong>YouTube</strong>
              <p className="cockpit-copy">
                Manage channel identities and encrypted token state. Per-workflow upload config is filled from the workflow Publish modal.
              </p>
            </div>
            <span className={`cockpit-status-pill${connectedYouTubeProfiles > 0 ? ' cockpit-status-pill-connected' : ''}`}>
              {!youtubeConnection
                ? 'Checking'
                : !youtubeConfigured
                  ? 'Missing config'
                  : youtubeProfiles.length === 0
                    ? 'No profiles'
                    : `${connectedYouTubeProfiles}/${youtubeProfiles.length} ready`}
            </span>
          </summary>

          <div className="cockpit-stack">
            <div className="cockpit-meta-grid">
              <div className="cockpit-meta-item">
                <span className="cockpit-meta-label">Callback URL</span>
                <code className="cockpit-meta-value">
                  {youtubeConnection?.callbackUrl ?? 'Loading callback URL...'}
                </code>
              </div>
              <div className="cockpit-meta-item">
                <span className="cockpit-meta-label">OAuth config</span>
                <p className="cockpit-meta-value">
                  {youtubeConnection
                    ? youtubeConnection.configured
                      ? youtubeConnection.hasExplicitRedirectUri
                        ? 'Client credentials configured / explicit redirect URI set'
                        : 'Client credentials configured / redirect URI inferred from request host'
                      : 'Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET'
                    : 'Checking...'}
                </p>
              </div>
            </div>

            <div className="cockpit-section-row">
              <div>
                <span className="cockpit-meta-label">Profiles</span>
                <p className="cockpit-copy">Channel identities used by workflow publish configs.</p>
              </div>
              <button type="button" className="gemini-secondary-button" onClick={() => setProfileModal('new')}>
                Add profile
              </button>
            </div>

            <div className="cockpit-line-list">
              {youtubeProfiles.length === 0 ? (
                <p className="audio-empty-copy">No YouTube profiles yet.</p>
              ) : youtubeProfiles.map((profile) => (
                <div key={profile.id} className="cockpit-line-item">
                  <div>
                    <strong>{profile.name}</strong>
                    <p className="cockpit-copy">
                      {profile.channel_title || profile.channel_id || profile.google_account_email || 'Channel metadata pending'}
                    </p>
                  </div>
                  <span className={`cockpit-status-pill${profile.has_refresh_token ? ' cockpit-status-pill-connected' : ''}`}>
                    {profile.has_refresh_token ? 'Token saved' : 'No token'}
                  </span>
                  <button type="button" className="workflow-link" onClick={() => setProfileModal(profile)}>Edit</button>
                  {youtubeConfigured ? (
                    <a className="workflow-link" href={`/api/youtube/oauth/start?profileId=${profile.id}&returnTo=/`}>
                      Connect OAuth
                    </a>
                  ) : (
                    <span className="workflow-link">Missing OAuth env</span>
                  )}
                  <button type="button" className="workflow-link" onClick={() => { void onDeleteYouTubeProfile(profile.id); }}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      {profileModal && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setProfileModal(null)}>
          <div className="system-prompt-detail-card" role="dialog" aria-modal="true" aria-label="YouTube profile" onClick={(event) => event.stopPropagation()}>
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">YouTube Profile</p>
                <h3>{profileModal === 'new' ? 'Add channel identity' : 'Edit channel identity'}</h3>
              </div>
              <button type="button" className="system-prompt-detail-close" onClick={() => setProfileModal(null)}>×</button>
            </div>

            <div className="youtube-modal-grid">
              <label>
                <span>Name</span>
                <input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Main Shorts Channel" />
              </label>
              <label>
                <span>Channel ID</span>
                <input value={profileDraft.channel_id ?? ''} onChange={(event) => setProfileDraft((current) => ({ ...current, channel_id: event.target.value }))} placeholder="UC..." />
              </label>
              <label>
                <span>Channel title</span>
                <input value={profileDraft.channel_title ?? ''} onChange={(event) => setProfileDraft((current) => ({ ...current, channel_title: event.target.value }))} placeholder="Public channel name" />
              </label>
              <label>
                <span>Account email</span>
                <input value={profileDraft.google_account_email ?? ''} onChange={(event) => setProfileDraft((current) => ({ ...current, google_account_email: event.target.value }))} placeholder="owner@gmail.com" />
              </label>
              <label className="youtube-modal-wide">
                <span>Refresh token</span>
                <textarea value={profileDraft.refresh_token ?? ''} onChange={(event) => setProfileDraft((current) => ({ ...current, refresh_token: event.target.value }))} placeholder="Paste manual Google refresh_token here, or use Connect OAuth after saving the profile." rows={3} />
              </label>
            </div>

            <div className="gemini-action-row">
              <button type="button" className="gemini-secondary-button" onClick={() => setProfileModal(null)}>Cancel</button>
              <button type="button" className="gemini-save-button" disabled={!profileDraft.name.trim() || busyAction !== null} onClick={() => { void saveProfile(); }}>
                {busyAction === 'profile' ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function getEmptyProfileDraft(): YouTubeProfilePayload {
  return {
    channel_id: null,
    channel_title: null,
    google_account_email: null,
    google_account_id: null,
    name: '',
    refresh_token: '',
  };
}
