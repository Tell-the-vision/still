// Web authenticates with the HttpOnly cookie, so there are no tokens to keep.
export const tokenStorage = {
  getAccessToken: async (): Promise<string | null> => null,
  getRefreshToken: async (): Promise<string | null> => null,
  save: async (_tokens: { accessToken: string; refreshToken: string }) => {},
  clear: async () => {},
};
