import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  TextField,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { raceCommitteeAPI, getAPIErrorMessage } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { RC_ROLES, parseRcRoles, rcStatusLabel } from '../constants/raceCommittee';

const RaceCommitteeDialog = ({ open, event, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [notes, setNotes] = useState('');
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('');
  const [roleChoice, setRoleChoice] = useState({});

  const profileRoles = parseRcRoles(user?.rc_roles);
  const hasProfile = profileRoles.length > 0 && Boolean((user?.rc_training || '').trim());

  const load = async () => {
    if (!event) return;
    setLoading(true);
    setError('');
    try {
      const boardRes = await raceCommitteeAPI.getBoard(event.id);
      setBoard(boardRes.data);
      const mine = boardRes.data.my_assignment;
      const starting = mine?.preferred_roles?.length ? mine.preferred_roles : profileRoles;
      setSelectedRoles(starting.filter((role) => profileRoles.includes(role)));
      setNotes(mine?.notes || '');
      if (boardRes.data.can_staff) {
        const candidatesRes = await raceCommitteeAPI.candidates(event.id);
        setCandidates(candidatesRes.data);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Failed to load the race committee'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && event) {
      setSuccess('');
      setAddUserId('');
      setAddRole('');
      load();
    }
  }, [open, event?.id]);

  const toggleRole = (role) => {
    setSelectedRoles((current) => (
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    ));
  };

  const volunteer = async () => {
    setError('');
    setSuccess('');
    try {
      await raceCommitteeAPI.volunteer(event.id, {
        preferred_roles: selectedRoles,
        notes,
      });
      setSuccess('You volunteered for this race committee');
      await load();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Could not volunteer'));
    }
  };

  const respond = async (action, id) => {
    setError('');
    setSuccess('');
    try {
      await raceCommitteeAPI[action](id);
      setSuccess(action === 'withdraw' ? 'Withdrawn' : action === 'accept' ? 'Accepted' : 'Declined');
      await load();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Could not update that assignment'));
    }
  };

  const assignPerson = async (userId, role) => {
    setError('');
    setSuccess('');
    try {
      await raceCommitteeAPI.assign(event.id, { user_id: userId, assigned_role: role });
      setSuccess('Assignment saved');
      setAddUserId('');
      setAddRole('');
      await load();
    } catch (err) {
      setError(getAPIErrorMessage(err, 'Could not assign that role'));
    }
  };

  const mine = board?.my_assignment;
  const accepted = (board?.assignments || []).filter((row) => row.status === 'accepted');
  const staffRows = (board?.assignments || []).filter((row) => row.status === 'pending' || row.status === 'accepted');
  const selectedCandidate = candidates.find((person) => person.id === Number(addUserId));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Race committee{event ? `: ${event.name}` : ''}</DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!loading && (
          <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {board?.organizing_fleet_name
                ? `${board.organizing_fleet_name} organizes this committee.`
                : 'An admin has not chosen an organizing fleet yet. You can still volunteer.'}
            </Typography>
            <Typography variant="subtitle2" gutterBottom>On the committee</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {accepted.length === 0 && (
                <Typography variant="body2" color="text.secondary">No one has been assigned yet.</Typography>
              )}
              {accepted.map((row) => (
                <Chip key={row.id} label={`${row.user_name} · ${row.assigned_role}`} size="small" />
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Volunteer</Typography>
            {!hasProfile ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Add at least one race committee role and your training on your profile first.
                </Typography>
                <Button size="small" onClick={() => { onClose(); navigate('/profile'); }}>
                  Go to profile
                </Button>
              </Box>
            ) : mine?.status === 'accepted' ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>{rcStatusLabel(mine)}</Typography>
                <Button size="small" color="warning" onClick={() => respond('withdraw', mine.id)}>
                  Withdraw
                </Button>
              </Box>
            ) : mine?.status === 'pending' && mine.assigned_role ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>{rcStatusLabel(mine)}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" onClick={() => respond('accept', mine.id)}>Accept</Button>
                  <Button size="small" color="warning" onClick={() => respond('decline', mine.id)}>Decline</Button>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Choose the roles you can do for this race. Mark-set is who can manage the mark-set boats.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {RC_ROLES.filter((role) => profileRoles.includes(role)).map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      clickable
                      color={selectedRoles.includes(role) ? 'primary' : 'default'}
                      variant={selectedRoles.includes(role) ? 'filled' : 'outlined'}
                      onClick={() => toggleRole(role)}
                    />
                  ))}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={selectedRoles.length === 0}
                    onClick={volunteer}
                  >
                    {mine?.status === 'pending' ? 'Update offer' : 'Volunteer'}
                  </Button>
                  {mine?.status === 'pending' && (
                    <Button color="warning" onClick={() => respond('withdraw', mine.id)}>Withdraw</Button>
                  )}
                </Box>
              </Box>
            )}

            {board?.can_staff && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Staff this committee</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Assign a volunteer, decline them, or add someone who has not volunteered. They need the role on their profile.
                </Typography>
                {staffRows.map((row) => {
                  const choices = row.profile_roles?.length ? row.profile_roles : RC_ROLES;
                  const chosen = roleChoice[row.id] || row.assigned_role || row.preferred_roles?.[0] || choices[0] || '';
                  return (
                    <Box key={row.id} sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.user_name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {rcStatusLabel(row)}
                        {row.preferred_roles?.length ? ` · Offered ${row.preferred_roles.join(', ')}` : ''}
                      </Typography>
                      {row.rc_training && (
                        <Typography variant="caption" display="block">Training: {row.rc_training}</Typography>
                      )}
                      {row.rc_experience && (
                        <Typography variant="caption" display="block">Experience: {row.rc_experience}</Typography>
                      )}
                      {row.same_day_sailing && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Also sailing that day
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                          <InputLabel>Role</InputLabel>
                          <Select
                            label="Role"
                            value={chosen}
                            onChange={(e) => setRoleChoice({ ...roleChoice, [row.id]: e.target.value })}
                          >
                            {choices.map((role) => (
                              <MenuItem key={role} value={role}>{role}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button size="small" variant="contained" disabled={!chosen} onClick={() => assignPerson(row.user_id, chosen)}>
                          Assign
                        </Button>
                        <Button size="small" color="warning" onClick={() => respond('decline', row.id)}>
                          Decline
                        </Button>
                      </Box>
                    </Box>
                  );
                })}

                <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>Add someone who has not volunteered</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
                    <InputLabel>Person</InputLabel>
                    <Select
                      label="Person"
                      value={addUserId}
                      onChange={(e) => {
                        setAddUserId(e.target.value);
                        setAddRole('');
                      }}
                    >
                      {candidates.map((person) => (
                        <MenuItem key={person.id} value={person.id}>
                          {person.name}{person.same_day_sailing ? ' (also sailing)' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      label="Role"
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      disabled={!selectedCandidate}
                    >
                      {(selectedCandidate?.rc_roles || []).map((role) => (
                        <MenuItem key={role} value={role}>{role}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    disabled={!addUserId || !addRole}
                    onClick={() => assignPerson(Number(addUserId), addRole)}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RaceCommitteeDialog;
