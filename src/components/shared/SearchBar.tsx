import { forwardRef } from 'react';
import { TextInput, View } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { cn } from '@/lib/cn';
import { AppText } from '@/components/ui/AppText';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { PressableScale } from '@/components/ui/PressableScale';

export interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onPress?: () => void;
  onSubmit?: () => void;
  onFilterPress?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { value, onChangeText, onPress, onSubmit, onFilterPress, editable = true, autoFocus, placeholder = 'Search events', className },
  ref,
) {
  const isDark = useColorScheme() === 'dark';
  const actionColor = isDark ? '#f9f9f9' : '#2b3a44';

  const content = (
    <GlassSurface className="h-12 flex-row items-center gap-2.5 rounded-glass px-4">
      <Search size={18} color="#8a8d93" />
      {editable && !onPress ? (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          returnKeyType="search"
          placeholder={placeholder}
          placeholderTextColor="#8a8d93"
          textAlignVertical="center"
          style={{ includeFontPadding: false }}
          className="h-full flex-1 font-gilroy text-[16px] text-primary dark:text-dark-text"
        />
      ) : (
        <View className="flex-1 justify-center">
          <AppText numberOfLines={1} className={cn('font-gilroy text-base', value ? 'text-primary dark:text-dark-text' : 'text-muted')}>
            {value || placeholder}
          </AppText>
        </View>
      )}
      {onFilterPress ? (
        <PressableScale onPress={onFilterPress} accessibilityLabel="Filters" hitSlop={8} className="h-8 w-8 items-center justify-center">
          <SlidersHorizontal size={18} color={actionColor} />
        </PressableScale>
      ) : null}
    </GlassSurface>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel="Search" className={cn('w-full', className)}>
        {content}
      </PressableScale>
    );
  }
  return <View className={cn('w-full', className)}>{content}</View>;
});
