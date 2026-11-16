import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { OtpBoxes } from './OtpBoxes';

jest.mock('@/components/ui', () => ({ AppText: jest.requireActual('react-native').Text }));

describe('OtpBoxes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clears the stale focus before refocusing when the keyboard was dismissed', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    await render(<OtpBoxes value="12" onChange={jest.fn()} />);

    await fireEvent.press(screen.getByText('1'));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves an open keyboard alone', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    await render(<OtpBoxes value="12" onChange={jest.fn()} />);

    await fireEvent.press(screen.getByText('1'));

    expect(dismiss).not.toHaveBeenCalled();
  });
});
