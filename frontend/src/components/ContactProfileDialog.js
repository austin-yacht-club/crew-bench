import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Email, Phone, Close } from '@mui/icons-material';
import { contactsAPI } from '../services/api';

const EXPERIENCE_LABELS = {
  novice: 'Never sailed before',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

const ContactProfileDialog = ({ open, onClose, userId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setProfile(null);
    setError(false);
    setLoading(true);
    contactsAPI
      .get(userId)
      .then((res) => {
        if (!cancelled) setProfile(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, userId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Profile</span>
        <Button startIcon={<Close />} onClick={onClose} size="small">
          Close
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {error && !loading && (
          <Typography color="text.secondary">Could not load profile.</Typography>
        )}
        {profile && !loading && !error && (
          <Box>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Avatar
                src={profile.profile_picture || undefined}
                sx={{ width: 80, height: 80, mx: 'auto', mb: 1, bgcolor: 'primary.main' }}
              >
                {!profile.profile_picture && profile.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h6">{profile.name}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip label={profile.role || 'crew'} color="primary" size="small" />
                <Chip
                  label={EXPERIENCE_LABELS[profile.experience_level] || profile.experience_level || '—'}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            {profile.bio && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Bio
                </Typography>
                <Typography variant="body2">{profile.bio}</Typography>
              </Box>
            )}
            {(profile.weight != null || profile.certifications) && (
              <Box sx={{ mb: 2 }}>
                {profile.weight != null && (
                  <Typography variant="body2">
                    <strong>Weight:</strong> {profile.weight} lbs
                  </Typography>
                )}
                {profile.certifications && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Certifications:</strong> {profile.certifications}
                  </Typography>
                )}
              </Box>
            )}
            {profile.position_preferences && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Position preferences
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {profile.position_preferences.split(',').map((p) => (
                    <Chip key={p} label={p.trim()} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Contact
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {profile.allow_email_contact && profile.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email fontSize="small" color="action" />
                  <Typography variant="body2" component="a" href={`mailto:${profile.email}`}>
                    {profile.email}
                  </Typography>
                </Box>
              )}
              {(profile.allow_phone_contact || profile.allow_sms_contact) && profile.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Phone fontSize="small" color="action" />
                  <Typography variant="body2" component="a" href={`tel:${profile.phone}`}>
                    {profile.phone}
                  </Typography>
                </Box>
              )}
              {!(profile.allow_email_contact && profile.email) &&
                !((profile.allow_phone_contact || profile.allow_sms_contact) && profile.phone) && (
                  <Typography variant="body2" color="text.secondary">
                    No contact details shared
                  </Typography>
                )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContactProfileDialog;
