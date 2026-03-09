import React from 'react';
import { Box } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';

/**
 * Display or interactive star rating (1-5).
 * - displayMode: show average rating (can be decimal)
 * - interactive: show clickable stars to set rating
 */
const StarRating = ({ value, count, size = 'small', displayOnly = true, onChange }) => {
  const num = Math.min(5, Math.max(0, Number(value) || 0));
  const full = Math.round(num);
  const sizeNum = size === 'small' ? 18 : 24;

  if (displayOnly) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            sx={{
              fontSize: sizeNum,
              color: i <= full ? 'warning.main' : 'action.disabled',
            }}
          />
        ))}
        {count != null && count > 0 && (
          <Box component="span" sx={{ ml: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
            ({count})
          </Box>
        )}
      </Box>
    );
  }

  const [hover, setHover] = React.useState(0);
  const rating = hover || (typeof value === 'number' ? value : 0);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box
          key={i}
          component="span"
          onClick={() => onChange && onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          sx={{ cursor: onChange ? 'pointer' : 'default' }}
        >
          {i <= rating ? (
            <Star sx={{ fontSize: sizeNum, color: 'warning.main' }} />
          ) : (
            <StarBorder sx={{ fontSize: sizeNum, color: 'action.disabled' }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

export default StarRating;
