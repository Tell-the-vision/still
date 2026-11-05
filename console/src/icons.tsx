// Heroicons v2, 24px outline (MIT, https://heroicons.com): the few icons the console uses, drawn at the library's
// 1.5 stroke so they read as one set.
const outline = { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", "aria-hidden": true } as const;

export const DevicePhoneMobileIcon = () => (
  <svg {...outline}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
);

export const XMarkIcon = () => (
  <svg {...outline}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
);
