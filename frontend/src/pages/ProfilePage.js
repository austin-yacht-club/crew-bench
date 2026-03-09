import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  IconButton,
  Badge,
} from '@mui/material';
import { Person, Save, ContactMail, PhotoCamera, Delete } from '@mui/icons-material';
import { useAuth } from '../services/AuthContext';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    role: user?.role || 'crew',
    experience_level: user?.experience_level || 'beginner',
    bio: user?.bio || '',
    weight: user?.weight || '',
    certifications: user?.certifications || '',
    profile_picture: user?.profile_picture || null,
    allow_email_contact: user?.allow_email_contact ?? true,
    allow_phone_contact: user?.allow_phone_contact ?? false,
    allow_sms_contact: user?.allow_sms_contact ?? false,
    contact_preference: user?.contact_preference || 'email',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData({ ...formData, profile_picture: resizedDataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = () => {
    setFormData({ ...formData, profile_picture: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = { ...formData };
      if (data.weight) {
        data.weight = parseInt(data.weight);
      } else {
        delete data.weight;
      }
      await updateUser(data);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
        My Profile
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        Manage your account settings
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Box>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      <IconButton
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'primary.dark' },
                          width: 36,
                          height: 36,
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <PhotoCamera sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  }
                >
                  <Avatar
                    src={formData.profile_picture || undefined}
                    sx={{
                      width: 120,
                      height: 120,
                      fontSize: 48,
                      bgcolor: 'primary.main',
                    }}
                  >
                    {!formData.profile_picture && user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </Box>
              {formData.profile_picture && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={handleRemovePicture}
                  >
                    Remove Photo
                  </Button>
                </Box>
              )}
              <Typography variant="h6">{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {user?.email}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                <Chip label={user?.role || 'crew'} color="primary" />
                <Chip label={user?.experience_level || 'beginner'} variant="outlined" />
              </Box>
              {user?.is_admin && (
                <Chip label="Admin" color="secondary" sx={{ mt: 1 }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Profile Information</Typography>
              </Box>

              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Role</InputLabel>
                      <Select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        label="Role"
                      >
                        <MenuItem value="crew">Crew</MenuItem>
                        <MenuItem value="skipper">Skipper</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Experience Level</InputLabel>
                      <Select
                        name="experience_level"
                        value={formData.experience_level}
                        onChange={handleChange}
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
                    <TextField
                      fullWidth
                      label="Weight (lbs)"
                      name="weight"
                      type="number"
                      value={formData.weight}
                      onChange={handleChange}
                      helperText="Important for sailboat balance"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Certifications"
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      multiline
                      rows={4}
                      placeholder="Tell us about your sailing experience..."
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ContactMail sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Contact Preferences</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Control how other sailors can contact you
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.allow_email_contact}
                            onChange={handleChange}
                            name="allow_email_contact"
                          />
                        }
                        label="Allow contact via email"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.allow_phone_contact}
                            onChange={handleChange}
                            name="allow_phone_contact"
                            disabled={!formData.phone}
                          />
                        }
                        label={
                          formData.phone 
                            ? "Allow contact via phone call" 
                            : "Allow contact via phone call (add phone number first)"
                        }
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.allow_sms_contact}
                            onChange={handleChange}
                            name="allow_sms_contact"
                            disabled={!formData.phone}
                          />
                        }
                        label={
                          formData.phone 
                            ? "Allow contact via SMS/text message" 
                            : "Allow contact via SMS/text message (add phone number first)"
                        }
                      />
                    </FormGroup>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Preferred Contact Method</InputLabel>
                      <Select
                        name="contact_preference"
                        value={formData.contact_preference}
                        onChange={handleChange}
                        label="Preferred Contact Method"
                      >
                        <MenuItem value="email">Email</MenuItem>
                        <MenuItem value="phone" disabled={!formData.phone}>
                          Phone call {!formData.phone && '(add phone number)'}
                        </MenuItem>
                        <MenuItem value="sms" disabled={!formData.phone}>
                          SMS/Text {!formData.phone && '(add phone number)'}
                        </MenuItem>
                        <MenuItem value="any" disabled={!formData.phone}>
                          Any method {!formData.phone && '(add phone number)'}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
