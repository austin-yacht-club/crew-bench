import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  Box,
  Button,
  Divider,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../services/NotificationsContext';

const NotificationBell = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    loadUnreadCount,
    loadNotifications,
    markAsRead,
    markAllRead,
    pushSupported,
    pushPermission,
    pushEnabling,
    pushError,
    checkPushSupport,
    enablePushNotifications,
  } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    loadNotifications();
    checkPushSupport();
  };

  const handleClose = () => setAnchorEl(null);

  const handleClickNotification = (notification) => {
    if (!notification.read_at) markAsRead(notification.id);
    if (notification.link) navigate(notification.link);
    handleClose();
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} aria-label="Notifications">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: '100vw', maxHeight: 400 } }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          notifications.map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => handleClickNotification(n)}
              sx={{
                whiteSpace: 'normal',
                py: 1.5,
                bgcolor: n.read_at ? undefined : 'action.hover',
              }}
            >
              <ListItemText
                primary={n.title}
                secondary={
                  <>
                    {n.body && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {n.body}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </Typography>
                  </>
                }
              />
            </MenuItem>
          ))
        )}
        {pushSupported && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              {pushPermission === 'granted' ? (
                <Typography variant="caption" color="text.secondary">
                  Push notifications enabled
                </Typography>
              ) : (
                <>
                  <Button
                    size="small"
                    fullWidth
                    variant="outlined"
                    disabled={pushEnabling || pushPermission === 'denied'}
                    onClick={enablePushNotifications}
                  >
                    {pushEnabling ? 'Enabling…' : 'Enable push notifications'}
                  </Button>
                  {pushError && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      {pushError}
                    </Typography>
                  )}
                  {pushPermission === 'denied' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Blocked in browser. Enable in site settings to get push.
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;
