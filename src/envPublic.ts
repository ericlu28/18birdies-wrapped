export function getPublicMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error("Missing NEXT_PUBLIC_MAPBOX_TOKEN. Add it to your .env (see env.example).");
  }
  return token;
}

