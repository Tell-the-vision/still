// SPEC §0.1: iOS universal links open /e/* in the app.
export function GET() {
  const appID = `${process.env.APPLE_TEAM_ID ?? ""}.${process.env.IOS_BUNDLE_ID ?? "app.still.placeholder"}`;
  return Response.json({ applinks: { details: [{ appIDs: [appID], components: [{ "/": "/e/*" }] }] } });
}
