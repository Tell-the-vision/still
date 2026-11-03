// SPEC §0.1: Android app links. Empty until the signing fingerprint is configured.
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return Response.json([]);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: process.env.ANDROID_PACKAGE ?? "gdg.still.app",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
