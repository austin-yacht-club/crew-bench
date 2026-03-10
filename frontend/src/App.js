import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './services/AuthContext';
import { NotificationsProvider } from './services/NotificationsContext';

import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EventsPage from './pages/EventsPage';
import BoatsPage from './pages/BoatsPage';
import ProfilePage from './pages/ProfilePage';
import FindCrewPage from './pages/FindCrewPage';
import RequestsPage from './pages/RequestsPage';
import StatusPage from './pages/StatusPage';
import AdminPage from './pages/AdminPage';
import ContactsPage from './pages/ContactsPage';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565c0',
      light: '#5e92f3',
      dark: '#003c8f',
    },
    secondary: {
      main: '#00838f',
      light: '#4fb3bf',
      dark: '#005662',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          margin: 16,
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100% - 32px)',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: '16px !important',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minWidth: 'auto',
          paddingLeft: 12,
          paddingRight: 12,
          '@media (max-width: 600px)': {
            fontSize: '0.8rem',
            minHeight: 48,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          '@media (max-width: 600px)': {
            height: 28,
            fontSize: '0.75rem',
          },
        },
        sizeSmall: {
          '@media (max-width: 600px)': {
            height: 24,
            fontSize: '0.7rem',
          },
        },
      },
    },
  },
});

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user?.is_admin ? children : <Navigate to="/" />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="boats" element={
                <PrivateRoute><BoatsPage /></PrivateRoute>
              } />
              <Route path="find-crew" element={
                <PrivateRoute><FindCrewPage /></PrivateRoute>
              } />
              <Route path="requests" element={
                <PrivateRoute><RequestsPage /></PrivateRoute>
              } />
              <Route path="status" element={
                <PrivateRoute><StatusPage /></PrivateRoute>
              } />
              <Route path="profile" element={
                <PrivateRoute><ProfilePage /></PrivateRoute>
              } />
              <Route path="contacts" element={
                <PrivateRoute><ContactsPage /></PrivateRoute>
              } />
              <Route path="admin" element={
                <AdminRoute><AdminPage /></AdminRoute>
              } />
            </Route>
          </Routes>
        </Router>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
