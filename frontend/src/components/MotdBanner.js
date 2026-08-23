import React from 'react';
import { Alert, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useAuth } from '../services/AuthContext';
import { useMotd } from '../services/MotdContext';

const MotdBanner = ({ location, sx = {} }) => {
  const { user } = useAuth();
  const { motds, dismissMotd } = useMotd();
  const motd = motds[location];

  if (!motd?.message) {
    return null;
  }

  const dateLabel = motd.updated_at
    ? format(new Date(motd.updated_at), 'MMM d, yyyy')
    : null;

  return (
    <Alert
      severity="info"
      onClose={user ? () => dismissMotd(location) : undefined}
      sx={{
        py: 0.5,
        alignItems: 'center',
        '& .MuiAlert-message': {
          overflow: 'hidden',
          width: '100%',
        },
        ...sx,
      }}
    >
      <Typography
        variant="body2"
        component="p"
        sx={{
          m: 0,
          whiteSpace: { xs: 'normal', sm: 'nowrap' },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {dateLabel && (
          <Typography component="span" variant="body2" sx={{ fontWeight: 700, mr: 1 }}>
            {dateLabel}
          </Typography>
        )}
        {motd.message}
      </Typography>
    </Alert>
  );
};

export default MotdBanner;
