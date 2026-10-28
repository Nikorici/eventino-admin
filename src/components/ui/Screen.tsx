import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  edges?: Edge[];
}

export function Screen({ children, className, edges = ['top'] }: ScreenProps) {
  return (
    <View className="flex-1 bg-app-bg dark:bg-dark-bg">
      <SafeAreaView edges={edges} className={cn('flex-1', className)}>
        {children}
      </SafeAreaView>
    </View>
  );
}
