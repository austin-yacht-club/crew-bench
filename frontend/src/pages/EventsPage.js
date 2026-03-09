import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete,
} from '@mui/material';
import {
  Event as EventIcon,
  LocationOn,
  CheckCircle,
  OpenInNew,
  DirectionsBoat,
  Flag,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { eventsAPI, availabilityAPI, boatsAPI, fleetsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';

const EventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [myAvailability, setMyAvailability] = useState([]);
  const [boats, setBoats] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [availabilityType, setAvailabilityType] = useState('any');
  const [selectedBoats, setSelectedBoats] = useState([]);
  const [selectedFleets, setSelectedFleets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [eventsRes, boatsRes, fleetsRes] = await Promise.all([
        eventsAPI.list(true),
        boatsAPI.list(),
        fleetsAPI.list(),
      ]);
      setEvents(eventsRes.data);
      setBoats(boatsRes.data);
      setFleets(fleetsRes.data);

      if (user) {
        const availRes = await availabilityAPI.getMy();
        setMyAvailability(availRes.data);
      }
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const isAvailableFor = (eventId) => {
    return myAvailability.some((a) => a.event_id === eventId);
  };

  const getAvailability = (eventId) => {
    return myAvailability.find((a) => a.event_id === eventId);
  };

  const getAvailabilityDescription = (availability) => {
    if (availability.availability_type === 'boats' && availability.preferred_boats?.length > 0) {
      return `For: ${availability.preferred_boats.map(b => b.name).join(', ')}`;
    }
    if (availability.availability_type === 'fleets' && availability.preferred_fleets?.length > 0) {
      return `Fleets: ${availability.preferred_fleets.map(f => f.name).join(', ')}`;
    }
    return 'Any boat';
  };

  const handleOpenDialog = (event) => {
    setSelectedEvent(event);
    setAvailabilityNotes('');
    setAvailabilityType('any');
    setSelectedBoats([]);
    setSelectedFleets([]);
    setDialogOpen(true);
  };

  const handleMarkAvailable = async () => {
    try {
      const data = {
        event_id: selectedEvent.id,
        availability_type: availabilityType,
        notes: availabilityNotes || null,
      };

      if (availabilityType === 'boats' && selectedBoats.length > 0) {
        data.boat_ids = selectedBoats.map(b => b.id);
      }

      if (availabilityType === 'fleets' && selectedFleets.length > 0) {
        data.fleet_ids = selectedFleets.map(f => f.id);
      }

      await availabilityAPI.markAvailable(data);
      setDialogOpen(false);
      loadData();
    } catch (err) {
      setError('Failed to mark availability');
    }
  };

  const handleRemoveAvailability = async (eventId) => {
    const availability = getAvailability(eventId);
    if (availability) {
      try {
        await availabilityAPI.remove(availability.id);
        loadData();
      } catch (err) {
        setError('Failed to remove availability');
      }
    }
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
      <Typography variant="h4" gutterBottom>
        Upcoming Events
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Browse upcoming sailing events and mark your availability
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">No upcoming events</Typography>
            <Typography variant="body2" color="text.secondary">
              Check back later for new events
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => {
            const availability = getAvailability(event.id);
            return (
              <Grid item xs={12} md={6} lg={4} key={event.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Chip
                        label={event.event_type || 'Race'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {event.series && (
                        <Chip label={event.series} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {event.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <EventIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(event.date), 'EEEE, MMMM d, yyyy')}
                      </Typography>
                    </Box>
                    {event.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocationOn sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {event.location}
                        </Typography>
                      </Box>
                    )}
                    {event.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        {event.description}
                      </Typography>
                    )}
                    {availability && (
                      <Chip
                        label={getAvailabilityDescription(availability)}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ mt: 2 }}
                      />
                    )}
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    {event.external_url && (
                      <Button
                        size="small"
                        href={event.external_url}
                        target="_blank"
                        startIcon={<OpenInNew />}
                        sx={{ mr: 1 }}
                      >
                        Details
                      </Button>
                    )}
                    {user && (
                      isAvailableFor(event.id) ? (
                        <Button
                          size="small"
                          color="success"
                          startIcon={<CheckCircle />}
                          onClick={() => handleRemoveAvailability(event.id)}
                        >
                          Available
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleOpenDialog(event)}
                        >
                          Mark Available
                        </Button>
                      )
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Availability</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Let skippers know you're available for {selectedEvent?.name}
          </Typography>

          <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Available for:
            </Typography>
            <RadioGroup
              value={availabilityType}
              onChange={(e) => setAvailabilityType(e.target.value)}
            >
              <FormControlLabel
                value="any"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Any boat</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="boats"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DirectionsBoat sx={{ mr: 1, fontSize: 20 }} />
                    <Typography>Specific boats</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="fleets"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Flag sx={{ mr: 1, fontSize: 20 }} />
                    <Typography>Specific fleets</Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {availabilityType === 'boats' && (
            <Autocomplete
              multiple
              options={boats}
              getOptionLabel={(option) => `${option.name}${option.sail_number ? ` (${option.sail_number})` : ''}`}
              value={selectedBoats}
              onChange={(_, newValue) => setSelectedBoats(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Boats"
                  placeholder="Choose boats you're interested in"
                  helperText="Select the specific boats you'd like to crew on"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    key={option.id}
                  />
                ))
              }
              sx={{ mb: 2 }}
            />
          )}

          {availabilityType === 'fleets' && (
            <Autocomplete
              multiple
              options={fleets}
              getOptionLabel={(option) => option.name}
              value={selectedFleets}
              onChange={(_, newValue) => setSelectedFleets(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Fleets"
                  placeholder="Choose fleets you're interested in"
                  helperText="Select the fleets you'd like to sail with"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    key={option.id}
                  />
                ))
              }
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            fullWidth
            label="Notes (optional)"
            multiline
            rows={3}
            value={availabilityNotes}
            onChange={(e) => setAvailabilityNotes(e.target.value)}
            placeholder="Any position preferences, experience notes, etc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMarkAvailable}
            disabled={
              (availabilityType === 'boats' && selectedBoats.length === 0) ||
              (availabilityType === 'fleets' && selectedFleets.length === 0)
            }
          >
            Confirm Availability
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsPage;
