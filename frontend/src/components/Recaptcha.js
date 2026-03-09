import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

const RECAPTCHA_SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';

/**
 * Renders reCAPTCHA v2 checkbox. Only loads when siteKey is set.
 * onReady(widgetId) is called when the widget is ready; parent can call getToken(widgetId) via window.grecaptcha.getResponse(widgetId).
 */
export function getRecaptchaToken(widgetId) {
  if (typeof window === 'undefined' || !window.grecaptcha || !window.grecaptcha.getResponse) return '';
  return window.grecaptcha.getResponse(widgetId) || '';
}

export function Recaptcha({ siteKey, onReady, ...boxProps }) {
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    if (window.grecaptcha && window.grecaptcha.render) {
      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal',
        });
        setLoaded(true);
        onReady?.(widgetIdRef.current);
      } catch (e) {
        console.warn('Recaptcha render error', e);
      }
      return;
    }

    window.onRecaptchaLoad = function () {
      if (!containerRef.current) return;
      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal',
        });
        setLoaded(true);
        onReady?.(widgetIdRef.current);
      } catch (e) {
        console.warn('Recaptcha render error', e);
      }
    };

    const script = document.createElement('script');
    script.src = RECAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current != null && window.grecaptcha && window.grecaptcha.reset) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (_) {}
      }
    };
  }, [siteKey, onReady]);

  if (!siteKey) return null;

  return (
    <Box ref={containerRef} sx={{ display: 'inline-block', ...boxProps?.sx }} {...boxProps} />
  );
}

export default Recaptcha;
