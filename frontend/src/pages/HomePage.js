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
          py: { xs: 4, sm: 6, md: 8 },
          px: { xs: 2, sm: 3 },
          borderRadius: { xs: 2, md: 3 },
          mb: { xs: 2, sm: 4 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Sailing sx={{ fontSize: { xs: 48, sm: 64 }, mb: 2 }} />
          <Typography 
            variant="h3" 
            component="h1" 
            gutterBottom 
            fontWeight={700}
            sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}
          >
            Crew Bench
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: { xs: 3, sm: 4 }, 
              opacity: 0.9,
              fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' },
              px: { xs: 1, sm: 0 },
            }}
          >
            Connect sailing crews with boats for racing events. 
            Whether you're looking for crew or a boat to sail on, we've got you covered.
          </Typography>
          {!user && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              justifyContent: 'center',
              gap: { xs: 1, sm: 2 },
              px: { xs: 2, sm: 0 },
            }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate('/register')}
                sx={{
                  backgroundColor: 'white',
                  color: 'primary.main',
                  maxWidth: { sm: 200 },
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                }}
              >
                Register as Crew
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={() => navigate('/register')}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  maxWidth: { sm: 200 },
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
