import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { useHouseholdRealm } from '@/hooks/useHouseholdRealm';
import { isCloudConfigured } from '@/services/database/db';
import { login, logout, setUpHouseholdRealm, inviteMember } from '@/services/householdSync/householdSyncService';

function initialsOf(text: string): string {
  return text.trim().slice(0, 1).toUpperCase() || '?';
}

export function HouseholdSyncSection() {
  const { currentUser, syncState, invites, householdRealm, members } = useHouseholdRealm();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = () => run(async () => login());
  const handleSignOut = () => run(async () => logout());

  const handleSetUp = () =>
    run(async () => {
      await setUpHouseholdRealm();
      setStatus({ type: 'success', message: 'Household sync set up. Invite your household to share this plan.' });
    });

  const handleInvite = () => {
    if (!householdRealm || !inviteEmail.trim()) return;
    setInviteOpen(false);
    void run(async () => {
      await inviteMember(householdRealm.realmId, inviteEmail.trim());
      setStatus({ type: 'success', message: `Invited ${inviteEmail.trim()}.` });
      setInviteEmail('');
    });
  };

  if (!isCloudConfigured) {
    return (
      <CollapsibleSection title="Household" icon={GroupsOutlinedIcon}>
        <Typography variant="body2" color="text.secondary">
          Household sync isn't configured for this build yet. Run{' '}
          <Box component="code" sx={{ px: 0.5 }}>
            npx dexie-cloud create
          </Box>{' '}
          and add the resulting URL as <Box component="code">VITE_DEXIE_CLOUD_URL</Box> in your{' '}
          <Box component="code">.env</Box> file — see README.md.
        </Typography>
      </CollapsibleSection>
    );
  }

  const isSignedIn = Boolean(currentUser?.isLoggedIn);

  return (
    <CollapsibleSection title="Household" icon={GroupsOutlinedIcon}>
      {invites.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {invites.map((invite) => (
            <Alert
              key={invite.id}
              severity="info"
              action={
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => void invite.reject()}>
                    Decline
                  </Button>
                  <Button size="small" variant="contained" onClick={() => void invite.accept()}>
                    Accept
                  </Button>
                </Stack>
              }
            >
              You've been invited to join a household plan.
            </Alert>
          ))}
        </Stack>
      )}

      {!isSignedIn ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sign in to sync your plan with your household in real time — no password, just a
            code sent to your email.
          </Typography>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={handleSignIn}
            disabled={busy}
          >
            Sign in
          </Button>
        </>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
              {initialsOf(currentUser?.email ?? currentUser?.name ?? '?')}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {currentUser?.email ?? currentUser?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {syncState?.status === 'connected'
                  ? 'Synced'
                  : syncState?.status === 'offline'
                    ? 'Offline — will sync when back online'
                    : (syncState?.status ?? 'connecting')}
              </Typography>
            </Box>
            <Button size="small" color="inherit" onClick={handleSignOut} disabled={busy}>
              Sign out
            </Button>
          </Stack>

          {!householdRealm ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Set up household sync to share this plan with your household. Your existing meals
                and plan move over automatically.
              </Typography>
              <Button variant="outlined" onClick={handleSetUp} disabled={busy}>
                Set up household sync
              </Button>
            </>
          ) : (
            <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Household members
                </Typography>
                <Button
                  size="small"
                  startIcon={<PersonAddOutlinedIcon fontSize="small" />}
                  onClick={() => setInviteOpen(true)}
                >
                  Invite
                </Button>
              </Stack>
              <Stack spacing={1}>
                {members.map((member) => (
                  <Stack key={member.id} direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {initialsOf(member.email ?? member.name ?? '?')}
                    </Avatar>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {member.email ?? member.name}
                    </Typography>
                    {member.accepted ? (
                      <Chip
                        size="small"
                        icon={<CheckCircleOutlinedIcon fontSize="small" />}
                        label="joined"
                        color="success"
                        variant="outlined"
                      />
                    ) : (
                      <Chip size="small" label="invited" variant="outlined" />
                    )}
                  </Stack>
                ))}
                {members.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Just you so far — invite your household to share this plan.
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </>
      )}

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Invite a household member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            They'll get an email invite to join. Once accepted, this plan syncs to their devices
            too.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} variant="contained" disabled={!inviteEmail.trim()}>
            Send invite
          </Button>
        </DialogActions>
      </Dialog>
    </CollapsibleSection>
  );
}
