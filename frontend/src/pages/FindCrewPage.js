import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { People, Send, Event as EventIcon, PlaylistAdd } from '@mui/icons-material';
import { eventsAPI, boatsAPI, crewRequestsAPI, seriesAPI } from '../services/api';

const FindCrewPage = () => {
  const [events, setEvents] = useState([]);
  const [boats, setBoats] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [selectionMode, setSelectionMode] = useState('event');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [selectedBoat, setSelectedBoat] = useState('');
  const [availableCrew, setAvailableCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [message, setMessage] = useState('');
  const [requestForSeries, setRequestForSeries] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadAvailableCrew();
    }
  }, [selectedEvent]);

  const seriesEvents = useMemo(() => {
    if (!selectedSeries) return [];
    return events.filter(e => e.series === selectedSeries);
  }, [events, selectedSeries]);

  const loadInitialData = async () => {
    try {
      const [eventsRes, boatsRes, seriesRes] = await Promise.all([
        eventsAPI.list(true),
        boatsAPI.listMy(),
        seriesAPI.list(true),
      ]);
      setEvents(eventsRes.data);
      setBoats(boatsRes.data);
      setSeriesList(seriesRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCrew = async () => {
    try {
      const response = await eventsAPI.getAvailableCrew(selectedEvent);
      setAvailableCrew(response.data);
    } catch (err) {
      setError('Failed to load available crew');
    }
  };

  const getSelectedEventSeries = () => {
    if (!selectedEvent) return null;
    const event = events.find(e => e.id === parseInt(selectedEvent));
    return event?.series || null;
  };

  const handleSendRequest = async () => {
    if (!selectedBoat) {
      setError('Please select a boat first');
      return;
    }

    try {
      const eventSeries = getSelectedEventSeries();
      
      if (requestForSeries && eventSeries) {
        const result = await crewRequestsAPI.createForSeries({
          boat_id: parseInt(selectedBoat),
          crew_id: selectedCrew.crew.id,
          series: eventSeries,
          message,
        });
        setSuccess(`Sent ${result.data.length} requests to ${selectedCrew.crew.name} for ${eventSeries}`);
      } else {
        await crewRequestsAPI.create({
          boat_id: parseInt(selectedBoat),
          crew_id: selectedCrew.crew.id,
          event_id: parseInt(selectedEvent),
          message,
        });
        setSuccess(`Request sent to ${selectedCrew.crew.name}`);
      }
      
      setDialogOpen(false);
      setMessage('');
      setRequestForSeries(false);
      loadAvailableCrew();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send request');
    }
  };

  const experienceColor = (level) => {
    const colors = {
      beginner: 'default',
      intermediate: 'info',
      advanced: 'warning',
      expert: 'success',
    };
    return colors[level] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
        Find Crew
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Browse available crew for your upcoming events
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {boats.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          You need to add a boat before you can send crew requests.
        </Alert>
      ) : (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Boat</InputLabel>
                  <Select
                    value={selectedBoat}
                    onChange={(e) => setSelectedBoat(e.target.value)}
                    label="Select Boat"
                  >
                    {boats.map((boat) => (
                      <MenuItem key={boat.id} value={boat.id}>
                        {boat.name} {boat.sail_number ? `(${boat.sail_number})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Event</InputLabel>
                  <Select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    label="Select Event"
                  >
                    {events.map((event) => (
                      <MenuItem key={event.id} value={event.id}>
                        {event.name} - {new Date(event.date).toLocaleDateString()}
                        {event.series && ` (${event.series})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {getSelectedEventSeries() && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<PlaylistAdd />}>
                    This event is part of <strong>{getSelectedEventSeries()}</strong>. 
                    When inviting crew, you can choose to invite them for all events in the series.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedEvent && availableCrew.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">No available crew</Typography>
            <Typography variant="body2" color="text.secondary">
              No one has marked themselves as available for this event yet
            </Typography>
          </CardContent>
        </Card>
      )}

      {availableCrew.length > 0 && (
        <Grid container spacing={3}>
          {availableCrew.map((availability) => (
            <Grid item xs={12} md={6} lg={4} key={availability.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      {availability.crew?.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{availability.crew?.name}</Typography>
                      <Chip
                        label={availability.crew?.experience_level || 'beginner'}
                        size="small"
                        color={experienceColor(availability.crew?.experience_level)}
                      />
                    </Box>
                  </Box>
                  {availability.crew?.weight && (
                    <Typography variant="body2" color="text.secondary">
                      Weight: {availability.crew.weight} lbs
                    </Typography>
                  )}
                  {availability.crew?.certifications && (
                    <Typography variant="body2" color="text.secondary">
                      Certifications: {availability.crew.certifications}
                    </Typography>
                  )}
                  {availability.crew?.bio && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {availability.crew.bio}
                    </Typography>
                  )}
                  {availability.notes && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                      "{availability.notes}"
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={() => {
                      setSelectedCrew(availability);
                      setDialogOpen(true);
                    }}
                    disabled={!selectedBoat}
                  >
                    Send Request
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Crew Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Invite {selectedCrew?.crew?.name} to crew on your boat
          </Typography>
          
          {getSelectedEventSeries() && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Request scope:
              </Typography>
              <ToggleButtonGroup
                value={requestForSeries}
                exclusive
                onChange={(_, value) => value !== null && setRequestForSeries(value)}
                fullWidth
                size="small"
              >
                <ToggleButton value={false}>
                  <EventIcon sx={{ mr: 1 }} />
                  This Event Only
                </ToggleButton>
                <ToggleButton value={true}>
                  <PlaylistAdd sx={{ mr: 1 }} />
                  Entire Series ({events.filter(e => e.series === getSelectedEventSeries()).length} events)
                </ToggleButton>
              </ToggleButtonGroup>
              {requestForSeries && (
                <Alert severity="info" sx={{ mt: 1 }} icon={false}>
                  This will send invitations for all upcoming events in <strong>{getSelectedEventSeries()}</strong>.
                </Alert>
              )}
            </Box>
          )}
          
          <TextField
            fullWidth
            label="Message (optional)"
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a personal message..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSendRequest}>
            {requestForSeries ? 'Send Series Request' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FindCrewPage;
