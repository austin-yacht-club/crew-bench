import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { motdAPI } from './api';
import { useAuth } from './AuthContext';

const MotdContext = createContext(null);

const EMPTY_MOTDS = { landing: null, login: null, dashboard: null };

export const MotdProvider = ({ children }) => {
  const { user } = useAuth();
  const [motds, setMotds] = useState(EMPTY_MOTDS);

  const refreshMotds = useCallback(async () => {
    try {
      const response = await motdAPI.list();
      setMotds({
        landing: response.data?.landing || null,
        login: response.data?.login || null,
        dashboard: response.data?.dashboard || null,
      });
    } catch {
      setMotds(EMPTY_MOTDS);
    }
  }, []);

  useEffect(() => {
    refreshMotds();
  }, [refreshMotds, user?.id]);

  const dismissMotd = useCallback(async (location) => {
    setMotds((prev) => ({ ...prev, [location]: null }));
    try {
      await motdAPI.dismiss(location);
    } catch {
      refreshMotds();
    }
  }, [refreshMotds]);

  return (
    <MotdContext.Provider value={{ motds, refreshMotds, dismissMotd }}>
      {children}
    </MotdContext.Provider>
  );
};

export const useMotd = () => {
  const context = useContext(MotdContext);
  if (!context) {
    throw new Error('useMotd must be used within a MotdProvider');
  }
  return context;
};
