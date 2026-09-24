import type { MetadataProvider } from "./types";
import { JikanProvider } from "./jikan";
import { MALProvider } from "./mal";

export type { MetadataProvider, SearchOptions } from "./types";
export * from "./types";
export { JikanProvider } from "./jikan";
export { MALProvider, malAuthHeaders } from "./mal";

export const providers = {
  jikan: new JikanProvider(),
  mal: new MALProvider(),
} as const;

export function getMetadataProvider(): MetadataProvider {
  const configured = (process.env.METADATA_PROVIDER ?? "jikan").toLowerCase();
  const provider = providers[configured as keyof typeof providers] ?? providers.jikan;
  return provider;
}