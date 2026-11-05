// In-memory PlatformApi for building screens without a backend. State resets on reload.
import { AccountNotIssuedError, ApiError } from "./errors";
import type { Institution, InstitutionStatus, PlatformApi } from "./types";

const wait = <T,>(value: T, ms = 150): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(value)), ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// The first five rows are the ones in Figma 09; the counts match its metric cards (24 / 18 active / 3 pending / 3 suspended).
const SEED: [name: string, code: string, email: string, status: InstitutionStatus, created: string, lastActiveDays: number | null][] = [
  ["Seoul Museum of Art", "SEO", "admin@sema.kr", "ACTIVE", "2026-08-12", 0],
  ["National Museum of Modern Art", "MMCA", "digital@mmca.go.kr", "ACTIVE", "2026-08-18", 1],
  ["Busan Museum of Art", "BMA", "web@bma.or.kr", "PENDING", "2026-09-02", null],
  ["Daegu Art Museum", "DAM", "admin@dam.or.kr", "ACTIVE", "2026-09-14", 2],
  ["Incheon Art Platform", "IAP", "hello@iap.or.kr", "SUSPENDED", "2026-09-21", 34],
  ["Gwangju Museum of Art", "GMA", "curator@gma.or.kr", "ACTIVE", "2026-09-23", 0],
  ["Daejeon Museum of Art", "DMA", "info@dma.go.kr", "ACTIVE", "2026-09-25", 3],
  ["Ulsan Art Museum", "UAM", "digital@uam.go.kr", "ACTIVE", "2026-09-28", 1],
  ["Jeonbuk Museum of Art", "JMA", "admin@jma.go.kr", "PENDING", "2026-09-30", null],
  ["Gyeonggi Museum of Modern Art", "GMOMA", "web@gmoma.ggcf.kr", "ACTIVE", "2026-10-01", 5],
  ["Suwon Museum of Art", "SMA", "admin@suwon.go.kr", "ACTIVE", "2026-10-03", 0],
  ["Jeju Museum of Art", "JEJU", "art@jeju.go.kr", "ACTIVE", "2026-10-06", 8],
  ["Leeum Museum of Art", "LEEUM", "digital@leeum.org", "ACTIVE", "2026-10-08", 2],
  ["Amorepacific Museum of Art", "APMA", "museum@apma.kr", "SUSPENDED", "2026-10-10", 21],
  ["Arko Art Center", "ARKO", "center@arko.or.kr", "ACTIVE", "2026-10-13", 4],
  ["Seoul Arts Center", "SAC", "hangaram@sac.or.kr", "ACTIVE", "2026-10-15", 1],
  ["Busan Museum of Contemporary Art", "MOCA", "web@moca.busan.kr", "ACTIVE", "2026-10-17", 6],
  ["Gyeongnam Art Museum", "GAM", "admin@gam.go.kr", "PENDING", "2026-10-20", null],
  ["Chungbuk Arts Center", "CAC", "info@cbart.or.kr", "ACTIVE", "2026-10-22", 3],
  ["Pohang Museum of Steel Art", "POMA", "art@poma.kr", "ACTIVE", "2026-10-24", 0],
  ["Gangneung Art Center", "GAC", "admin@gn.go.kr", "SUSPENDED", "2026-10-27", 9],
  ["Ansan Arts Center", "AAC", "web@ansanart.com", "ACTIVE", "2026-10-29", 2],
  ["Cheongju Museum of Art", "CMA", "admin@cmoa.go.kr", "ACTIVE", "2026-11-01", 1],
  ["Sejong Art Center", "SJAC", "hello@sjac.or.kr", "ACTIVE", "2026-11-03", 0],
];

export function createMockApi(): PlatformApi {
  // Starts signed in so the screens open directly; ?signedOut (or Sign out) shows the temporary sign-in screen.
  let signedIn = !new URLSearchParams(window.location.search).has("signedOut");
  const me = { email: "admin@still.app", role: "SUPER_ADMIN" as const, mustChangePassword: false };
  const db: Institution[] = SEED.map(([name, code, adminEmail, status, created, last], i) => ({
    id: `inst-${i + 1}`,
    publicId: `STL-${code}-${String(i + 1).padStart(4, "0")}`,
    name, adminEmail, status,
    createdAt: `${created}T09:00:00+09:00`,
    lastActiveAt: last === null ? null : daysAgo(last),
  }));
  const find = (id: string) => {
    const hit = db.find((x) => x.id === id);
    if (!hit) throw new ApiError("Institution not found.", "NOT_FOUND");
    return hit;
  };

  const impl: PlatformApi = {
    async signIn(email, password) {
      // Mock credentials: any email, any password except "wrong".
      if (!email.trim() || password === "wrong") { await wait(undefined, 400); throw new ApiError("Email or password is incorrect.", "UNAUTHORIZED"); }
      signedIn = true;
      return wait(me, 400);
    },
    async signOut() { signedIn = false; return wait(undefined, 200); },
    getMe: () => wait(me),
    listInstitutions: () => wait(db),
    async createInstitution({ name, code, adminName, adminEmail }) {
      const c = code.trim().toUpperCase();
      if (!name.trim()) throw new ApiError("Enter the institution name.", "BAD_REQUEST");
      if (!/^[A-Z]{2,6}$/.test(c)) throw new ApiError("Short code: 2–6 letters (A–Z).", "BAD_REQUEST");
      if (!adminName.trim()) throw new ApiError("Enter the workspace admin name.", "BAD_REQUEST");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) throw new ApiError("Enter a valid admin email.", "BAD_REQUEST");
      if (db.some((x) => x.name.toLowerCase() === name.trim().toLowerCase())) throw new ApiError("An institution with this name already exists.", "CONFLICT");
      // The number is a platform-wide sequence, so an ID is never reused even after a code repeats.
      const next = Math.max(0, ...db.map((x) => Number(x.publicId.split("-").pop()))) + 1;
      const created: Institution = {
        id: `inst-${Date.now()}`,
        publicId: `STL-${c}-${String(next).padStart(4, "0")}`,
        name: name.trim(), adminEmail: "—", status: "PENDING",
        createdAt: new Date().toISOString(), lastActiveAt: null,
      };
      db.push(created);
      // Like the server, the account step can fail after the institution exists.
      try {
        return await impl.issueWorkspaceAdmin(created, { adminName, adminEmail });
      } catch (e) {
        throw new AccountNotIssuedError(e instanceof Error ? e.message : String(e), structuredClone(created), "LOGIN_ID_TAKEN");
      }
    },
    async issueWorkspaceAdmin(institution, { adminEmail }) {
      const email = adminEmail.trim();
      if (db.some((x) => x.adminEmail.toLowerCase() === email.toLowerCase())) throw new ApiError("This email already signs in to another account.", "CONFLICT", "LOGIN_ID_TAKEN");
      const inst = find(institution.id);
      inst.adminEmail = email;
      return wait({ institution: inst, temporaryPassword: "mock-Temp-Pass-42" }, 400);
    },
    async setInstitutionStatus(id, status) {
      const inst = find(id);
      // Reactivating someone who never accepted the invite puts them back to PENDING, not ACTIVE.
      inst.status = status === "ACTIVE" && inst.lastActiveAt === null ? "PENDING" : status;
      return wait(inst, 300);
    },
    async resendInvite(id) {
      if (find(id).status !== "PENDING") throw new ApiError("Only pending institutions have an open invitation.", "BAD_REQUEST");
      return wait(undefined, 300);
    },
  };

  // Same as the server: everything except signing in needs a STILL staff session.
  return new Proxy(impl, {
    get(target, key: keyof PlatformApi) {
      const fn = target[key] as (...args: unknown[]) => Promise<unknown>;
      if (key === "signIn") return fn;
      return (...args: unknown[]) => (signedIn ? fn(...args) : Promise.reject(new ApiError("Sign in to continue.", "UNAUTHORIZED")));
    },
  });
}
