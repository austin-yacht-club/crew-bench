import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import { People, Person, Email, Phone, Close } from '@mui/icons-material';
import { contactsAPI } from '../services/api';

const EXPERIENCE_LABELS = {
  novice: 'Never sailed before',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

const POSITION_OPTIONS = ['Bow', 'Rail', 'Trimmer', 'Pit', 'Helm', 'Tactician', 'Any'];

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await contactsAPI.list();
        setContacts(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleOpenProfile = async (contact) => {
    setSelectedContact(contact);
    setProfile(null);
    setProfileLoading(true);
    try {
      const res = await contactsAPI.get(contact.id);
      setProfile(res.data);
    } catch (err) {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCloseProfile = () => {
    setSelectedContact(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
        Contacts
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        People you’re connected with through crew requests. Tap a contact to view their profile.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {contacts.length === 0 && !error && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">No contacts yet</Typography>
            <Typography variant="body2" color="text.secondary">
              When you send or receive crew requests, those people will appear here so you can view their profiles.
            </Typography>
          </CardContent>
        </Card>
      )}

      {contacts.length > 0 && (
        <Grid container spacing={2}>
          {contacts.map((contact) => (
            <Grid item xs={12} sm={6} md={4} key={contact.id}>
              <Card>
                <CardActionArea onClick={() => handleOpenProfile(contact)}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={contact.profile_picture || undefined}
                      sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
                    >
                      {!contact.profile_picture && contact.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {contact.name}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        <Chip label={contact.role || 'crew'} size="small" color="primary" sx={{ height: 22 }} />
                        <Chip
                          label={EXPERIENCE_LABELS[contact.experience_level] || contact.experience_level || '—'}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22 }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={Boolean(selectedContact)} onClose={handleCloseProfile} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Profile</span>
          <Button startIcon={<Close />} onClick={handleCloseProfile} size="small">
            Close
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {profileLoading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}
          {profile && !profileLoading && (
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
              {(profile.weight || profile.certifications) && (
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
          <Button onClick={handleCloseProfile}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContactsPage;
