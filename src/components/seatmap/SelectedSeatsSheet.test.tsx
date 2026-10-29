import { fireEvent, render, screen } from '@testing-library/react-native';

import { holdSeat } from '@/lib/seating/testFixtures';

import { SelectedSeatsList } from './SelectedSeatsSheet';

jest.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ theme: { preference: 'light' } }),
  useAppDispatch: () => jest.fn(),
}));

const seatA = holdSeat(101, 7, '900.00');
const seatB = holdSeat(201, 8, '500.50', { section_id: 2, section_key: 'balcon', section_name: 'Balcon', seat_label: '1' });

async function renderList(seats = [seatA, seatB], overrides: Partial<React.ComponentProps<typeof SelectedSeatsList>> = {}) {
  const props = {
    seats,
    currency: 'MDL',
    remainingSeconds: 125,
    continueDisabled: false,
    onRemove: jest.fn(),
    onClear: jest.fn(),
    onContinue: jest.fn(),
    ...overrides,
  };
  await render(<SelectedSeatsList {...props} />);
  return props;
}

describe('SelectedSeatsList', () => {
  it('lists every seat with its price and the running total', async () => {
    await renderList();
    expect(screen.getByText('Parter · Row 1, seat 1')).toBeTruthy();
    expect(screen.getByText('Balcon · Row 1, seat 1')).toBeTruthy();
    expect(screen.getByText('Parter · 900 MDL')).toBeTruthy();
    expect(screen.getByText('Balcon · 500.50 MDL')).toBeTruthy();
    expect(screen.getByText('2 seats selected')).toBeTruthy();
    expect(screen.getByText('1400.50 MDL')).toBeTruthy();
    expect(screen.getByText('2:05')).toBeTruthy();
  });

  it('removes a seat, clears the selection and continues', async () => {
    const props = await renderList();
    await fireEvent.press(screen.getByLabelText('Remove seat Balcon · Row 1, seat 1'));
    expect(props.onRemove).toHaveBeenCalledWith(201);
    await fireEvent.press(screen.getByLabelText('Clear selection'));
    expect(props.onClear).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state and keeps continue disabled without seats', async () => {
    const props = await renderList([], { continueDisabled: true, remainingSeconds: null });
    expect(screen.getByText('No seats selected yet')).toBeTruthy();
    expect(screen.getByText('0 MDL')).toBeTruthy();
    expect(screen.queryByLabelText('Clear selection')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(props.onContinue).not.toHaveBeenCalled();
  });
});
