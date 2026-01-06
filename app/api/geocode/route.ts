import { NextResponse } from "next/server";
import { getGoogleGeocodingApiKey } from "../../../src/envServer";
import { Client } from "@googlemaps/google-maps-services-js";
import { getGeocodeCacheByClubId, upsertGeocodeCacheHit, upsertGeocodeCacheMissing } from "../../../src/geocodeCacheDb";

export const runtime = "nodejs";

const client = new Client({});

const COURSE_NAME_REPLACEMENTS = [" at "] as const;

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

  const name = typeof body.name === "string" ? cleanCourseName(body.name) : "";
  if (!name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const clubId = typeof body.clubId === "string" ? body.clubId.trim() : "";
  if (!clubId) {
    return NextResponse.json({ error: "Missing required field: clubId" }, { status: 400 });
  }

  const cached = getGeocodeCacheByClubId(clubId);
  if (cached?.kind === "hit") {
    return NextResponse.json({
      clubId,
      name: cached.name ?? name,
      lat: cached.lat,
      lng: cached.lng,
      formattedAddress: cached.formattedAddress,
      placeId: cached.placeId,
      cached: true,
    });
  }
  if (cached?.kind === "missing") {
    return NextResponse.json({ error: "No geocoding results (cached)" }, { status: 404 });
  }

  const key = getGoogleGeocodingApiKey();

  let data: GoogleGeocodeResponse;
  try {
    const gcResponse = await client.geocode({
      params: {
        key,
        address: name,
      },
    });
    data = gcResponse.data as unknown as GoogleGeocodeResponse;
  } catch {
    return NextResponse.json({ error: "Failed to call Google Geocoding API" }, { status: 502 });
  }

  if (!data.results?.length) {
    upsertGeocodeCacheMissing({ clubId, name });
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

  upsertGeocodeCacheHit({
    clubId,
    name,
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address ?? null,
    placeId: first.place_id ?? null,
  });

  return NextResponse.json({
    clubId,
    name,
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address ?? null,
    placeId: first.place_id ?? null,
    cached: false,
  });
}

// clean name private method
function cleanCourseName(courseName: string) {
  const trimmed = courseName.trim();
  let replaced = trimmed;
  for (const needle of COURSE_NAME_REPLACEMENTS) {
    replaced = replaced.replaceAll(needle, " ");
  }
  return replaced;
}

