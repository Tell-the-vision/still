import published from "./content-status-flip";

const [exhibition] = published.exhibitions;
const pkg = { ...published, exhibitions: [{ ...exhibition, status: "DRAFT" as const }] };

export default pkg;
