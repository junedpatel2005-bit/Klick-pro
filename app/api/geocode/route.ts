import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const userKey = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";

type GoogleGeocodingResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; short_name: string; types: string[] }[];
};

type GeocodeResult = {
  address: string;
  lat: number;
  lon: number;
  state: string | null;
  city: string | null;
  district: string | null;
};

function extractAddressComponent(
  components: GoogleGeocodingResult["address_components"],
  type: string,
): string | null {
  return components.find((component) => component.types.includes(type))?.long_name ?? null;
}

function mapGoogleResult(result: GoogleGeocodingResult): GeocodeResult {
  const components = result.address_components ?? [];
  return {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
    state: extractAddressComponent(components, "administrative_area_level_1"),
    city:
      extractAddressComponent(components, "locality") ??
      extractAddressComponent(components, "postal_town") ??
      extractAddressComponent(components, "sublocality_level_1") ??
      extractAddressComponent(components, "administrative_area_level_3") ??
      extractAddressComponent(components, "administrative_area_level_2"),
    district:
      extractAddressComponent(components, "administrative_area_level_2") ??
      extractAddressComponent(components, "administrative_area_level_3"),
  };
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`geocode:${userKey(request)}`, 20, 60_000))
    return NextResponse.json({ error: "Please wait before searching again." }, { status: 429 });
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  if (!query && (!lat || !lon)) return NextResponse.json({ results: [] });

  const serverKey =
    process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!serverKey) {
    return NextResponse.json(
      { error: "Address search is not configured on the server." },
      { status: 503 },
    );
  }

  const url = query
    ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${serverKey}`
    : `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lon}`)}&key=${serverKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Geocoding service unavailable");
    const data = (await response.json()) as {
      status: string;
      results: GoogleGeocodingResult[];
      error_message?: string;
    };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(data.error_message ?? `Geocoding failed: ${data.status}`);
    }
    return NextResponse.json({
      results: data.results.map(mapGoogleResult),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Address search timed out. Please try again or enter the address manually."
          : "Address search is unavailable. You can still enter an address manually.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
