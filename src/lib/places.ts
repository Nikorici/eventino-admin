import { GEOAPIFY_API_KEY } from './constants';

const AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

export interface PlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  description: string;
}

export interface PlaceDetails {
  address: string;
  country: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

interface GeoapifyPlace {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
}

const lastPlaces = new Map<string, GeoapifyPlace>();

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

function toPlaceId(place: GeoapifyPlace): string {
  return place.place_id ?? `${place.lat},${place.lon}`;
}

export async function fetchPlacePredictions(input: string, signal?: AbortSignal): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const url = `${AUTOCOMPLETE_URL}?${query({
    text: trimmed,
    limit: '5',
    lang: 'en',
    format: 'json',
    apiKey: GEOAPIFY_API_KEY,
  })}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return [];
    const data = (await response.json()) as { results?: GeoapifyPlace[] };
    const places = (data.results ?? []).filter((place) => place.lat != null && place.lon != null);
    lastPlaces.clear();
    places.forEach((place) => lastPlaces.set(toPlaceId(place), place));
    return places.map((place) => ({
      placeId: toPlaceId(place),
      primaryText: place.name ?? place.address_line1 ?? place.formatted ?? '',
      secondaryText: place.address_line2 ?? '',
      description: place.formatted ?? place.address_line1 ?? '',
    }));
  } catch {
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const place = lastPlaces.get(placeId);
  if (!place) return null;
  return {
    address: place.formatted ?? place.name ?? '',
    country: place.country ?? '',
    city: place.city ?? place.county ?? place.state ?? '',
    latitude: place.lat ?? null,
    longitude: place.lon ?? null,
  };
}
