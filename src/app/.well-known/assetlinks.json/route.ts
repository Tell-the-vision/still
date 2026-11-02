// SPEC §0.1: Android app links. Empty until the signing fingerprint is configured.
export function GET() {
  const fingerprint = process.env.ANDROID_CERT_SHA256;
  if (!fingerprint) return Response.json([]);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: process.env.ANDROID_PACKAGE ?? "app.still.placeholder",
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ]);
}
