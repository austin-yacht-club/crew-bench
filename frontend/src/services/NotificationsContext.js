import React, { createContext, useState, useContext, useCallback } from 'react';
import { notificationsAPI, pushAPI } from './api';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeForPush,
} from './pushSubscription';

const NotificationsContext = createContext(null);

export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState(null);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushError, setPushError] = useState(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsAPI.getUnreadCount();
      setUnreadCount(res.data.count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsAPI.list({ limit: 30 });
      setNotifications(res.data);
      const unread = res.data.filter((n) => !n.read_at).length;
      setUnreadCount(unread);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {}
  }, []);

  const checkPushSupport = useCallback(async () => {
    const supported = await isPushSupported();
    setPushSupported(supported);
    if (supported) {
      const perm = await getNotificationPermission();
      setPushPermission(perm);
    }
  }, []);

  const enablePushNotifications = useCallback(async () => {
    setPushEnabling(true);
    setPushError(null);
    try {
      const { data } = await pushAPI.getVapidPublicKey();
      const publicKey = data?.publicKey;
      if (!publicKey) throw new Error('VAPID key not configured');
      const payload = await subscribeForPush(publicKey);
      await pushAPI.subscribe(payload);
      setPushPermission('granted');
    } catch (err) {
      setPushError(err.message || 'Failed to enable push');
    } finally {
      setPushEnabling(false);
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
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
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
};
