import React, { useState, useEffect, useMemo } from 'react';
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
  InputAdornment,
} from '@mui/material';
import {
  Event as EventIcon,
  DirectionsBoat,
  People,
  CheckCircle,
  Schedule,
  ExitToApp,
  Close,
  Search,
  Sailing,
} from '@mui/icons-material';
import { format, isFuture, isPast } from 'date-fns';
import { crewRequestsAPI, boatsAPI, skipperCommitmentsAPI, boatRatingsAPI, crewRatingsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';
import StarRating from '../components/StarRating';

const StatusPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [myBoats, setMyBoats] = useState([]);
  const [skipperCommitments, setSkipperCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedCommitment, setSelectedCommitment] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [boatRatingSummaries, setBoatRatingSummaries] = useState({});
  const [crewRatingSummaries, setCrewRatingSummaries] = useState({});
  const [rateBoatDialogOpen, setRateBoatDialogOpen] = useState(false);
  const [rateCrewDialogOpen, setRateCrewDialogOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const acceptedReceived = receivedRequests.filter(r => r.status === 'accepted');
    const acceptedSent = sentRequests.filter(r => r.status === 'accepted');
    const boatIds = [...new Set(acceptedReceived.map(r => r.boat?.id).filter(Boolean))];
    const crewIds = [...new Set(acceptedSent.map(r => r.crew?.id).filter(Boolean))];
    if (boatIds.length > 0 && (user?.role === 'crew' || user?.role === 'skipper' || user?.is_admin)) {
      boatRatingsAPI.getSummaries(boatIds).then(res => {
        const byId = {};
        res.data.forEach(s => { byId[s.boat_id] = s; });
        setBoatRatingSummaries(byId);
      }).catch(() => setBoatRatingSummaries({}));
    } else {
      setBoatRatingSummaries({});
    }
    if (crewIds.length > 0 && (user?.role === 'skipper' || user?.is_admin)) {
      crewRatingsAPI.getSummaries(crewIds).then(res => {
        const byId = {};
        res.data.forEach(s => { byId[s.crew_id] = s; });
        setCrewRatingSummaries(byId);
      }).catch(() => setCrewRatingSummaries({}));
    } else {
      setCrewRatingSummaries({});
    }
  }, [receivedRequests, sentRequests, user?.role, user?.is_admin]);

  const loadData = async () => {
    try {
      const [receivedRes, sentRes, boatsRes, commitmentsRes] = await Promise.all([
        crewRequestsAPI.getReceived(),
        crewRequestsAPI.getSent(),
        boatsAPI.listMy(),
        skipperCommitmentsAPI.getMy(),
      ]);
      setReceivedRequests(receivedRes.data);
      setSentRequests(sentRes.data);
      setMyBoats(boatsRes.data);
      setSkipperCommitments(commitmentsRes.data);
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
      if (selectedCommitment) {
        await skipperCommitmentsAPI.cancel(selectedCommitment.id);
        setSuccess('Skipper commitment cancelled');
        setSelectedCommitment(null);
      } else {
        await crewRequestsAPI.withdraw(selectedRequest.id, withdrawReason);
        setSuccess('Successfully withdrawn from the event');
        setSelectedRequest(null);
      }
      setWithdrawDialogOpen(false);
      setWithdrawReason('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to withdraw');
    }
  };

  const handleOpenCancelCommitment = (commitment) => {
    setSelectedCommitment(commitment);
    setSelectedRequest(null);
    setWithdrawReason('');
    setWithdrawDialogOpen(true);
  };

  const handleOpenRateBoat = (request) => {
    setRateTarget({ type: 'boat', boat: request.boat, event: request.event, request });
    setRatingValue(0);
    setRatingComment('');
    setRateBoatDialogOpen(true);
  };

  const handleOpenRateCrew = (item) => {
    setRateTarget({ type: 'crew', boat: item.boat, event: item.event, crew: item.crew });
    setRatingValue(0);
    setRatingComment('');
    setRateCrewDialogOpen(true);
  };

  const handleSubmitBoatRating = async () => {
    if (!rateTarget?.boat?.id || ratingValue < 1) return;
    try {
      await boatRatingsAPI.create({
        boat_id: rateTarget.boat.id,
        event_id: rateTarget.event?.id || null,
        rating: ratingValue,
        comment: ratingComment || null,
      });
      setSuccess('Thanks for rating this boat!');
      setRateBoatDialogOpen(false);
      setRateTarget(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit rating');
    }
  };

  const handleSubmitCrewRating = async () => {
    if (!rateTarget?.boat?.id || !rateTarget?.crew?.id || ratingValue < 1) return;
    try {
      await crewRatingsAPI.create({
        crew_id: rateTarget.crew.id,
        boat_id: rateTarget.boat.id,
        event_id: rateTarget.event?.id || null,
        rating: ratingValue,
        comment: ratingComment || null,
      });
      setSuccess('Rating submitted.');
      setRateCrewDialogOpen(false);
      setRateTarget(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit rating');
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

  const filteredReceivedRequests = useMemo(() => {
    const accepted = receivedRequests.filter(r => r.status === 'accepted');
    if (!searchQuery.trim()) return accepted;
    const query = searchQuery.toLowerCase();
    return accepted.filter(r =>
      r.event?.name?.toLowerCase().includes(query) ||
      r.event?.series?.toLowerCase().includes(query) ||
      r.boat?.name?.toLowerCase().includes(query) ||
      r.boat?.owner?.name?.toLowerCase().includes(query)
    );
  }, [receivedRequests, searchQuery]);

  const filteredSentRequests = useMemo(() => {
    const accepted = sentRequests.filter(r => r.status === 'accepted');
    if (!searchQuery.trim()) return accepted;
    const query = searchQuery.toLowerCase();
    return accepted.filter(r =>
      r.event?.name?.toLowerCase().includes(query) ||
      r.event?.series?.toLowerCase().includes(query) ||
      r.boat?.name?.toLowerCase().includes(query) ||
      r.crew?.name?.toLowerCase().includes(query)
    );
  }, [sentRequests, searchQuery]);

  const acceptedReceivedRequests = receivedRequests.filter(r => r.status === 'accepted');
  const acceptedSentRequests = sentRequests.filter(r => r.status === 'accepted');

  const filteredSkipperCommitments = useMemo(() => {
    if (!searchQuery.trim()) return skipperCommitments;
    const query = searchQuery.toLowerCase();
    return skipperCommitments.filter(c =>
      c.event?.name?.toLowerCase().includes(query) ||
      c.event?.series?.toLowerCase().includes(query) ||
      c.boat?.name?.toLowerCase().includes(query)
    );
  }, [skipperCommitments, searchQuery]);

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

  const crewSchedule = groupByEvent(filteredReceivedRequests);
  const skipperSchedule = groupByBoatAndEvent(filteredSentRequests);

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
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: 'success.50' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: { xs: 32, sm: 40 }, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" color="success.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                {acceptedReceivedRequests.length + acceptedSentRequests.length + skipperCommitments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Events
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DirectionsBoat sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color="primary.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                {crewSchedule.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                As Crew
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Sailing sx={{ fontSize: { xs: 32, sm: 40 }, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" color="info.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                {skipperCommitments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sailing Own Boat
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <People sx={{ fontSize: { xs: 32, sm: 40 }, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h4" color="secondary.main" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                {skipperSchedule.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                With Crew
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by event, series, boat, or crew..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

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
          icon={<Sailing />} 
          label={`Sailing My Boat (${filteredSkipperCommitments.length})`}
          disabled={myBoats.length === 0}
          iconPosition="start"
        />
        <Tab 
          icon={<People />} 
          label={`My Crew (${skipperSchedule.length})`}
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
                <Typography variant="h6">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No confirmed crew positions'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Mark yourself as available for events and accept crew requests'}
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <DirectionsBoat sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="body1" fontWeight={500}>
                              {request.boat?.name}
                            </Typography>
                            {request.boat?.sail_number && (
                              <Chip label={request.boat.sail_number} size="small" variant="outlined" />
                            )}
                            {request.boat?.id && boatRatingSummaries[request.boat.id]?.count > 0 && (
                              <StarRating
                                value={boatRatingSummaries[request.boat.id].average_rating}
                                count={boatRatingSummaries[request.boat.id].count}
                                size="small"
                                displayOnly
                              />
                            )}
                            {isPastEvent(event.date) && (
                              <Tooltip title="Rate this boat">
                                <Button size="small" variant="outlined" onClick={() => handleOpenRateBoat(request)}>
                                  Rate boat
                                </Button>
                              </Tooltip>
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
          {filteredSkipperCommitments.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Sailing sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No events where you\'re sailing your own boat'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Mark yourself available for events with your own boat to add them here'}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {filteredSkipperCommitments
                .sort((a, b) => new Date(a.event?.date) - new Date(b.event?.date))
                .map((commitment) => (
                <Grid item xs={12} md={6} key={commitment.id}>
                  <Card sx={{ 
                    borderLeft: 4, 
                    borderColor: isUpcoming(commitment.event?.date) ? 'primary.main' : 'grey.400',
                    opacity: isPastEvent(commitment.event?.date) ? 0.7 : 1,
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {commitment.event?.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <EventIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {commitment.event?.date && format(new Date(commitment.event.date), 'EEEE, MMMM d, yyyy')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DirectionsBoat fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {commitment.boat?.name}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label="Skipper" 
                            color="primary" 
                            size="small" 
                            icon={<Sailing />}
                          />
                          {isUpcoming(commitment.event?.date) && (
                            <Tooltip title="Cancel commitment">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleOpenCancelCommitment(commitment)}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                      {commitment.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Note: {commitment.notes}
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

      {tab === 2 && (
        <>
          {skipperSchedule.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6">
                  {searchQuery ? `No results for "${searchQuery}"` : 'No confirmed crew for your boats'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try a different search term' : 'Browse available crew and send requests for your events'}
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
                              {crewRatingSummaries[member.id]?.count > 0 && (
                                <StarRating
                                  value={crewRatingSummaries[member.id].average_rating}
                                  count={crewRatingSummaries[member.id].count}
                                  size="small"
                                  displayOnly
                                />
                              )}
                              {member.weight && (
                                <Typography variant="caption" color="text.secondary">
                                  {member.weight} lbs
                                </Typography>
                              )}
                              {isPastEvent(event.date) && (
                                <Button size="small" variant="outlined" onClick={() => handleOpenRateCrew({ boat, event, crew: member })} sx={{ ml: 'auto' }}>
                                  Rate
                                </Button>
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

      <Dialog open={rateBoatDialogOpen} onClose={() => setRateBoatDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rate this boat</DialogTitle>
        <DialogContent>
          {rateTarget?.boat && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {rateTarget.boat.name}
                {rateTarget.event && ` • ${rateTarget.event.name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Your rating (1–5 stars)</Typography>
              <StarRating value={ratingValue} displayOnly={false} onChange={setRatingValue} size="medium" />
              <TextField
                fullWidth
                label="Comment (optional)"
                multiline
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateBoatDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitBoatRating} disabled={ratingValue < 1}>
            Submit Rating
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rateCrewDialogOpen} onClose={() => setRateCrewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rate crew member</DialogTitle>
        <DialogContent>
          {rateTarget?.crew && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {rateTarget.crew.name}
                {rateTarget.boat && ` • ${rateTarget.boat.name}`}
                {rateTarget.event && ` • ${rateTarget.event.name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Your rating (1–5 stars)</Typography>
              <StarRating value={ratingValue} displayOnly={false} onChange={setRatingValue} size="medium" />
              <TextField
                fullWidth
                label="Comment (optional)"
                multiline
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateCrewDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitCrewRating} disabled={ratingValue < 1}>
            Submit Rating
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedCommitment ? 'Cancel Skipper Commitment' : 'Withdraw from Event'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {selectedCommitment 
              ? 'Are you sure you want to cancel? You will no longer be listed as sailing your own boat for this event.'
              : 'Are you sure you want to withdraw? This will cancel the confirmed crew position.'
            }
          </Alert>
          {selectedCommitment ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Event:</strong> {selectedCommitment?.event?.name}<br />
              <strong>Date:</strong> {selectedCommitment?.event?.date && format(new Date(selectedCommitment.event.date), 'MMMM d, yyyy')}<br />
              <strong>Boat:</strong> {selectedCommitment?.boat?.name}
            </Typography>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleWithdraw}
          >
            {selectedCommitment ? 'Confirm Cancellation' : 'Confirm Withdrawal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatusPage;
