const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? 'AIzaSyAofdX32Vre8EjCDweLdVHPqOUUTMkZeP0';
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

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

interface AutocompleteResponse {
  status: string;
  predictions?: {
    place_id: string;
    description: string;
    structured_formatting?: { main_text?: string; secondary_text?: string };
  }[];
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface DetailsResponse {
  status: string;
  result?: {
    formatted_address?: string;
    name?: string;
    address_components?: AddressComponent[];
    geometry?: { location?: { lat: number; lng: number } };
  };
}

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

export function createPlacesSessionToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export async function fetchPlacePredictions(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const url = `${AUTOCOMPLETE_URL}?${query({
    input: trimmed,
    key: PLACES_API_KEY,
    language: 'en',
    sessiontoken: sessionToken,
  })}`;

  try {
    const response = await fetch(url, { signal });
    const data = (await response.json()) as AutocompleteResponse;
    if (data.status !== 'OK' || !Array.isArray(data.predictions)) return [];
    return data.predictions.map((prediction) => ({
      placeId: prediction.place_id,
      primaryText: prediction.structured_formatting?.main_text ?? prediction.description,
      secondaryText: prediction.structured_formatting?.secondary_text ?? '',
      description: prediction.description,
    }));
  } catch {
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails | null> {
  const url = `${DETAILS_URL}?${query({
    place_id: placeId,
    key: PLACES_API_KEY,
    language: 'en',
    sessiontoken: sessionToken,
    fields: 'formatted_address,address_components,geometry,name',
  })}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as DetailsResponse;
    if (data.status !== 'OK' || !data.result) return null;

    const components = data.result.address_components ?? [];
    const componentByType = (type: string): string =>
      components.find((component) => component.types.includes(type))?.long_name ?? '';

    const city =
      componentByType('locality') ||
      componentByType('postal_town') ||
      componentByType('administrative_area_level_2') ||
      componentByType('administrative_area_level_1');

    return {
      address: data.result.formatted_address ?? data.result.name ?? '',
      country: componentByType('country'),
      city,
      latitude: data.result.geometry?.location?.lat ?? null,
      longitude: data.result.geometry?.location?.lng ?? null,
    };
  } catch {
    return null;
  }
}
