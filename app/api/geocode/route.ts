import { NextResponse } from "next/server";
import { getGoogleGeocodingApiKey } from "../../../src/envServer";

type GeocodeRequestBody = {
  clubId?: string;
  name?: string;
};

type GoogleGeocodeResponse = {
  results: Array<{
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?: { lat: number; lng: number };
    };
  }>;
  status?: string;
  error_message?: string;
};

export async function POST(req: Request) {
  let body: GeocodeRequestBody;
  try {
    body = (await req.json()) as GeocodeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const key = getGoogleGeocodingApiKey();

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", name);
  url.searchParams.set("key", key);

  let data: GoogleGeocodeResponse;
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      // Avoid accidental caching of API responses by intermediaries
      cache: "no-store",
    });

    data = (await res.json()) as GoogleGeocodeResponse;
  } catch {
    return NextResponse.json({ error: "Failed to call Google Geocoding API" }, { status: 502 });
  }

  if (!data.results?.length) {
    return NextResponse.json(
      { error: "No geocoding results", status: data.status ?? null, message: data.error_message ?? null },
      { status: 404 },
    );
  }

  const first = data.results[0]!;
  const loc = first.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return NextResponse.json({ error: "Geocoding result missing lat/lng" }, { status: 502 });
  }

  return NextResponse.json({
    clubId: body.clubId ?? null,
    name,
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address ?? null,
    placeId: first.place_id ?? null,
  });
}

