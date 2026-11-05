import published from "./content-status-flip";

const [exhibition] = published.exhibitions;
const pkg = { ...published, exhibitions: [{ ...exhibition, state: "UNPUBLISHED" as const }] };

export default pkg;
