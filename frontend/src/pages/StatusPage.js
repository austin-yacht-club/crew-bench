import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  AvatarGroup,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Event as EventIcon,
  DirectionsBoat,
  People,
  CheckCircle,
  Schedule,
  ExitToApp,
  Close,
} from '@mui/icons-material';
import { format, isFuture, isPast } from 'date-fns';
import { crewRequestsAPI, boatsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';

const StatusPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [myBoats, setMyBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [receivedRes, sentRes, boatsRes] = await Promise.all([
        crewRequestsAPI.getReceived(),
        crewRequestsAPI.getSent(),
        boatsAPI.listMy(),
      ]);
      setReceivedRequests(receivedRes.data);
      setSentRequests(sentRes.data);
      setMyBoats(boatsRes.data);
    } catch (err) {
      setError('Failed to load status data');
    } finally {
      setLoading(false);
    }
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
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to withdraw');
    }
  };

  const findRequestForCrewEvent = (eventId, boatId) => {
    return receivedRequests.find(
      r => r.event?.id === eventId && r.boat?.id === boatId && r.status === 'accepted'
    );
  };

  const findRequestForSkipperEvent = (eventId, crewId) => {
    return sentRequests.find(
      r => r.event?.id === eventId && r.crew?.id === crewId && r.status === 'accepted'
    );
  };

  const acceptedReceivedRequests = receivedRequests.filter(r => r.status === 'accepted');
  const acceptedSentRequests = sentRequests.filter(r => r.status === 'accepted');

  const groupByEvent = (requests) => {
    const grouped = {};
    requests.forEach(request => {
      const eventId = request.event?.id;
      if (!eventId) return;
      
      if (!grouped[eventId]) {
        grouped[eventId] = {
          event: request.event,
          requests: [],
        };
      }
      grouped[eventId].requests.push(request);
    });
    
    return Object.values(grouped).sort((a, b) => 
      new Date(a.event.date) - new Date(b.event.date)
    );
  };

  const groupByBoatAndEvent = (requests) => {
    const grouped = {};
    requests.forEach(request => {
      const boatId = request.boat?.id;
      const eventId = request.event?.id;
      if (!boatId || !eventId) return;
      
      const key = `${boatId}-${eventId}`;
      if (!grouped[key]) {
        grouped[key] = {
          boat: request.boat,
          event: request.event,
          crew: [],
        };
      }
      grouped[key].crew.push(request.crew);
    });
    
    return Object.values(grouped).sort((a, b) => 
      new Date(a.event.date) - new Date(b.event.date)
    );
  };

  const crewSchedule = groupByEvent(acceptedReceivedRequests);
  const skipperSchedule = groupByBoatAndEvent(acceptedSentRequests);

  const isUpcoming = (date) => isFuture(new Date(date));
  const isPastEvent = (date) => isPast(new Date(date));

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
        My Schedule
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        View your confirmed sailing assignments
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'success.50' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {acceptedReceivedRequests.length + acceptedSentRequests.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Confirmed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DirectionsBoat sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color="primary.main">
                {crewSchedule.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Events as Crew
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <People sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h4" color="secondary.main">
                {skipperSchedule.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Events as Skipper
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab 
          icon={<DirectionsBoat />} 
          label={`As Crew (${crewSchedule.length})`}
          iconPosition="start"
        />
        <Tab 
          icon={<People />} 
          label={`As Skipper (${skipperSchedule.length})`}
          disabled={myBoats.length === 0}
          iconPosition="start"
        />
      </Tabs>

      {tab === 0 && (
        <>
          {crewSchedule.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <DirectionsBoat sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">No confirmed crew positions</Typography>
                <Typography variant="body2" color="text.secondary">
                  Mark yourself as available for events and accept crew requests
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {crewSchedule.map(({ event, requests }) => (
                <Grid item xs={12} md={6} key={event.id}>
                  <Card sx={{ 
                    borderLeft: 4, 
                    borderColor: isUpcoming(event.date) ? 'success.main' : 'grey.400',
                    opacity: isPastEvent(event.date) ? 0.7 : 1,
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6">{event.name}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {format(new Date(event.date), 'EEEE, MMMM d, yyyy')}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip 
                          icon={isUpcoming(event.date) ? <Schedule /> : <CheckCircle />}
                          label={isUpcoming(event.date) ? 'Upcoming' : 'Past'}
                          size="small"
                          color={isUpcoming(event.date) ? 'success' : 'default'}
                        />
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      {requests.map(request => (
                        <Box key={request.id} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DirectionsBoat sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="body1" fontWeight={500}>
                              {request.boat?.name}
                            </Typography>
                            {request.boat?.sail_number && (
                              <Chip label={request.boat.sail_number} size="small" variant="outlined" />
                            )}
                            {isUpcoming(event.date) && (
                              <Tooltip title="Withdraw from this event">
                                <IconButton 
                                  size="small" 
                                  color="warning"
                                  onClick={() => handleOpenWithdrawDialog(request)}
                                  sx={{ ml: 'auto' }}
                                >
                                  <ExitToApp fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ ml: 3.5 }}>
                            {[request.boat?.make, request.boat?.model].filter(Boolean).join(' ')}
                            {request.boat?.owner && ` • Skipper: ${request.boat.owner.name}`}
                          </Typography>
                        </Box>
                      ))}
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
          {skipperSchedule.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">No confirmed crew for your boats</Typography>
                <Typography variant="body2" color="text.secondary">
                  Browse available crew and send requests for your events
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {skipperSchedule.map(({ boat, event, crew }) => (
                <Grid item xs={12} md={6} key={`${boat.id}-${event.id}`}>
                  <Card sx={{ 
                    borderLeft: 4, 
                    borderColor: isUpcoming(event.date) ? 'success.main' : 'grey.400',
                    opacity: isPastEvent(event.date) ? 0.7 : 1,
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6">{event.name}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {format(new Date(event.date), 'EEEE, MMMM d, yyyy')}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip 
                          icon={isUpcoming(event.date) ? <Schedule /> : <CheckCircle />}
                          label={isUpcoming(event.date) ? 'Upcoming' : 'Past'}
                          size="small"
                          color={isUpcoming(event.date) ? 'success' : 'default'}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <DirectionsBoat sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body1" fontWeight={500}>
                          {boat.name}
                        </Typography>
                        {boat.sail_number && (
                          <Chip label={boat.sail_number} size="small" variant="outlined" />
                        )}
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Confirmed Crew ({crew.length}{boat.crew_needed ? ` / ${boat.crew_needed} needed` : ''})
                          </Typography>
                          <AvatarGroup max={5} sx={{ justifyContent: 'flex-start' }}>
                            {crew.map(member => (
                              <Tooltip key={member.id} title={member.name}>
                                <Avatar 
                                  src={member.profile_picture || undefined}
                                  sx={{ width: 36, height: 36 }}
                                >
                                  {!member.profile_picture && member.name?.charAt(0).toUpperCase()}
                                </Avatar>
                              </Tooltip>
                            ))}
                          </AvatarGroup>
                        </Box>
                        {boat.crew_needed && crew.length < boat.crew_needed && (
                          <Chip 
                            label={`Need ${boat.crew_needed - crew.length} more`}
                            color="warning"
                            size="small"
                          />
                        )}
                        {boat.crew_needed && crew.length >= boat.crew_needed && (
                          <Chip 
                            label="Crew Complete"
                            color="success"
                            size="small"
                            icon={<CheckCircle />}
                          />
                        )}
                      </Box>
                      
                      <Box sx={{ mt: 2 }}>
                        {crew.map(member => {
                          const request = findRequestForSkipperEvent(event.id, member.id);
                          return (
                            <Box key={member.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Avatar 
                                src={member.profile_picture || undefined}
                                sx={{ width: 24, height: 24, fontSize: 12 }}
                              >
                                {!member.profile_picture && member.name?.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2">{member.name}</Typography>
                              <Chip 
                                label={member.experience_level || 'beginner'} 
                                size="small" 
                                variant="outlined"
                                sx={{ height: 20, fontSize: 11 }}
                              />
                              {member.weight && (
                                <Typography variant="caption" color="text.secondary">
                                  {member.weight} lbs
                                </Typography>
                              )}
                              {isUpcoming(event.date) && request && (
                                <Tooltip title={`Release ${member.name} from this event`}>
                                  <IconButton 
                                    size="small" 
                                    color="warning"
                                    onClick={() => handleOpenWithdrawDialog(request)}
                                    sx={{ ml: 'auto' }}
                                  >
                                    <Close fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Withdraw from Event</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to withdraw? This will cancel the confirmed crew position.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Event:</strong> {selectedRequest?.event?.name}<br />
            <strong>Date:</strong> {selectedRequest?.event?.date && format(new Date(selectedRequest.event.date), 'MMMM d, yyyy')}<br />
            <strong>Boat:</strong> {selectedRequest?.boat?.name}<br />
            <strong>Crew:</strong> {selectedRequest?.crew?.name}
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
    </Box>
  );
};

export default StatusPage;
