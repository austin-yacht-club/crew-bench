import React, { useState, useEffect, useMemo } from 'react';
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
  Checkbox,
  Autocomplete,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Event as EventIcon,
  LocationOn,
  CheckCircle,
  OpenInNew,
  DirectionsBoat,
  Flag,
  PlaylistAddCheck,
  ExpandMore,
  Search,
  CalendarMonth,
  ChevronLeft,
  ChevronRight,
  Sailing,
  Star,
  StarBorder,
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import { eventsAPI, availabilityAPI, boatsAPI, fleetsAPI, seriesAPI, skipperCommitmentsAPI, favoriteBoatsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';

const EventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [myAvailability, setMyAvailability] = useState([]);
  const [boats, setBoats] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [availabilityType, setAvailabilityType] = useState('any');
  const [selectedBoats, setSelectedBoats] = useState([]);
  const [selectedFleets, setSelectedFleets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewTab, setViewTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [skipperCommitments, setSkipperCommitments] = useState([]);
  const [favoriteBoats, setFavoriteBoats] = useState([]);
  const [favoriteBoatIds, setFavoriteBoatIds] = useState(new Set());

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Filter out past events unless checkbox is checked
    if (!showPastEvents) {
      const now = new Date();
      filtered = filtered.filter(event => new Date(event.date) >= now);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.name?.toLowerCase().includes(query) ||
        event.series?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.event_type?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [events, searchQuery, showPastEvents]);

  useEffect(() => {
    loadData();
  }, [user]);

  const toggleFavoriteBoat = async (boat, e) => {
    if (e) e.stopPropagation();
    const id = boat.id;
    const isFav = favoriteBoatIds.has(id);
    try {
      if (isFav) {
        await favoriteBoatsAPI.remove(id);
        setFavoriteBoats((prev) => prev.filter((b) => b.id !== id));
        setFavoriteBoatIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await favoriteBoatsAPI.add(id);
        setFavoriteBoats((prev) => [...prev.filter((b) => b.id !== id), boat]);
        setFavoriteBoatIds((prev) => new Set([...prev, id]));
      }
    } catch (_) {}
  };

  const addFavoriteBoatsToSelection = () => {
    const combined = [...selectedBoats];
    favoriteBoats.forEach((b) => {
      if (!combined.some((x) => x.id === b.id)) combined.push(b);
    });
    setSelectedBoats(combined);
  };

  const loadData = async () => {
    try {
      const [eventsRes, boatsRes, fleetsRes, seriesRes] = await Promise.all([
        eventsAPI.list(true),
        boatsAPI.list(),
        fleetsAPI.list(),
        seriesAPI.list(true),
      ]);
      setEvents(eventsRes.data);
      setBoats(boatsRes.data);
      setFleets(fleetsRes.data);
      setSeriesList(seriesRes.data);

      if (user) {
        const [availRes, commitmentsRes, favRes] = await Promise.all([
          availabilityAPI.getMy(),
          skipperCommitmentsAPI.getMy(),
          favoriteBoatsAPI.list().catch(() => ({ data: [] })),
        ]);
        setMyAvailability(availRes.data);
        setSkipperCommitments(commitmentsRes.data);
        setFavoriteBoats(favRes.data || []);
        setFavoriteBoatIds(new Set((favRes.data || []).map((b) => b.id)));
      }
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const eventsBySeries = useMemo(() => {
    const grouped = {};
    filteredEvents.forEach((event) => {
      const key = event.series || 'Other Events';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarMonth]);

  const eventsByDay = useMemo(() => {
    const map = {};
    filteredEvents.forEach((event) => {
      const d = new Date(event.date);
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [filteredEvents]);

  const isSeriesFullyAvailable = (seriesName) => {
    const seriesEvents = events.filter((e) => e.series === seriesName);
    return seriesEvents.every((e) => isAvailableFor(e.id));
  };

  const isAvailableFor = (eventId) => {
    return myAvailability.some((a) => a.event_id === eventId);
  };

  const hasSkipperCommitmentForEvent = (eventId) => {
    return skipperCommitments.some((c) => c.event_id === eventId);
  };

  const isAvailableOrSkipperForEvent = (eventId) => {
    return isAvailableFor(eventId) || hasSkipperCommitmentForEvent(eventId);
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
    setSelectedSeries(null);
    setAvailabilityNotes('');
    setAvailabilityType('any');
    setSelectedBoats([]);
    setSelectedFleets([]);
    setDialogOpen(true);
  };

  const handleOpenSeriesDialog = (seriesName) => {
    setSelectedEvent(null);
    setSelectedSeries(seriesName);
    setAvailabilityNotes('');
    setAvailabilityType('any');
    setSelectedBoats([]);
    setSelectedFleets([]);
    setDialogOpen(true);
  };

  const handleMarkAvailable = async () => {
    try {
      const myBoatIds = boats.filter(b => b.owner_id === user?.id).map(b => b.id);
      
      if (availabilityType === 'boats' && selectedBoats.length > 0) {
        const ownBoats = selectedBoats.filter(b => myBoatIds.includes(b.id));
        const otherBoats = selectedBoats.filter(b => !myBoatIds.includes(b.id));
        
        const results = [];
        
        if (ownBoats.length > 0) {
          for (const boat of ownBoats) {
            if (selectedSeries) {
              await skipperCommitmentsAPI.createForSeries({
                boat_id: boat.id,
                series: selectedSeries,
                notes: availabilityNotes || null,
              });
            } else {
              await skipperCommitmentsAPI.create({
                boat_id: boat.id,
                event_id: selectedEvent.id,
                notes: availabilityNotes || null,
              });
            }
          }
          results.push(`Committed to sail ${ownBoats.length} of your own boat(s)`);
        }
        
        if (otherBoats.length > 0) {
          const baseData = {
            availability_type: 'boats',
            notes: availabilityNotes || null,
            boat_ids: otherBoats.map(b => b.id),
          };
          
          if (selectedSeries) {
            await availabilityAPI.markSeriesAvailable({
              ...baseData,
              series: selectedSeries,
            });
          } else {
            await availabilityAPI.markAvailable({
              ...baseData,
              event_id: selectedEvent.id,
            });
          }
          results.push(`Marked available as crew for ${otherBoats.length} other boat(s)`);
        }
        
        setSuccess(results.join(' and '));
      } else {
        const baseData = {
          availability_type: availabilityType,
          notes: availabilityNotes || null,
        };

        if (availabilityType === 'fleets' && selectedFleets.length > 0) {
          baseData.fleet_ids = selectedFleets.map(f => f.id);
        }

        if (selectedSeries) {
          const result = await availabilityAPI.markSeriesAvailable({
            ...baseData,
            series: selectedSeries,
          });
          setSuccess(`Marked available for ${result.data.length} events in ${selectedSeries}`);
        } else {
          await availabilityAPI.markAvailable({
            ...baseData,
            event_id: selectedEvent.id,
          });
          setSuccess('Marked as available');
        }
      }

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

  const renderEventCard = (event) => {
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
              ) : hasSkipperCommitmentForEvent(event.id) ? (
                <Button
                  size="small"
                  color="info"
                  variant="outlined"
                  startIcon={<Sailing />}
                  disabled
                >
                  Sailing my boat
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
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
        Upcoming Events
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Browse upcoming sailing events and mark your availability
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
        <>
          <TextField
            fullWidth
            size="small"
            placeholder="Search events by name, series, location..."
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
            value={viewTab} 
            onChange={(_, v) => setViewTab(v)} 
            sx={{ mb: 3 }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label={`All Events${searchQuery ? ` (${filteredEvents.length})` : ''}`} />
            <Tab label="By Series" />
            <Tab icon={<CalendarMonth />} label="Calendar" iconPosition="start" />
          </Tabs>

          {viewTab === 0 && (
            <Grid container spacing={3}>
              {filteredEvents.length === 0 ? (
                <Grid item xs={12}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">
                        No events match "{searchQuery}"
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                filteredEvents.map(renderEventCard)
              )}
            </Grid>
          )}

          {viewTab === 1 && (
            <Box>
              {Object.entries(eventsBySeries).map(([seriesName, seriesEvents]) => {
                const availableCount = seriesEvents.filter(e => isAvailableFor(e.id)).length;
                const firstEventDate = seriesEvents[0]?.date;
                const lastEventDate = seriesEvents[seriesEvents.length - 1]?.date;
                
                return (
                  <Accordion 
                    key={seriesName} 
                    sx={{ 
                      mb: 1,
                      '&:before': { display: 'none' },
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    <AccordionSummary 
                      expandIcon={<ExpandMore />}
                      sx={{ 
                        '& .MuiAccordionSummary-content': { 
                          flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          gap: { xs: 1, sm: 2 },
                          my: 1,
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.125rem' }, fontWeight: 600 }}>
                          {seriesName}
                        </Typography>
                        <Chip
                          label={`${seriesEvents.length} events`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                        {availableCount > 0 && (
                          <Chip
                            icon={<CheckCircle sx={{ fontSize: 14 }} />}
                            label={availableCount === seriesEvents.length 
                              ? 'Available for all' 
                              : `${availableCount}/${seriesEvents.length} available`}
                            size="small"
                            color="success"
                            variant={availableCount === seriesEvents.length ? 'filled' : 'outlined'}
                            sx={{ height: 24 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {firstEventDate && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {format(new Date(firstEventDate), 'MMM d')}
                            {lastEventDate && firstEventDate !== lastEventDate && (
                              <> - {format(new Date(lastEventDate), 'MMM d, yyyy')}</>
                            )}
                          </Typography>
                        )}
                        {user && seriesName !== 'Other Events' && !isSeriesFullyAvailable(seriesName) && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PlaylistAddCheck />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSeriesDialog(seriesName);
                            }}
                            sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.75rem' },
                              py: 0.5,
                              px: 1,
                              minWidth: 'auto',
                            }}
                          >
                            Mark All
                          </Button>
                        )}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                      <Grid container spacing={2}>
                        {seriesEvents.map(renderEventCard)}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}

          {viewTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  {format(calendarMonth, 'MMMM yyyy')}
                </Typography>
                <Box>
                  <IconButton size="small" onClick={() => setCalendarMonth((m) => subMonths(m, 1))} aria-label="Previous month">
                    <ChevronLeft />
                  </IconButton>
                  <Button size="small" onClick={() => setCalendarMonth(startOfMonth(new Date()))}>
                    Today
                  </Button>
                  <IconButton size="small" onClick={() => setCalendarMonth((m) => addMonths(m, 1))} aria-label="Next month">
                    <ChevronRight />
                  </IconButton>
                </Box>
              </Box>
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Box key={day} sx={{ py: 1, textAlign: 'center', borderRight: 1, borderColor: 'divider', '&:last-of-type': { borderRight: 0 } }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {day}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                  }}
                >
                  {calendarDays.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay[dayKey] || [];
                    const inMonth = isSameMonth(day, calendarMonth);
                    return (
                      <Box
                        key={dayKey}
                        sx={{
                          minHeight: { xs: 80, sm: 100 },
                          p: 0.5,
                          borderRight: 1,
                          borderBottom: 1,
                          borderColor: 'divider',
                          bgcolor: inMonth ? 'background.paper' : 'action.hover',
                          '&:nth-of-type(7n)': { borderRight: 0 },
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isToday(day) ? 700 : 400,
                            color: isToday(day) ? 'primary.main' : inMonth ? 'text.primary' : 'text.disabled',
                            mb: 0.5,
                          }}
                        >
                          {format(day, 'd')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {dayEvents.map((event) => {
                            const available = isAvailableOrSkipperForEvent(event.id);
                            const isSkipper = hasSkipperCommitmentForEvent(event.id);
                            return (
                              <Button
                                key={event.id}
                                size="small"
                                fullWidth
                                disableElevation
                                variant="text"
                                onClick={() => !isSkipper && handleOpenDialog(event)}
                                sx={{
                                  justifyContent: 'flex-start',
                                  textAlign: 'left',
                                  textTransform: 'none',
                                  fontSize: '0.7rem',
                                  py: 0.25,
                                  px: 0.5,
                                  minHeight: 'auto',
                                  bgcolor: available ? (isSkipper ? 'info.light' : 'success.light') : 'grey.200',
                                  color: available ? (isSkipper ? 'info.dark' : 'success.dark') : 'text.secondary',
                                  '&:hover': {
                                    bgcolor: available ? (isSkipper ? 'info.main' : 'success.main') : 'grey.300',
                                    color: 'white',
                                  },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                  {isSkipper ? <Sailing sx={{ fontSize: 12 }} /> : available ? <CheckCircle sx={{ fontSize: 12 }} /> : null}
                                  <Typography noWrap variant="caption" component="span">
                                    {event.name}
                                  </Typography>
                                </Box>
                              </Button>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'success.light' }} />
                  <Typography variant="caption">Available (crew)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'info.light' }} />
                  <Typography variant="caption">Sailing my boat</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'grey.200' }} />
                  <Typography variant="caption">Not marked</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedSeries ? `Mark Availability for ${selectedSeries}` : 'Mark Availability'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {selectedSeries 
              ? `Mark yourself available for all ${events.filter(e => e.series === selectedSeries).length} events in this series`
              : `Let skippers know you're available for ${selectedEvent?.name}`
            }
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
            <>
              {favoriteBoats.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Quick add from your favorites
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    {favoriteBoats.map((b) => {
                      const isSelected = selectedBoats.some((x) => x.id === b.id);
                      return (
                        <Chip
                          key={b.id}
                          label={b.name}
                          size="small"
                          onClick={() => {
                            if (isSelected) return;
                            setSelectedBoats((prev) => [...prev.filter((x) => x.id !== b.id), b]);
                          }}
                          onDelete={(e) => toggleFavoriteBoat(b, e)}
                          deleteIcon={<Star sx={{ fontSize: 16 }} />}
                          variant={isSelected ? 'filled' : 'outlined'}
                          color={isSelected ? 'primary' : 'default'}
                        />
                      );
                    })}
                    {favoriteBoats.some((b) => !selectedBoats.some((x) => x.id === b.id)) && (
                      <Button size="small" onClick={addFavoriteBoatsToSelection}>
                        Add all favorites
                      </Button>
                    )}
                  </Box>
                </Box>
              )}
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
                    helperText="Select the specific boats you'd like to crew on. Star to add to favorites for next time."
                  />
                )}
                renderOption={(props, option) => {
                  const isFav = favoriteBoatIds.has(option.id);
                  return (
                    <li {...props} key={option.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <span>{option.name}{option.sail_number ? ` (${option.sail_number})` : ''}</span>
                        <IconButton
                          size="small"
                          onClick={(e) => toggleFavoriteBoat(option, e)}
                          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {isFav ? <Star color="primary" /> : <StarBorder />}
                        </IconButton>
                      </Box>
                    </li>
                  );
                }}
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
            </>
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
            {selectedSeries ? 'Confirm for All Events' : 'Confirm Availability'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsPage;
