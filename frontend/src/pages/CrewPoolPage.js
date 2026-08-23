import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  TextField,
  Chip,
  Avatar,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  People,
  Add,
  Delete,
  Search,
  Event as EventIcon,
  CalendarMonth,
  Send,
  Pool,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { crewPoolAPI, crewRatingsAPI, boatsAPI, eventsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';
import StarRating from '../components/StarRating';
import ContactProfileDialog from '../components/ContactProfileDialog';
import CrewPoolContactDialog from '../components/CrewPoolContactDialog';
import InviteCrewDialog from '../components/InviteCrewDialog';

const PATTERN_OPTIONS = [
  { value: 'saturdays', label: 'Every Saturday' },
  { value: 'sundays', label: 'Every Sunday' },
  { value: 'weekends', label: 'Every Weekend' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'flexible', label: 'Flexible / Any time' },
];

const EXPERIENCE_LABELS = {
  novice: 'Never sailed',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

const patternLabel = (value) => PATTERN_OPTIONS.find((p) => p.value === value)?.label || value;

const CrewPoolPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const defaultTab = user?.role === 'skipper' || user?.is_admin ? 1 : 0;
  const [tab, setTab] = useState(defaultTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notes, setNotes] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [dateRanges, setDateRanges] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [crewPool, setCrewPool] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [crewRatingSummaries, setCrewRatingSummaries] = useState({});
  const [profileDialogUserId, setProfileDialogUserId] = useState(null);
  const [contactCrewMember, setContactCrewMember] = useState(null);
  const [boats, setBoats] = useState([]);
  const [events, setEvents] = useState([]);
  const [inviteDialogCrew, setInviteDialogCrew] = useState(null);

  const isSkipperOrAdmin = user?.role === 'skipper' || user?.is_admin;

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 0) {
        const res = await crewPoolAPI.getMy();
        if (res.data) {
          setHasProfile(true);
          setNotes(res.data.notes || '');
          setPatterns(res.data.patterns || []);
          setDateRanges(res.data.date_ranges?.length ? res.data.date_ranges : []);
          setIsActive(res.data.is_active !== false);
        } else {
          setHasProfile(false);
          setNotes('');
          setPatterns([]);
          setDateRanges([]);
          setIsActive(true);
        }
      } else {
        const requests = [crewPoolAPI.list()];
        if (isSkipperOrAdmin) {
          requests.push(boatsAPI.listMy(), eventsAPI.list(true));
        }
        const results = await Promise.all(requests);
        const res = results[0];
        setCrewPool(res.data || []);
        if (isSkipperOrAdmin) {
          setBoats(results[1]?.data || []);
          setEvents(results[2]?.data || []);
        }
        const crewIds = [...new Set((res.data || []).map((i) => i.crew?.id).filter(Boolean))];
        if (crewIds.length > 0) {
          try {
            const sumRes = await crewRatingsAPI.getSummaries(crewIds);
            const byId = {};
            sumRes.data.forEach((s) => { byId[s.crew_id] = s; });
            setCrewRatingSummaries(byId);
          } catch {
            setCrewRatingSummaries({});
          }
        }
      }
    } catch (err) {
      setError('Failed to load crew pool data');
    } finally {
      setLoading(false);
    }
  };

  const togglePattern = (value) => {
    setPatterns((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const addDateRange = () => {
    setDateRanges((prev) => [...prev, { start: '', end: '' }]);
  };

  const updateDateRange = (index, field, value) => {
    setDateRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const removeDateRange = (index) => {
    setDateRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (overrides = {}) => {
    setSaving(true);
    setError('');
    setSuccess('');
    const active = overrides.is_active !== undefined ? overrides.is_active : isActive;
    try {
      const validRanges = dateRanges.filter((r) => r.start && r.end);
      await crewPoolAPI.upsert({
        notes: notes.trim() || null,
        patterns,
        date_ranges: validRanges,
        is_active: active,
      });
      setIsActive(active);
      setHasProfile(true);
      setSuccess(active ? 'Your crew interest has been saved!' : 'Profile saved (currently hidden from skippers).');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove your crew interest profile?')) return;
    try {
      await crewPoolAPI.remove();
      setHasProfile(false);
      setNotes('');
      setPatterns([]);
      setDateRanges([]);
      setIsActive(true);
      setSuccess('Crew interest profile removed.');
    } catch (err) {
      setError('Failed to remove profile');
    }
  };

  const filteredPool = useMemo(() => {
    if (!searchQuery.trim()) return crewPool;
    const q = searchQuery.toLowerCase();
    return crewPool.filter((item) => {
      const c = item.crew;
      if (!c) return false;
      const patternText = (item.patterns || []).map(patternLabel).join(' ');
      return (
        c.name?.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        patternText.toLowerCase().includes(q) ||
        c.experience_level?.toLowerCase().includes(q)
      );
    });
  }, [crewPool, searchQuery]);

  const renderRegisterTab = () => (
    <Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Let skippers know you&apos;re looking to crew — no need to pick specific races.
        Add when you&apos;re generally available, and skippers can reach out when they need someone.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            When are you available?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tap shortcuts that describe your typical availability.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {PATTERN_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                clickable
                color={patterns.includes(opt.value) ? 'primary' : 'default'}
                variant={patterns.includes(opt.value) ? 'filled' : 'outlined'}
                onClick={() => togglePattern(opt.value)}
              />
            ))}
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Availability notes"
            placeholder="e.g. Available most spring weekends, prefer bow or trimmer, can travel to regattas..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Specific date ranges
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Optional — add windows when you know you&apos;re free.
              </Typography>
            </Box>
            <Button startIcon={<Add />} onClick={addDateRange} size="small">
              Add range
            </Button>
          </Box>

          {dateRanges.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No date ranges yet. Use shortcuts and notes above, or add specific dates here.
            </Typography>
          )}

          {dateRanges.map((range, index) => (
            <Grid container spacing={2} key={index} sx={{ mb: 2 }} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  type="date"
                  label="From"
                  InputLabelProps={{ shrink: true }}
                  value={range.start}
                  onChange={(e) => updateDateRange(index, 'start', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  type="date"
                  label="To"
                  InputLabelProps={{ shrink: true }}
                  value={range.end}
                  onChange={(e) => updateDateRange(index, 'end', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <IconButton color="error" onClick={() => removeDateRange(index)} aria-label="Remove date range">
                  <Delete />
                </IconButton>
              </Grid>
            </Grid>
          ))}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              onClick={() => handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving...' : hasProfile ? 'Update profile' : 'Register interest'}
            </Button>
            {hasProfile && (
              <>
                <Button
                  variant={isActive ? 'outlined' : 'contained'}
                  color={isActive ? 'inherit' : 'primary'}
                  onClick={() => handleSave({ is_active: !isActive })}
                  disabled={saving}
                >
                  {isActive ? 'Hide from skippers' : 'Show to skippers'}
                </Button>
                <Button variant="outlined" color="error" onClick={handleRemove} disabled={saving}>
                  Remove profile
                </Button>
              </>
            )}
          </Box>

          {hasProfile && !isActive && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Your profile is hidden. Click &quot;Show to skippers&quot; then save to appear in the crew pool.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Also interested in specific races?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For series and individual events, mark availability on the Race Events page so skippers can match you to a particular day.
          </Typography>
          <Button variant="outlined" startIcon={<EventIcon />} onClick={() => navigate('/events')}>
            Go to Race Events
          </Button>
        </CardContent>
      </Card>
    </Box>
  );

  const renderBrowseTab = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Crew Pool</strong> = general interest (patterns, notes, date ranges).
        <strong> Event availability</strong> = marked for specific races on the Events page.
        Use &quot;Invite to event&quot; below to send a race-day invitation that appears in their Requests inbox.
      </Alert>

      {isSkipperOrAdmin && boats.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Add a boat before you can invite crew from the pool to events.
        </Alert>
      )}

      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Crew who are generally looking for opportunities — no event selection required.
        For crew who already marked availability for a specific race, use Find Crew (Events).
      </Typography>

      <TextField
        fullWidth
        placeholder="Search by name, experience, notes..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {filteredPool.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No crew in the pool yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Crew members can register their general availability on the Register Interest tab.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredPool.map((item) => {
            const c = item.crew;
            if (!c) return null;
            const positions = c.position_preferences?.split(',').filter(Boolean) || [];
            const rating = crewRatingSummaries[c.id];
            return (
              <Grid item xs={12} md={6} key={item.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar
                        src={c.profile_picture || undefined}
                        sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
                      >
                        {!c.profile_picture && c.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" noWrap>{c.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {EXPERIENCE_LABELS[c.experience_level] || c.experience_level}
                          {c.weight ? ` · ${c.weight} lbs` : ''}
                        </Typography>
                        {rating && (
                          <Box sx={{ mt: 0.5 }}>
                            <StarRating value={rating.average_rating} count={rating.count} size="small" />
                          </Box>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                      <Chip
                        label="Pool interest"
                        size="small"
                        color="secondary"
                        variant="outlined"
                        icon={<Pool />}
                      />
                      {(item.upcoming_event_count || 0) > 0 && (
                        <Chip
                          label={`Also marked for ${item.upcoming_event_count} event${item.upcoming_event_count === 1 ? '' : 's'}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          icon={<EventIcon />}
                        />
                      )}
                    </Box>

                    {(item.patterns || []).length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                        {item.patterns.map((p) => (
                          <Chip key={p} label={patternLabel(p)} size="small" color="primary" variant="outlined" icon={<CalendarMonth />} />
                        ))}
                      </Box>
                    )}

                    {item.date_ranges?.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        {item.date_ranges.map((r, i) => (
                          <Typography key={i} variant="body2" color="text.secondary">
                            {r.start} → {r.end}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    {item.notes && (
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        {item.notes}
                      </Typography>
                    )}

                    {positions.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {positions.map((pos) => (
                          <Chip key={pos} label={pos.trim()} size="small" />
                        ))}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      <Button size="small" onClick={() => setProfileDialogUserId(c.id)}>
                        View profile
                      </Button>
                      {isSkipperOrAdmin && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Send />}
                            onClick={() => setContactCrewMember(c)}
                          >
                            Send message
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<EventIcon />}
                            onClick={() => setInviteDialogCrew(c)}
                            disabled={boats.length === 0 || events.length === 0}
                          >
                            Invite to event
                          </Button>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
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
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Crew Pool
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        General crew interest — separate from race-day availability on specific events.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Register Interest" />
        <Tab label="Browse Crew Pool" />
      </Tabs>

      {tab === 0 ? renderRegisterTab() : renderBrowseTab()}

      <ContactProfileDialog
        open={Boolean(profileDialogUserId)}
        onClose={() => setProfileDialogUserId(null)}
        userId={profileDialogUserId}
        source="crew-pool"
      />
      <CrewPoolContactDialog
        open={Boolean(contactCrewMember)}
        onClose={() => setContactCrewMember(null)}
        crewMember={contactCrewMember}
      />

      <InviteCrewDialog
        open={Boolean(inviteDialogCrew)}
        onClose={() => setInviteDialogCrew(null)}
        crewMember={inviteDialogCrew}
        boats={boats}
        events={events}
        source="pool"
        onSuccess={(msg) => setSuccess(msg)}
        onError={(msg) => setError(msg)}
      />
    </Box>
  );
};

export default CrewPoolPage;
