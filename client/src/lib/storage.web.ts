// Async key-value stores over the browser's storage (SPEC §0.1): session-scoped and persistent.
const wrap = (storage: Storage) => ({
  getItem: async (key: string) => storage.getItem(key),
  setItem: async (key: string, value: string) => storage.setItem(key, value),
  removeItem: async (key: string) => storage.removeItem(key),
});

export const sessionStore = wrap(sessionStorage);
export const localStore = wrap(localStorage);
