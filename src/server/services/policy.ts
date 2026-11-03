// Current policy versions and public URLs come from the environment (SPEC §2.2 Consent).
const env = (name: string) => process.env[name] ?? "";

export const currentPolicy = () => ({ termsVersion: env("TERMS_VERSION"), termsUrl: env("TERMS_URL"), privacyVersion: env("PRIVACY_VERSION"), privacyUrl: env("PRIVACY_URL") });
