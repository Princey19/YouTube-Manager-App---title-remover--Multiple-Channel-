import api from './client.js';

export function fetchChannels() {
  return api.get('/channels');
}
