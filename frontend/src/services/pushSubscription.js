/**
 * Web Push subscription helper for mobile web.
 * Registers SW, requests permission, subscribes with VAPID key, sends to backend.
 */

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const subscriptionToPayload = (subscription) => {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!p256dh || !auth) return null;
  const encode = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: encode(p256dh),
      auth: encode(auth),
    },
  };
};

export async function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await registration.update(); // optional: get latest sw
  return registration;
}

/**
 * Request permission, subscribe to push, and return the payload to send to the backend.
 * Caller should POST to /api/push-subscriptions with the returned payload.
 */
export async function subscribeForPush(vapidPublicKeyBase64Url) {
  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Service worker not supported');
  if (!vapidPublicKeyBase64Url) throw new Error('VAPID public key required');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKeyBase64Url);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  const payload = subscriptionToPayload(subscription);
  if (!payload) throw new Error('Failed to encode subscription keys');
  return payload;
}
