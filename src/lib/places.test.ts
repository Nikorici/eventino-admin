import { fetchPlaceDetails, fetchPlacePredictions } from './places';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body });

const radisson = {
  place_id: 'radisson-cluj',
  name: 'Radisson Blu',
  formatted: 'Radisson Blu, Aleea Stadionului 1, 400114 Cluj-Napoca, Romania',
  address_line1: 'Radisson Blu',
  address_line2: 'Aleea Stadionului 1, 400114 Cluj-Napoca, Romania',
  city: 'Cluj-Napoca',
  country: 'Romania',
  lat: 46.7681,
  lon: 23.5718,
};

describe('places', () => {
  it('lists Geoapify suggestions and reads the picked one without another request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [radisson, { formatted: 'No coordinates' }] }));

    const predictions = await fetchPlacePredictions('Radisson Cluj');

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'https://api.geoapify.com/v1/geocode/autocomplete?text=Radisson%20Cluj',
    );
    expect(predictions).toEqual([
      {
        placeId: 'radisson-cluj',
        primaryText: 'Radisson Blu',
        secondaryText: 'Aleea Stadionului 1, 400114 Cluj-Napoca, Romania',
        description: radisson.formatted,
      },
    ]);
    expect(await fetchPlaceDetails('radisson-cluj')).toEqual({
      address: radisson.formatted,
      country: 'Romania',
      city: 'Cluj-Napoca',
      latitude: 46.7681,
      longitude: 23.5718,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips short input, and returns nothing on a rejected key or an unknown suggestion', async () => {
    expect(await fetchPlacePredictions('Ra')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    expect(await fetchPlacePredictions('Radisson')).toEqual([]);
    expect(await fetchPlaceDetails('unknown')).toBeNull();
  });
});
