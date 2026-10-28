import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

export type AppTextProps = TextProps & {
  className?: string;
};

export function AppText({ className, ...props }: AppTextProps) {
  return <Text className={cn('font-gilroy text-primary dark:text-dark-text', className)} {...props} />;
}
