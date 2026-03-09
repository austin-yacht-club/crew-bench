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
  Divider,
} from '@mui/material';
import { 
  Inbox, 
  Send, 
  CheckCircle, 
  Cancel, 
  Schedule,
  Email,
  Phone,
  Sms,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { crewRequestsAPI } from '../services/api';

const ContactInfo = ({ user, label }) => {
  if (!user) return null;

  const contactMethods = [];
  
  if (user.allow_email_contact && user.email) {
    contactMethods.push({
      type: 'email',
      icon: <Email sx={{ fontSize: 16 }} />,
      value: user.email,
      href: `mailto:${user.email}`,
      preferred: user.contact_preference === 'email',
    });
  }
  
  if (user.allow_phone_contact && user.phone) {
    contactMethods.push({
      type: 'phone',
      icon: <Phone sx={{ fontSize: 16 }} />,
      value: user.phone,
      href: `tel:${user.phone}`,
      preferred: user.contact_preference === 'phone',
    });
  }
  
  if (user.allow_sms_contact && user.phone) {
    contactMethods.push({
      type: 'sms',
      icon: <Sms sx={{ fontSize: 16 }} />,
      value: user.phone,
      href: `sms:${user.phone}`,
      preferred: user.contact_preference === 'sms',
    });
  }

  if (contactMethods.length === 0) {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label} has not shared contact information
        </Typography>
      </Box>
    );
  }

  const preferredMethod = contactMethods.find(m => m.preferred) || contactMethods[0];

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
      <Typography variant="subtitle2" color="success.dark" sx={{ mb: 1 }}>
        Contact {label}
      </Typography>
      {contactMethods.map((method, index) => (
        <Box 
          key={method.type + index}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 0.5,
          }}
        >
          {method.icon}
          <Typography 
            component="a" 
            href={method.href}
            variant="body2"
            sx={{ 
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {method.value}
          </Typography>
          {method.preferred && (
            <Chip label="Preferred" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
          )}
          <Chip 
            label={method.type === 'sms' ? 'SMS' : method.type.charAt(0).toUpperCase() + method.type.slice(1)} 
            size="small" 
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        </Box>
      ))}
    </Box>
  );
};

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
                      {request.boat?.owner && (
                        <Typography variant="body2" color="text.secondary">
                          Skipper: {request.boat.owner.name}
                        </Typography>
                      )}
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
                      
                      {request.status === 'accepted' && request.boat?.owner && (
                        <ContactInfo user={request.boat.owner} label="Skipper" />
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
                          <Avatar 
                            src={request.crew?.profile_picture || undefined}
                            sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}
                          >
                            {!request.crew?.profile_picture && request.crew?.name?.charAt(0).toUpperCase()}
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
                      
                      {request.status === 'accepted' && request.crew && (
                        <ContactInfo user={request.crew} label="Crew" />
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
