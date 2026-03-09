import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  Autocomplete,
  Chip,
  createFilterOptions,
} from '@mui/material';
import {
  DirectionsBoat,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { boatsAPI, fleetsAPI } from '../services/api';

const filter = createFilterOptions();

const BoatsPage = () => {
  const [boats, setBoats] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBoat, setEditingBoat] = useState(null);
  const [selectedFleet, setSelectedFleet] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    make: '',
    model: '',
    year: '',
    sail_number: '',
    length: '',
    description: '',
    crew_needed: 3,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [boatsRes, fleetsRes] = await Promise.all([
        boatsAPI.listMy(),
        fleetsAPI.list(),
      ]);
      setBoats(boatsRes.data);
      setFleets(fleetsRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (boat = null) => {
    if (boat) {
      setEditingBoat(boat);
      setFormData({
        name: boat.name || '',
        make: boat.make || '',
        model: boat.model || '',
        year: boat.year || '',
        sail_number: boat.sail_number || '',
        length: boat.length || '',
        description: boat.description || '',
        crew_needed: boat.crew_needed || 3,
      });
      setSelectedFleet(boat.fleet || null);
    } else {
      setEditingBoat(null);
      setFormData({
        name: '',
        make: '',
        model: '',
        year: '',
        sail_number: '',
        length: '',
        description: '',
        crew_needed: 3,
      });
      setSelectedFleet(null);
    }
    setDialogOpen(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFleetChange = async (event, newValue) => {
    if (typeof newValue === 'string') {
      // User typed a new fleet name and pressed enter
      try {
        const response = await fleetsAPI.create({ name: newValue });
        const newFleet = response.data;
        setFleets([...fleets, newFleet]);
        setSelectedFleet(newFleet);
      } catch (err) {
        setError('Failed to create fleet');
      }
    } else if (newValue && newValue.inputValue) {
      // User selected "Add new fleet" option
      try {
        const response = await fleetsAPI.create({ name: newValue.inputValue });
        const newFleet = response.data;
        setFleets([...fleets, newFleet]);
        setSelectedFleet(newFleet);
      } catch (err) {
        setError('Failed to create fleet');
      }
    } else {
      // User selected an existing fleet or cleared
      setSelectedFleet(newValue);
    }
  };

  const handleSubmit = async () => {
    try {
      const data = { ...formData };
      if (data.year) data.year = parseInt(data.year);
      if (data.length) data.length = parseInt(data.length);
      if (data.crew_needed) data.crew_needed = parseInt(data.crew_needed);
      
      // Add fleet_id
      if (selectedFleet) {
        data.fleet_id = selectedFleet.id;
      } else {
        data.fleet_id = null;
      }
      
      Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === undefined) delete data[key];
      });

      if (editingBoat) {
        await boatsAPI.update(editingBoat.id, data);
      } else {
        await boatsAPI.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      setError('Failed to save boat');
    }
  };

  const handleDelete = async (boatId) => {
    if (window.confirm('Are you sure you want to delete this boat?')) {
      try {
        await boatsAPI.delete(boatId);
        loadData();
      } catch (err) {
        setError('Failed to delete boat');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            My Boats
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your boats and find crew for events
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Boat
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {boats.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <DirectionsBoat sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">No boats yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add your boat to start finding crew
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
              Add Your First Boat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {boats.map((boat) => (
            <Grid item xs={12} md={6} key={boat.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6">{boat.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[boat.make, boat.model, boat.year].filter(Boolean).join(' ')}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(boat)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(boat.id)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>
                  {boat.fleet && (
                    <Chip 
                      label={boat.fleet.name} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                      sx={{ mt: 1 }}
                    />
                  )}
                  {boat.sail_number && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Sail #: {boat.sail_number}
                    </Typography>
                  )}
                  {boat.length && (
                    <Typography variant="body2">
                      Length: {boat.length} ft
                    </Typography>
                  )}
                  <Typography variant="body2">
                    Crew needed: {boat.crew_needed}
                  </Typography>
                  {boat.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {boat.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBoat ? 'Edit Boat' : 'Add Boat'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Boat Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                value={selectedFleet}
                onChange={handleFleetChange}
                filterOptions={(options, params) => {
                  const filtered = filter(options, params);
                  const { inputValue } = params;
                  const isExisting = options.some((option) => inputValue === option.name);
                  if (inputValue !== '' && !isExisting) {
                    filtered.push({
                      inputValue,
                      name: `Add "${inputValue}"`,
                    });
                  }
                  return filtered;
                }}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                options={fleets}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') {
                    return option;
                  }
                  if (option.inputValue) {
                    return option.inputValue;
                  }
                  return option.name;
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <li key={option.id || option.inputValue} {...rest}>
                      {option.inputValue ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Add sx={{ mr: 1, fontSize: 18 }} />
                          {option.name}
                        </Box>
                      ) : (
                        option.name
                      )}
                    </li>
                  );
                }}
                freeSolo
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Fleet"
                    placeholder="Select or type to add new fleet"
                    helperText="Type a new fleet name to create it"
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Make"
                name="make"
                value={formData.make}
                onChange={handleChange}
                placeholder="e.g., J/Boats"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g., J/24"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Year"
                name="year"
                type="number"
                value={formData.year}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Length (ft)"
                name="length"
                type="number"
                value={formData.length}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Sail Number"
                name="sail_number"
                value={formData.sail_number}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Crew Needed"
                name="crew_needed"
                type="number"
                value={formData.crew_needed}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingBoat ? 'Save Changes' : 'Add Boat'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BoatsPage;
