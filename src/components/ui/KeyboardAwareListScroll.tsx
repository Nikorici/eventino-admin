import type { ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export function KeyboardAwareListScroll(props: ScrollViewProps) {
  return <KeyboardAwareScrollView {...props} bottomOffset={24} />;
}
