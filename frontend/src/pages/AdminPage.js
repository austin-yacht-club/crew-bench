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
} from '@mui/icons-material';
import { format } from 'date-fns';
import { eventsAPI, adminAPI } from '../services/api';

const AdminPage = () => {
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
  });

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    role: 'crew',
    experience_level: 'beginner',
    is_admin: false,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, usersRes] = await Promise.all([
        eventsAPI.list(false),
        adminAPI.listUsers(),
      ]);
      setEvents(eventsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
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
      });
    }
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      const data = { ...eventForm };
      if (data.date) data.date = new Date(data.date).toISOString();
      if (data.end_date) data.end_date = new Date(data.end_date).toISOString();
      else delete data.end_date;
      
      Object.keys(data).forEach(key => {
        if (data[key] === '') delete data[key];
      });

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
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      await adminAPI.updateUser(editingUser.id, userForm);
      setSuccess('User updated successfully');
      setUserDialogOpen(false);
      setEditingUser(null);
      loadData();
    } catch (err) {
      setError('Failed to update user');
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
        Manage events, users, and import racing calendars
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveUser}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
