import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Avatar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { crewPoolAPI, conversationsAPI } from '../services/api';

const CrewPoolContactDialog = ({ open, onClose, crewMember }) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !crewMember?.id) {
      setMessage('');
      setProfile(null);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    crewPoolAPI
      .getCrewProfile(crewMember.id)
      .then((res) => {
        if (!cancelled) setProfile(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load crew profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, crewMember?.id]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !crewMember?.id) return;
    setSending(true);
    setError('');
    try {
      const res = await conversationsAPI.start(crewMember.id, trimmed);
      onClose();
      navigate(`/messages/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const preferredLabel = {
    email: 'email',
    phone: 'phone call',
    sms: 'SMS/text',
    any: 'any method',
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send message</DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {!loading && profile && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar
                src={profile.profile_picture || undefined}
                sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}
              >
                {!profile.profile_picture && profile.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{profile.name}</Typography>
                {profile.preferred_contact_method && (
                  <Typography variant="caption" color="text.secondary">
                    Prefers {preferredLabel[profile.preferred_contact_method] || profile.preferred_contact_method} contact
                  </Typography>
                )}
              </Box>
            </Box>
            {(profile.allow_email_contact && profile.email) ||
            ((profile.allow_phone_contact || profile.allow_sms_contact) && profile.phone) ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                After messaging, you can also reach them via their shared contact details in the conversation.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                This crew member has not shared direct contact details. In-app messaging is the best way to reach them.
              </Alert>
            )}
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        <TextField
          fullWidth
          multiline
          minRows={4}
          label="Your message"
          placeholder="Introduce yourself and let them know what kind of crew opportunity you have..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending || loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={handleSend}
          disabled={sending || loading || !message.trim()}
        >
          {sending ? 'Sending...' : 'Send message'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CrewPoolContactDialog;
