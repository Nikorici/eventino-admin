import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EventForm, type EventFormInitialValues, type EventFormSubmit } from './EventForm';

jest.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { id: 1 } }, theme: { preference: 'light' } }),
  useAppDispatch: () => jest.fn(),
}));

jest.mock('@/store/api/eventsApi', () => ({
  useGetCategoriesQuery: () => ({ data: [{ id: 1, name: 'Concert', slug: 'concert' }], isLoading: false }),
}));

jest.mock('@/store/api/usersApi', () => ({
  useLazyGetOrganizationsQuery: () => [jest.fn()],
}));

jest.mock('@/lib/places', () => ({
  createPlacesSessionToken: () => 'session',
  fetchPlacePredictions: jest.fn(async () => []),
  fetchPlaceDetails: jest.fn(async () => null),
}));

jest.mock('@react-native-community/datetimepicker', () => () => null);

jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///picked.jpg', fileName: 'picked.jpg', width: 800, height: 600, mimeType: 'image/jpeg' }],
  })),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: jest.fn(),
      renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///picked-compressed.jpg' }) }),
    }),
  },
}));

const existingImage = { id: 55, uri: 'https://cdn.test/old.jpg', name: 'image-55.jpg', type: 'image/jpeg' };

function initialValues(): EventFormInitialValues {
  return {
    title: 'Form Night',
    description: 'A night to edit.',
    category: 1,
    type: 'PUBLIC',
    currency: 'RON',
    startDate: '2030-05-01',
    startTime: '20:00',
    endDate: '2030-05-01',
    endTime: '23:00',
    eventLocationType: 'physical',
    locationTba: false,
    country: 'Romania',
    region: 'Cluj',
    address: 'Strada Test 1',
    coordinates: { lat: 46.7, long: 23.6 },
    inDraft: false,
    media: [{ kind: 'image', image: existingImage }],
    tickets: [
      {
        id: 9,
        name: 'General',
        price: 0,
        quantity: null,
        comment: '',
        isFree: true,
        saleStartDate: null,
        saleEndDate: null,
        isActive: true,
        qrCodeQuantity: 1,
        showRemainingTickets: false,
        isTable: false,
      },
    ],
    questions: [],
    timelines: [],
    organizers: [],
    coupons: [],
  };
}

jest.setTimeout(30000);

describe('EventForm time to be announced', () => {
  it('lets an organizer hide the hour and submits a midnight start', async () => {
    const onSubmit = jest.fn<void, [EventFormSubmit]>();
    render(<EventForm mode="edit" initialValues={{ ...initialValues(), startTime: '', endTime: '' }} submitting={false} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('Time is TBA'));
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ time_is_tba: true, start_time: '00:00', end_time: '' });
  });

  it('still requires the hours when the time is known', async () => {
    const onSubmit = jest.fn<void, [EventFormSubmit]>();
    render(<EventForm mode="edit" initialValues={{ ...initialValues(), startTime: '', endTime: '' }} submitting={false} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(screen.getByText('Select a start time')).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('EventForm media editing', () => {
  it('keeps a removed photo removed when initial values are recomputed and submits only the new one', async () => {
    const onSubmit = jest.fn<void, [EventFormSubmit]>();
    const { rerender } = render(
      <EventForm mode="edit" initialValues={initialValues()} submitting={false} onSubmit={onSubmit} />,
    );

    fireEvent.press(screen.getByLabelText('Remove'));
    expect(screen.queryByLabelText('Remove')).toBeNull();

    rerender(<EventForm mode="edit" initialValues={initialValues()} submitting={false} onSubmit={onSubmit} />);
    expect(screen.queryByLabelText('Remove')).toBeNull();

    fireEvent.press(screen.getByLabelText('Upload images'));
    await waitFor(() => expect(screen.getByLabelText('Remove')).toBeTruthy());

    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].media).toEqual([
      { kind: 'image', image: { id: null, uri: 'file:///picked-compressed.jpg', name: 'picked.jpg', type: 'image/jpeg' } },
    ]);
  });
});

describe('EventForm ticket event day', () => {
  it('lets a multi-day event pin a ticket type to one day', async () => {
    const onSubmit = jest.fn<void, [EventFormSubmit]>();
    render(<EventForm mode="edit" initialValues={{ ...initialValues(), endDate: '2030-05-02' }} submitting={false} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText(/^Day 2 · /));
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].tickets[0]).toMatchObject({ event_day: '2030-05-02' });
  });

  it('drops the day when the event is a single day', async () => {
    const onSubmit = jest.fn<void, [EventFormSubmit]>();
    const values = initialValues();
    render(
      <EventForm
        mode="edit"
        initialValues={{ ...values, tickets: (values.tickets ?? []).map((ticket) => ({ ...ticket, eventDay: '2030-05-01' })) }}
        submitting={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByText('All days')).toBeNull();
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].tickets[0]).toMatchObject({ event_day: null });
  });
});
