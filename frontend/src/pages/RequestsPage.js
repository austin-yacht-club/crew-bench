import React, { useState, useEffect, useMemo } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  FormControlLabel,
  Checkbox,
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
  ExpandMore,
  PlaylistAddCheck,
  ExitToApp,
  Search,
  HourglassEmpty,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { crewRequestsAPI } from '../services/api';
import ContactProfileDialog from '../components/ContactProfileDialog';

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
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);

  const filteredReceivedRequests = useMemo(() => {
    let filtered = receivedRequests;
    
    // Filter out past events unless checkbox is checked
    if (!showPastEvents) {
      const now = new Date();
      filtered = filtered.filter(r => r.event?.date && new Date(r.event.date) >= now);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.event?.name?.toLowerCase().includes(query) ||
        r.event?.series?.toLowerCase().includes(query) ||
        r.boat?.name?.toLowerCase().includes(query) ||
        r.boat?.owner?.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [receivedRequests, searchQuery, showPastEvents]);

  const filteredSentRequests = useMemo(() => {
    let filtered = sentRequests;
    
    // Filter out past events unless checkbox is checked
    if (!showPastEvents) {
      const now = new Date();
      filtered = filtered.filter(r => r.event?.date && new Date(r.event.date) >= now);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.event?.name?.toLowerCase().includes(query) ||
        r.event?.series?.toLowerCase().includes(query) ||
        r.boat?.name?.toLowerCase().includes(query) ||
        r.crew?.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [sentRequests, searchQuery, showPastEvents]);

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

  const receivedBySeries = useMemo(() => {
    const grouped = {};
    filteredReceivedRequests.forEach((request) => {
      const series = request.event?.series;
      if (series) {
        if (!grouped[series]) {
          grouped[series] = [];
        }
        grouped[series].push(request);
      }
    });
    return grouped;
  }, [filteredReceivedRequests]);

  const getSeriesPendingCount = (seriesName) => {
    return receivedBySeries[seriesName]?.filter(r => r.status === 'pending').length || 0;
  };

  const handleRespond = async (status) => {
    try {
      if (selectedSeries) {
        const result = await crewRequestsAPI.respondToSeries(selectedSeries, status, responseMessage);
        setSuccess(`${status === 'accepted' ? 'Accepted' : 'Declined'} ${result.data.length} requests for ${selectedSeries}`);
      } else {
        await crewRequestsAPI.respond(selectedRequest.id, status, responseMessage);
      }
      setDialogOpen(false);
      setResponseMessage('');
      setSelectedSeries(null);
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError('Failed to respond to request');
    }
  };

  const handleOpenSeriesDialog = (seriesName) => {
    setSelectedSeries(seriesName);
    setSelectedRequest(null);
    setResponseMessage('');
    setDialogOpen(true);
  };

  const handleOpenRequestDialog = (request) => {
    setSelectedRequest(request);
    setSelectedSeries(null);
    setResponseMessage('');
    setDialogOpen(true);
  };

  const handleOpenWithdrawDialog = (request) => {
    setSelectedRequest(request);
    setWithdrawReason('');
    setWithdrawDialogOpen(true);
  };

  const handleWithdraw = async () => {
    try {
      await crewRequestsAPI.withdraw(selectedRequest.id, withdrawReason);
      setSuccess('Successfully withdrawn from the event');
      setWithdrawDialogOpen(false);
      setWithdrawReason('');
      setSelectedRequest(null);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to withdraw');
    }
  };

  const statusChip = (status, waitlistPosition = null) => {
    if (waitlistPosition !== null && status === 'pending') {
      return (
        <Chip 
          icon={<HourglassEmpty />} 
          label={`Waitlist #${waitlistPosition}`} 
          color="default" 
          size="small" 
          variant="outlined"
        />
      );
    }
    const config = {
      pending: { color: 'warning', icon: <Schedule />, label: 'Pending' },
      accepted: { color: 'success', icon: <CheckCircle />, label: 'Accepted' },
      declined: { color: 'error', icon: <Cancel />, label: 'Declined' },
      withdrawn: { color: 'default', icon: <ExitToApp />, label: 'Withdrawn' },
    };
    const c = config[status] || config.pending;
    return <Chip icon={c.icon} label={c.label} color={c.color} size="small" />;
  };

  const renderRequestCard = (request, isReceived) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {isReceived ? (
            <Typography variant="h6">{request.boat?.name}</Typography>
          ) : (
            <Box
              component="button"
              type="button"
              onClick={() => request.crew?.id && setProfileUserId(request.crew.id)}
              sx={{ display: 'flex', alignItems: 'center', border: 'none', background: 'none', cursor: request.crew?.id ? 'pointer' : 'default', p: 0, textAlign: 'left' }}
            >
              <Avatar
                src={request.crew?.profile_picture || undefined}
                sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}
              >
                {!request.crew?.profile_picture && request.crew?.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h6">{request.crew?.name}</Typography>
            </Box>
          )}
          {statusChip(request.status, request.waitlist_position)}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Event: {request.event?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Date: {request.event?.date && format(new Date(request.event.date), 'MMM d, yyyy')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Boat: {isReceived 
            ? [request.boat?.make, request.boat?.model].filter(Boolean).join(' ') 
            : request.boat?.name}
        </Typography>
        {isReceived && request.boat?.owner && (
          <Typography variant="body2" color="text.secondary">
            Skipper:{' '}
            <Button
              size="small"
              sx={{ p: 0, minWidth: 'auto', textTransform: 'none', verticalAlign: 'baseline' }}
              onClick={() => setProfileUserId(request.boat.owner.id)}
            >
              {request.boat.owner.name}
            </Button>
          </Typography>
        )}
        {request.message && (
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            {isReceived ? `"${request.message}"` : `Your message: "${request.message}"`}
          </Typography>
        )}
        {isReceived && request.status === 'pending' && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={() => handleOpenRequestDialog(request)}
            >
              Accept
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleOpenRequestDialog(request)}
            >
              Decline
            </Button>
          </Box>
        )}
        {request.response_message && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {isReceived ? 'Your response' : 'Their response'}: "{request.response_message}"
          </Typography>
        )}
        
        {request.status === 'accepted' && (
          <>
            {isReceived 
              ? request.boat?.owner && <ContactInfo user={request.boat.owner} label="Skipper" />
              : request.crew && <ContactInfo user={request.crew} label="Crew" />
            }
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<ExitToApp />}
                onClick={() => handleOpenWithdrawDialog(request)}
              >
                Withdraw
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );

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
        Crew Requests
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Manage your crew invitations
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

      <TextField
        fullWidth
        size="small"
        placeholder="Search by event, series, boat, or person..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 1 }}
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={showPastEvents}
            onChange={(e) => setShowPastEvents(e.target.checked)}
          />
        }
        label="Show past events"
        sx={{ mb: 1 }}
      />

      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab icon={<Inbox />} label={`Received (${filteredReceivedRequests.length})`} iconPosition="start" />
        <Tab icon={<Send />} label={`Sent (${filteredSentRequests.length})`} iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <>
          {filteredReceivedRequests.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Inbox sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No requests received'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Mark yourself as available for events to receive crew invitations'}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {Object.keys(receivedBySeries).length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Series Invitations</Typography>
                  {Object.entries(receivedBySeries).map(([seriesName, seriesRequests]) => {
                    const pendingCount = getSeriesPendingCount(seriesName);
                    return (
                      <Accordion key={seriesName} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'flex-start', sm: 'center' }, 
                            gap: { xs: 1, sm: 2 }, 
                            width: '100%' 
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>{seriesName}</Typography>
                              <Chip 
                                label={`${seriesRequests.length} events`} 
                                size="small" 
                                variant="outlined" 
                              />
                              {pendingCount > 0 && (
                                <Chip 
                                  label={`${pendingCount} pending`} 
                                  size="small" 
                                  color="warning" 
                                />
                              )}
                            </Box>
                            {pendingCount > 0 && (
                              <Box sx={{ ml: { sm: 'auto' }, mr: { sm: 2 } }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<PlaylistAddCheck />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSeriesDialog(seriesName);
                                  }}
                                  sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
                                >
                                  Respond to All
                                </Button>
                              </Box>
                            )}
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            {seriesRequests.map((request) => (
                              <Grid item xs={12} md={6} key={request.id}>
                                {renderRequestCard(request, true)}
                              </Grid>
                            ))}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}

              <Typography variant="h6" sx={{ mb: 2 }}>
                {Object.keys(receivedBySeries).length > 0 ? 'Individual Invitations' : 'All Invitations'}
              </Typography>
              <Grid container spacing={3}>
                {(Object.keys(receivedBySeries).length > 0
                  ? filteredReceivedRequests.filter(r => !r.event?.series)
                  : filteredReceivedRequests
                ).map((request) => (
                  <Grid item xs={12} md={6} key={request.id}>
                    {renderRequestCard(request, true)}
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {filteredSentRequests.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Send sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No requests sent'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Find available crew for your events'}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {filteredSentRequests.map((request) => (
                <Grid item xs={12} md={6} key={request.id}>
                  {renderRequestCard(request, false)}
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedSeries 
            ? `Respond to ${selectedSeries} Invitations`
            : 'Respond to Request'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedSeries 
              ? `Respond to all ${getSeriesPendingCount(selectedSeries)} pending invitations for ${selectedSeries}`
              : `Respond to the crew invitation from ${selectedRequest?.boat?.name}`}
          </Typography>
          {selectedSeries && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This will {' '}
              <strong>accept</strong> or <strong>decline</strong> all pending requests for this series at once.
            </Alert>
          )}
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
            {selectedSeries ? 'Decline All' : 'Decline'}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleRespond('accepted')}
          >
            {selectedSeries ? 'Accept All' : 'Accept'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Withdraw from Event</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to withdraw from this event? This will cancel your confirmed crew position.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Event:</strong> {selectedRequest?.event?.name}<br />
            <strong>Date:</strong> {selectedRequest?.event?.date && format(new Date(selectedRequest.event.date), 'MMMM d, yyyy')}<br />
            <strong>Boat:</strong> {selectedRequest?.boat?.name}
          </Typography>
          <TextField
            fullWidth
            label="Reason for withdrawal (optional)"
            multiline
            rows={3}
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            placeholder="Let them know why you're withdrawing..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleWithdraw}
          >
            Confirm Withdrawal
          </Button>
        </DialogActions>
      </Dialog>

      <ContactProfileDialog
        open={Boolean(profileUserId)}
        onClose={() => setProfileUserId(null)}
        userId={profileUserId}
      />
    </Box>
  );
};

export default RequestsPage;
