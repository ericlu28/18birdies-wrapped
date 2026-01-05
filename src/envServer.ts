import "server-only";

export function getGoogleGeocodingApiKey(): string {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) {
    throw new Error("Missing GOOGLE_GEOCODING_API_KEY. Add it to your .env (see env.example).");
  }
  return key;
}

