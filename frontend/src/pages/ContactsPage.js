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
} from '@mui/material';
import { People } from '@mui/icons-material';
import { contactsAPI } from '../services/api';
import ContactProfileDialog from '../components/ContactProfileDialog';

const EXPERIENCE_LABELS = {
  novice: 'Never sailed before',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUserId, setProfileUserId] = useState(null);

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

  const handleOpenProfile = (contact) => setProfileUserId(contact.id);
  const handleCloseProfile = () => setProfileUserId(null);

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

      <ContactProfileDialog
        open={Boolean(profileUserId)}
        onClose={handleCloseProfile}
        userId={profileUserId}
      />
    </Box>
  );
};

export default ContactsPage;
