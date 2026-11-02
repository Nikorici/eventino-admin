import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { QuestionType } from '@/types/api';

export function OptionIndicator({ type, index }: { type: QuestionType; index: number }) {
  if (type === 'dropdown') {
    return <AppText className="font-gilroy-semibold text-[11px] text-muted dark:text-dark-muted">{index + 1}.</AppText>;
  }
  return (
    <View
      className={cn(
        'h-2.5 w-2.5 border-[1.5px] border-muted',
        type === 'checkboxes' ? 'rounded-[2px]' : 'rounded-full',
      )}
    />
  );
}
