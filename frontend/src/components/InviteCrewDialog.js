import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Event as EventIcon, PlaylistAdd } from '@mui/icons-material';
import { crewRequestsAPI } from '../services/api';

/**
 * Dialog for skippers to invite a crew member to an event or series.
 * Reuses existing crew-requests APIs.
 */
const InviteCrewDialog = ({
  open,
  onClose,
  crewMember,
  boats = [],
  events = [],
  onSuccess,
  onError,
  source = 'pool',
}) => {
  const [selectedBoat, setSelectedBoat] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [message, setMessage] = useState('');
  const [requestForSeries, setRequestForSeries] = useState(false);
  const [addToWaitlist, setAddToWaitlist] = useState(false);
  const [nextWaitlistPosition, setNextWaitlistPosition] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedBoat('');
      setSelectedEvent('');
      setMessage('');
      setRequestForSeries(false);
      setAddToWaitlist(false);
      setNextWaitlistPosition(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedBoat || !selectedEvent) {
      setNextWaitlistPosition(null);
      return;
    }
    let cancelled = false;
    crewRequestsAPI
      .getNextWaitlistPosition(parseInt(selectedBoat), parseInt(selectedEvent))
      .then((res) => {
        if (!cancelled) setNextWaitlistPosition(res.data.next_position);
      })
      .catch(() => {
        if (!cancelled) setNextWaitlistPosition(1);
      });
    return () => { cancelled = true; };
  }, [open, selectedBoat, selectedEvent]);

  const getSelectedEventSeries = () => {
    if (!selectedEvent) return null;
    const event = events.find((e) => e.id === parseInt(selectedEvent));
    return event?.series || null;
  };

  const handleSend = async () => {
    if (!selectedBoat) {
      onError?.('Please select a boat');
      return;
    }
    if (!selectedEvent) {
      onError?.('Please select an event');
      return;
    }
    if (!crewMember?.id) return;

    setSubmitting(true);
    try {
      const eventSeries = getSelectedEventSeries();
      const waitlistPos = addToWaitlist ? nextWaitlistPosition : null;

      if (requestForSeries && eventSeries) {
        const result = await crewRequestsAPI.createForSeries({
          boat_id: parseInt(selectedBoat),
          crew_id: crewMember.id,
          series: eventSeries,
          message,
          waitlist_position: waitlistPos,
        });
        const action = addToWaitlist ? 'Added to waitlist' : 'Sent';
        onSuccess?.(
          `${action} ${result.data.length} invitation${result.data.length === 1 ? '' : 's'} to ${crewMember.name} for ${eventSeries}`
        );
      } else {
        await crewRequestsAPI.create({
          boat_id: parseInt(selectedBoat),
          crew_id: crewMember.id,
          event_id: parseInt(selectedEvent),
          message,
          waitlist_position: waitlistPos,
        });
        const event = events.find((e) => e.id === parseInt(selectedEvent));
        const action = addToWaitlist ? 'Added to waitlist' : 'Invitation sent';
        onSuccess?.(
          `${action}: ${crewMember.name} for ${event?.name || 'event'}${addToWaitlist ? ` (position #${nextWaitlistPosition})` : ''}`
        );
      }
      onClose();
    } catch (err) {
      onError?.(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const eventSeries = getSelectedEventSeries();
  const seriesEventCount = eventSeries
    ? events.filter((e) => e.series === eventSeries).length
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite to Event</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Invite <strong>{crewMember?.name}</strong> to crew on your boat
          {source === 'pool' && (
            <> — this is an <strong>event-specific</strong> invitation, separate from their general pool interest</>
          )}
        </Typography>

        {source === 'pool' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Crew Pool shows general availability. This invitation asks them to crew for a specific race day
            and will appear in their Requests inbox.
          </Alert>
        )}

        {boats.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Add a boat before sending invitations.
          </Alert>
        ) : (
          <FormControl fullWidth sx={{ mb: 2 }}>
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
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Select Event</InputLabel>
          <Select
            value={selectedEvent}
            onChange={(e) => {
              setSelectedEvent(e.target.value);
              setRequestForSeries(false);
            }}
            label="Select Event"
          >
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>
                {event.name} — {new Date(event.date).toLocaleDateString()}
                {event.series ? ` (${event.series})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {eventSeries && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Invitation scope:
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
                Entire Series ({seriesEventCount} events)
              </ToggleButton>
            </ToggleButtonGroup>
            {requestForSeries && (
              <Alert severity="info" sx={{ mt: 1 }} icon={false}>
                This will send invitations for all upcoming events in <strong>{eventSeries}</strong>.
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
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={addToWaitlist}
              onChange={(e) => setAddToWaitlist(e.target.checked)}
            />
          }
          label={
            <Box>
              <Typography variant="body2">
                Add to waitlist instead of primary request
              </Typography>
              {addToWaitlist && nextWaitlistPosition && (
                <Typography variant="caption" color="text.secondary">
                  Will be position #{nextWaitlistPosition} on the waitlist.
                </Typography>
              )}
            </Box>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={submitting || !selectedBoat || !selectedEvent || boats.length === 0}
        >
          {submitting
            ? 'Sending...'
            : addToWaitlist
              ? 'Add to Waitlist'
              : requestForSeries
                ? 'Send Series Invitation'
                : 'Send Invitation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteCrewDialog;
