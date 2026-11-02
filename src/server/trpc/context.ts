// getSession is added by the auth work packages; public procedures never
// read cookies (SPEC §11.1).
export function createContext(req: Request, resHeaders: Headers) {
  return { req, resHeaders };
}

export type Context = ReturnType<typeof createContext>;
