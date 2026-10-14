// Central network configuration
// Empty VITE_API_URL or VITE_WS_URL means "use the page origin" (tunnel/same-origin mode)
export const API_BASE = (import.meta.env.VITE_API_URL || '').trim();

export const WS_URL =
  (import.meta.env.VITE_WS_URL || '').trim() ||
  (typeof location !== 'undefined'
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    : '');

export default {
  API_BASE,
  WS_URL,
};
