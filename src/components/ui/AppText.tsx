import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

export type AppTextProps = TextProps & {
  className?: string;
};

const NON_COLOR_TEXT = /^text-(xs|sm|base|lg|\d?xl|left|center|right|justify|start|end|ellipsis|clip|wrap|nowrap|balance|pretty|\[\d)/;

function overrides(className: string | undefined, variant: string) {
  const tokens = (className ?? '').split(/\s+/);
  const plain = tokens.filter((token) => token.startsWith(variant)).map((token) => token.slice(variant.length));
  return {
    color: plain.some((token) => token.startsWith('text-') && !NON_COLOR_TEXT.test(token)),
    font: plain.some((token) => token.startsWith('font-gilroy')),
  };
}

export function AppText({ className, ...props }: AppTextProps) {
  const light = overrides(className, '');
  const dark = overrides(className, 'dark:');
  return (
    <Text
      className={cn(
        !light.font && 'font-gilroy',
        !light.color && 'text-primary',
        !dark.color && 'dark:text-dark-text',
        className,
      )}
      {...props}
    />
  );
}
