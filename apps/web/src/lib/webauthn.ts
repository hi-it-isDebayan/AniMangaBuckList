export function webauthnRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? "animanga.debayandas.in";
}

export function webauthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? "AniManga BuckList";
}

export function webauthnOrigins(): string[] {
  const raw = process.env.WEBAUTHN_ORIGINS;
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["https://animanga.debayandas.in"];
}