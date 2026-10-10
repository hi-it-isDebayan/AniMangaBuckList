export function publicBaseUrl(): string {
  const v = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (v) return v;
  return "https://animanga.debayandas.in";
}