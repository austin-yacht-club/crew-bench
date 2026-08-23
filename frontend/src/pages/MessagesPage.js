import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Send, Email, Phone, MailOutline } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { conversationsAPI } from '../services/api';
import { useAuth } from '../services/AuthContext';

const preferredLabel = {
  email: 'Email preferred',
  phone: 'Phone preferred',
  sms: 'SMS preferred',
  any: 'Any contact method',
};

const MessagesPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await conversationsAPI.list();
      setConversations(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load conversations');
    }
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    setLoadingThread(true);
    try {
      const res = await conversationsAPI.get(id);
      setActiveConversation(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load conversation');
      setActiveConversation(null);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    };
    init();
  }, [loadConversations]);

  useEffect(() => {
    if (conversationId) {
      loadThread(conversationId);
    } else {
      setActiveConversation(null);
    }
  }, [conversationId, loadThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const getOtherParty = (conversation) => {
    if (!conversation || !user) return null;
    return conversation.skipper_id === user.id ? conversation.crew : conversation.skipper;
  };

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !activeConversation) return;
    setSending(true);
    setError('');
    try {
      await conversationsAPI.sendMessage(activeConversation.id, trimmed);
      setNewMessage('');
      await loadThread(activeConversation.id);
      await loadConversations();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const otherParty = activeConversation ? getOtherParty(activeConversation) : null;

  const renderContactDetails = () => {
    if (!otherParty) return null;
    const hasEmail = otherParty.allow_email_contact && otherParty.email;
    const hasPhone = (otherParty.allow_phone_contact || otherParty.allow_sms_contact) && otherParty.phone;
    if (!hasEmail && !hasPhone) {
      return (
        <Typography variant="body2" color="text.secondary">
          No direct contact details shared — use in-app messages below.
        </Typography>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {otherParty.contact_preference && (
          <Chip
            size="small"
            label={preferredLabel[otherParty.contact_preference] || otherParty.contact_preference}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          />
        )}
        {hasEmail && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email fontSize="small" color="action" />
            <Typography variant="body2" component="a" href={`mailto:${otherParty.email}`}>
              {otherParty.email}
            </Typography>
          </Box>
        )}
        {hasPhone && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Phone fontSize="small" color="action" />
            <Typography variant="body2" component="a" href={`tel:${otherParty.phone}`}>
              {otherParty.phone}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Messages
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Conversations started from the Crew Pool.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: { md: '70vh' }, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Conversations</Typography>
            </CardContent>
            <Divider />
            {conversations.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', flex: 1 }}>
                <MailOutline sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No conversations yet. Skippers can start one from Browse Crew Pool.
                </Typography>
              </Box>
            ) : (
              <List sx={{ overflow: 'auto', flex: 1, py: 0 }}>
                {conversations.map((conv) => {
                  const other = getOtherParty(conv);
                  const selected = String(conv.id) === String(conversationId);
                  return (
                    <ListItemButton
                      key={conv.id}
                      selected={selected}
                      onClick={() => navigate(`/messages/${conv.id}`)}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={conv.unread_count || 0}
                          color="error"
                          invisible={!conv.unread_count}
                        >
                          <Avatar src={other?.profile_picture || undefined} sx={{ bgcolor: 'primary.main' }}>
                            {!other?.profile_picture && other?.name?.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={other?.name || 'Unknown'}
                        secondary={
                          conv.last_message ? (
                            <>
                              {conv.last_message.body.length > 60
                                ? `${conv.last_message.body.slice(0, 60)}…`
                                : conv.last_message.body}
                              {' · '}
                              {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })}
                            </>
                          ) : 'No messages yet'
                        }
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: { md: '70vh' }, display: 'flex', flexDirection: 'column' }}>
            {!conversationId ? (
              <Box sx={{ p: 4, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Select a conversation to view messages</Typography>
              </Box>
            ) : loadingThread ? (
              <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                <CircularProgress />
              </Box>
            ) : activeConversation ? (
              <>
                <CardContent sx={{ pb: 1 }}>
                  <Typography variant="h6">{otherParty?.name}</Typography>
                  <Box sx={{ mt: 1 }}>{renderContactDetails()}</Box>
                </CardContent>
                <Divider />
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {(activeConversation.messages || []).map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          mb: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: '75%',
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: isOwn ? 'primary.main' : 'grey.200',
                            color: isOwn ? 'primary.contrastText' : 'text.primary',
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {msg.body}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', mt: 0.5, opacity: 0.8, textAlign: 'right' }}
                          >
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </Box>
                <Divider />
                <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                    multiline
                    maxRows={4}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSend}
                    disabled={sending || !newMessage.trim()}
                    sx={{ minWidth: 48 }}
                  >
                    <Send />
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', flex: 1 }}>
                <Typography color="text.secondary">Conversation not found</Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MessagesPage;
