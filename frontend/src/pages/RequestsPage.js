import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Tabs,
  Tab,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import { Inbox, Send, CheckCircle, Cancel, Schedule } from '@mui/icons-material';
import { format } from 'date-fns';
import { crewRequestsAPI } from '../services/api';

const RequestsPage = () => {
  const [tab, setTab] = useState(0);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const [receivedRes, sentRes] = await Promise.all([
        crewRequestsAPI.getReceived(),
        crewRequestsAPI.getSent(),
      ]);
      setReceivedRequests(receivedRes.data);
      setSentRequests(sentRes.data);
    } catch (err) {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (status) => {
    try {
      await crewRequestsAPI.respond(selectedRequest.id, status, responseMessage);
      setDialogOpen(false);
      setResponseMessage('');
      loadRequests();
    } catch (err) {
      setError('Failed to respond to request');
    }
  };

  const statusChip = (status) => {
    const config = {
      pending: { color: 'warning', icon: <Schedule />, label: 'Pending' },
      accepted: { color: 'success', icon: <CheckCircle />, label: 'Accepted' },
      declined: { color: 'error', icon: <Cancel />, label: 'Declined' },
    };
    const c = config[status] || config.pending;
    return <Chip icon={c.icon} label={c.label} color={c.color} size="small" />;
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
        Crew Requests
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage your crew invitations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<Inbox />} label={`Received (${receivedRequests.length})`} />
        <Tab icon={<Send />} label={`Sent (${sentRequests.length})`} />
      </Tabs>

      {tab === 0 && (
        <>
          {receivedRequests.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Inbox sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">No requests received</Typography>
                <Typography variant="body2" color="text.secondary">
                  Mark yourself as available for events to receive crew invitations
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {receivedRequests.map((request) => (
                <Grid item xs={12} md={6} key={request.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">{request.boat?.name}</Typography>
                        {statusChip(request.status)}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Event: {request.event?.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Date: {request.event?.date && format(new Date(request.event.date), 'MMM d, yyyy')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Boat: {[request.boat?.make, request.boat?.model].filter(Boolean).join(' ')}
                      </Typography>
                      {request.message && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          "{request.message}"
                        </Typography>
                      )}
                      {request.status === 'pending' && (
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDialogOpen(true);
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDialogOpen(true);
                            }}
                          >
                            Decline
                          </Button>
                        </Box>
                      )}
                      {request.response_message && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Your response: "{request.response_message}"
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {sentRequests.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Send sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">No requests sent</Typography>
                <Typography variant="body2" color="text.secondary">
                  Find available crew for your events
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {sentRequests.map((request) => (
                <Grid item xs={12} md={6} key={request.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}>
                            {request.crew?.name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="h6">{request.crew?.name}</Typography>
                        </Box>
                        {statusChip(request.status)}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Event: {request.event?.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Date: {request.event?.date && format(new Date(request.event.date), 'MMM d, yyyy')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Boat: {request.boat?.name}
                      </Typography>
                      {request.message && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          Your message: "{request.message}"
                        </Typography>
                      )}
                      {request.response_message && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Their response: "{request.response_message}"
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Respond to Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Respond to the crew invitation from {selectedRequest?.boat?.name}
          </Typography>
          <TextField
            fullWidth
            label="Message (optional)"
            multiline
            rows={3}
            value={responseMessage}
            onChange={(e) => setResponseMessage(e.target.value)}
            placeholder="Add a response message..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => handleRespond('declined')}
          >
            Decline
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleRespond('accepted')}
          >
            Accept
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RequestsPage;
