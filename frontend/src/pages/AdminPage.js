import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Event,
  People,
  CloudDownload,
  Add,
  Edit,
  Delete,
  Campaign,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { eventsAPI, adminAPI, fleetsAPI, getAPIErrorMessage } from '../services/api';
import { useMotd } from '../services/MotdContext';

const MOTD_FIELDS = [
  {
    location: 'landing',
    title: 'Landing page',
    description: 'Shown at the top of the public home page.',
  },
  {
    location: 'login',
    title: 'Login page',
    description: 'Shown on the sign-in screen.',
  },
  {
    location: 'dashboard',
    title: 'Dashboard',
    description: 'Shown across the rest of the app after visitors leave the home page.',
  },
];

const emptyMotdForms = {
  landing: { message: '', is_active: false, updated_at: null },
  login: { message: '', is_active: false, updated_at: null },
  dashboard: { message: '', is_active: false, updated_at: null },
};

const AdminPage = () => {
  const { refreshMotds } = useMotd();
  const [tab, setTab] = useState(0);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [importUrl, setImportUrl] = useState('https://austinyachtclub.net/series-racing-calendar/');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    date: '',
    end_date: '',
    location: '',
    event_type: 'race',
    series: '',
    external_url: '',
    organizing_fleet_id: '',
  });

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    role: 'crew',
    experience_level: 'beginner',
    is_admin: false,
    is_active: true,
    new_password: '',
    must_change_password: false,
  });

  const [motdForms, setMotdForms] = useState(emptyMotdForms);
  const [motdSaving, setMotdSaving] = useState({});
  const [fleets, setFleets] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [newFleetName, setNewFleetName] = useState('');
  const [leadUserByFleet, setLeadUserByFleet] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 3) {
      loadMotds();
    }
  }, [tab]);

  const loadData = async () => {
    try {
      const [eventsRes, usersRes, fleetsRes, organizersRes] = await Promise.all([
        eventsAPI.list(false),
        adminAPI.listUsers(),
        fleetsAPI.list(),
        adminAPI.listFleetOrganizers(),
      ]);
      setEvents(eventsRes.data);
      setUsers(usersRes.data);
      setFleets(fleetsRes.data);
      setOrganizers(organizersRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMotds = async () => {
    try {
      const response = await adminAPI.listMotds();
      const next = { ...emptyMotdForms };
      (response.data || []).forEach((motd) => {
        next[motd.location] = {
          message: motd.message || '',
          is_active: Boolean(motd.is_active),
          updated_at: motd.updated_at || null,
        };
      });
      setMotdForms(next);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load messages');
    }
  };

  const handleSaveMotd = async (location) => {
    setMotdSaving((prev) => ({ ...prev, [location]: true }));
    setError('');
    try {
      const form = motdForms[location];
      const response = await adminAPI.updateMotd(location, {
        message: form.message,
        is_active: form.is_active,
      });
      setMotdForms((prev) => ({
        ...prev,
        [location]: {
          message: response.data.message || '',
          is_active: Boolean(response.data.is_active),
          updated_at: response.data.updated_at || null,
        },
      }));
      setSuccess(`${MOTD_FIELDS.find((item) => item.location === location)?.title || 'Message'} saved`);
      refreshMotds();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save message');
    } finally {
      setMotdSaving((prev) => ({ ...prev, [location]: false }));
    }
  };

  const handleImportCalendar = async () => {
    setImporting(true);
    setError('');
    setImportResult(null);

    try {
      const response = await adminAPI.importCalendar(importUrl);
      setImportResult(response.data);
      if (response.data.imported_count > 0) {
        setSuccess(`Imported ${response.data.imported_count} events`);
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import calendar');
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEventDialog = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        name: event.name || '',
        description: event.description || '',
        date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
        end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
        location: event.location || '',
        event_type: event.event_type || 'race',
        series: event.series || '',
        external_url: event.external_url || '',
        organizing_fleet_id: event.organizing_fleet_id || '',
      });
    } else {
      setEditingEvent(null);
      setEventForm({
        name: '',
        description: '',
        date: '',
        end_date: '',
        location: '',
        event_type: 'race',
        series: '',
        external_url: '',
        organizing_fleet_id: '',
      });
    }
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      const data = { ...eventForm };
      const fleetId = data.organizing_fleet_id ? Number(data.organizing_fleet_id) : null;
      delete data.organizing_fleet_id;
      if (data.date) data.date = new Date(data.date).toISOString();
      if (data.end_date) data.end_date = new Date(data.end_date).toISOString();
      else delete data.end_date;
      
      Object.keys(data).forEach(key => {
        if (data[key] === '') delete data[key];
      });
      if (editingEvent || fleetId) {
        data.organizing_fleet_id = fleetId;
      }

      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, data);
        setSuccess('Event updated successfully');
      } else {
        await eventsAPI.create(data);
        setSuccess('Event created successfully');
      }
      
      setEventDialogOpen(false);
      setEditingEvent(null);
      loadData();
    } catch (err) {
      setError(editingEvent ? 'Failed to update event' : 'Failed to create event');
    }
  };

  const handleOpenUserDialog = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name || '',
      role: user.role || 'crew',
      experience_level: user.experience_level || 'beginner',
      is_admin: user.is_admin || false,
      is_active: user.is_active ?? true,
      new_password: '',
      must_change_password: false,
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const data = { ...userForm };
      // Only include password if it's set
      if (!data.new_password) {
        delete data.new_password;
        delete data.must_change_password;
      }
      await adminAPI.updateUser(editingUser.id, data);
      setSuccess('User updated successfully');
      setUserDialogOpen(false);
      setEditingUser(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleCreateFleet = async () => {
    const name = newFleetName.trim();
    if (!name) return;
    setError('');
    try {
      await fleetsAPI.create({ name });
      setNewFleetName('');
      setSuccess(`Fleet ${name} created`);
      loadData();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Failed to create fleet'));
    }
  };

  const handleAddLead = async (fleetId) => {
    const userId = Number(leadUserByFleet[fleetId]);
    if (!userId) return;
    setError('');
    try {
      await adminAPI.addFleetOrganizer(fleetId, userId);
      setLeadUserByFleet({ ...leadUserByFleet, [fleetId]: '' });
      setSuccess('RC lead added');
      loadData();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Failed to add RC lead'));
    }
  };

  const handleRemoveLead = async (fleetId, userId) => {
    setError('');
    try {
      await adminAPI.removeFleetOrganizer(fleetId, userId);
      setSuccess('RC lead removed');
      loadData();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Failed to remove RC lead'));
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await eventsAPI.delete(eventId);
        loadData();
      } catch (err) {
        setError('Failed to delete event');
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
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
        Admin Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Manage events, users, messages of the day, and import racing calendars
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

      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab icon={<Event />} label="Events" iconPosition="start" />
        <Tab icon={<CloudDownload />} label="Import" iconPosition="start" />
        <Tab icon={<People />} label="Users" iconPosition="start" />
        <Tab icon={<Campaign />} label="Messages" iconPosition="start" />
        <Tab label="RC leads" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenEventDialog()}
            >
              Create Event
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Series</TableCell>
                  <TableCell>Committee fleet</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.name}</TableCell>
                    <TableCell>
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Chip label={event.event_type || 'race'} size="small" />
                    </TableCell>
                    <TableCell>{event.series || '-'}</TableCell>
                    <TableCell>{event.organizing_fleet?.name || '-'}</TableCell>
                    <TableCell>
                      {event.imported_from ? (
                        <Chip label="Imported" size="small" variant="outlined" />
                      ) : (
                        <Chip label="Manual" size="small" color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEventDialog(event)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Import Racing Calendar
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Import events from an external racing calendar
                </Typography>
                <TextField
                  fullWidth
                  label="Calendar URL"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://austinyachtclub.net/series-racing-calendar/"
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  startIcon={importing ? <CircularProgress size={20} /> : <CloudDownload />}
                  onClick={handleImportCalendar}
                  disabled={importing || !importUrl}
                >
                  {importing ? 'Importing...' : 'Import Events'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Supported Calendars
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Austin Yacht Club"
                      secondary="https://austinyachtclub.net/series-racing-calendar/"
                    />
                  </ListItem>
                </List>
                <Typography variant="body2" color="text.secondary">
                  The importer attempts to parse events from table, list, or calendar formats.
                  Results may vary depending on the calendar format.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {importResult && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Import Results
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Imported {importResult.imported_count} events
                  </Typography>
                  {importResult.errors?.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {importResult.errors.join(', ')}
                    </Alert>
                  )}
                  {importResult.events?.length > 0 && (
                    <List>
                      {importResult.events.map((event) => (
                        <ListItem key={event.id}>
                          <ListItemText
                            primary={event.name}
                            secondary={format(new Date(event.date), 'MMM d, yyyy')}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Experience</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Admin</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} sx={{ opacity: user.is_active ? 1 : 0.5 }}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip label={user.role} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={user.experience_level} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.is_active ? 'Active' : 'Inactive'} 
                      size="small" 
                      color={user.is_active ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {user.is_admin ? (
                      <Chip label="Yes" size="small" color="secondary" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenUserDialog(user)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 3 && (
        <Grid container spacing={3}>
          {MOTD_FIELDS.map((field) => {
            const form = motdForms[field.location] || emptyMotdForms.landing;
            return (
              <Grid item xs={12} key={field.location}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {field.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {field.description} Typically a single line, shown with the date you last saved it.
                    </Typography>
                    <TextField
                      fullWidth
                      label="Message"
                      value={form.message}
                      onChange={(e) =>
                        setMotdForms((prev) => ({
                          ...prev,
                          [field.location]: {
                            ...prev[field.location],
                            message: e.target.value,
                          },
                        }))
                      }
                      inputProps={{ maxLength: 280 }}
                      helperText={`${form.message.length}/280 characters`}
                      sx={{ mb: 2 }}
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(form.is_active) && Boolean(form.message.trim())}
                            onChange={(e) =>
                              setMotdForms((prev) => ({
                                ...prev,
                                [field.location]: {
                                  ...prev[field.location],
                                  is_active: e.target.checked,
                                },
                              }))
                            }
                          />
                        }
                        label="Visible"
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {form.updated_at && (
                          <Typography variant="caption" color="text.secondary">
                            Last saved {format(new Date(form.updated_at), 'MMM d, yyyy h:mm a')}
                          </Typography>
                        )}
                        <Button
                          variant="contained"
                          onClick={() => handleSaveMotd(field.location)}
                          disabled={motdSaving[field.location]}
                        >
                          {motdSaving[field.location] ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {tab === 4 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            RC leads staff the committee for races organized by their fleet. They can assign the PRO.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 3, maxWidth: 480 }}>
            <TextField
              fullWidth
              size="small"
              label="New fleet name"
              value={newFleetName}
              onChange={(e) => setNewFleetName(e.target.value)}
            />
            <Button variant="contained" onClick={handleCreateFleet} disabled={!newFleetName.trim()}>
              Create
            </Button>
          </Box>
          {fleets.length === 0 && (
            <Typography variant="body2" color="text.secondary">No fleets yet.</Typography>
          )}
          <Grid container spacing={2}>
            {fleets.map((fleet) => {
              const leads = organizers.filter((row) => row.fleet_id === fleet.id);
              return (
                <Grid item xs={12} md={6} key={fleet.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>{fleet.name}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {leads.length === 0 && (
                          <Typography variant="body2" color="text.secondary">No RC leads</Typography>
                        )}
                        {leads.map((lead) => (
                          <Chip
                            key={lead.id}
                            label={lead.user_name}
                            onDelete={() => handleRemoveLead(fleet.id, lead.user_id)}
                          />
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Person</InputLabel>
                          <Select
                            label="Person"
                            value={leadUserByFleet[fleet.id] || ''}
                            onChange={(e) => setLeadUserByFleet({ ...leadUserByFleet, [fleet.id]: e.target.value })}
                          >
                            {users.filter((person) => !leads.some((lead) => lead.user_id === person.id)).map((person) => (
                              <MenuItem key={person.id} value={person.id}>{person.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          variant="outlined"
                          disabled={!leadUserByFleet[fleet.id]}
                          onClick={() => handleAddLead(fleet.id)}
                        >
                          Add
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Event Name"
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="datetime-local"
                value={eventForm.date}
                onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date (optional)"
                type="datetime-local"
                value={eventForm.end_date}
                onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Event Type"
                value={eventForm.event_type}
                onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                placeholder="race, regatta, cruise"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Series"
                value={eventForm.series}
                onChange={(e) => setEventForm({ ...eventForm, series: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="External URL"
                value={eventForm.external_url}
                onChange={(e) => setEventForm({ ...eventForm, external_url: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Organizing fleet</InputLabel>
                <Select
                  label="Organizing fleet"
                  value={eventForm.organizing_fleet_id || ''}
                  onChange={(e) => setEventForm({ ...eventForm, organizing_fleet_id: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {fleets.map((fleet) => (
                    <MenuItem key={fleet.id} value={fleet.id}>{fleet.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                This fleet's RC leads staff the committee for this race.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEvent}
            disabled={!eventForm.name || !eventForm.date}
          >
            {editingEvent ? 'Save Changes' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Email: {editingUser?.email}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  label="Role"
                >
                  <MenuItem value="crew">Crew</MenuItem>
                  <MenuItem value="skipper">Skipper</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Experience Level</InputLabel>
                <Select
                  value={userForm.experience_level}
                  onChange={(e) => setUserForm({ ...userForm, experience_level: e.target.value })}
                  label="Experience Level"
                >
                  <MenuItem value="novice">Never Sailed Before</MenuItem>
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userForm.is_admin}
                    onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                  />
                }
                label="Administrator"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userForm.is_active}
                    onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                  />
                }
                label="Active Account"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Reset Password (optional)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={userForm.new_password}
                onChange={(e) => setUserForm({ ...userForm, new_password: e.target.value })}
                helperText="Leave blank to keep current password. Min 8 characters."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userForm.must_change_password}
                    onChange={(e) => setUserForm({ ...userForm, must_change_password: e.target.checked })}
                    disabled={!userForm.new_password}
                  />
                }
                label="Require password change on login"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveUser}
            disabled={userForm.new_password && userForm.new_password.length < 8}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
