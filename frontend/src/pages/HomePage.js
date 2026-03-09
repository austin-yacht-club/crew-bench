import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Container,
} from '@mui/material';
import {
  Sailing,
  People,
  Event,
  DirectionsBoat,
} from '@mui/icons-material';
import { useAuth } from '../services/AuthContext';

const FeatureCard = ({ icon, title, description }) => (
  <Card sx={{ height: '100%', textAlign: 'center', p: 2 }}>
    <CardContent>
      <Box sx={{ color: 'primary.main', mb: 2 }}>
        {icon}
      </Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </CardContent>
  </Card>
);

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1565c0 0%, #00838f 100%)',
          color: 'white',
          py: 8,
          px: 3,
          borderRadius: 3,
          mb: 4,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Sailing sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
            Crew Bench
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
            Connect sailing crews with boats for racing events. 
            Whether you're looking for crew or a boat to sail on, we've got you covered.
          </Typography>
          {!user && (
            <Box>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  backgroundColor: 'white',
                  color: 'primary.main',
                  mr: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                }}
              >
                Register as Crew
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Register Your Boat
              </Button>
            </Box>
          )}
          {user && (
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/events')}
              sx={{
                backgroundColor: 'white',
                color: 'primary.main',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
              }}
            >
              Browse Events
            </Button>
          )}
        </Container>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FeatureCard
            icon={<Event sx={{ fontSize: 48 }} />}
            title="Browse Events"
            description="View upcoming races, regattas, and sailing events in your area"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FeatureCard
            icon={<People sx={{ fontSize: 48 }} />}
            title="Find Crew"
            description="Connect with experienced sailors looking to crew on your boat"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FeatureCard
            icon={<DirectionsBoat sx={{ fontSize: 48 }} />}
            title="Join a Boat"
            description="Mark your availability and get invited to sail on boats"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FeatureCard
            icon={<Sailing sx={{ fontSize: 48 }} />}
            title="Race Together"
            description="Build lasting connections in the sailing community"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h5" gutterBottom>
            How It Works
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" color="primary">1. Create Your Profile</Typography>
              <Typography variant="body2" color="text.secondary">
                Register as crew or skipper, add your experience level and certifications
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" color="primary">2. Mark Availability</Typography>
              <Typography variant="body2" color="text.secondary">
                Browse events and mark which ones you're available for
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" color="primary">3. Connect & Sail</Typography>
              <Typography variant="body2" color="text.secondary">
                Skippers invite crew, crew accepts, and you're ready to race!
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default HomePage;
