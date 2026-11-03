import v1 from "./content-image-cleanup";

// Same exhibition without the "Detail" image and its description block.
const [exhibition] = v1.exhibitions;
const pkg = {
  ...v1,
  exhibitions: [{ ...exhibition, description: { version: 1 as const, blocks: [] }, images: exhibition.images?.slice(0, 1) }],
};

export default pkg;
