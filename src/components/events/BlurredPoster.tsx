import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { CalendarDays } from 'lucide-react-native';

import { cn } from '@/lib/cn';

export interface BlurredPosterProps {
  uri: string | null;
  className?: string;
  blurRadius?: number;
  iconSize?: number;
  transition?: number;
  recyclingKey?: string | null;
  priority?: 'low' | 'normal' | 'high';
}

export function BlurredPoster({ uri, className, blurRadius = 24, iconSize = 32, transition = 250, recyclingKey, priority = 'normal' }: BlurredPosterProps) {
  return (
    <View className={cn('relative overflow-hidden bg-card-sm dark:bg-dark-elevated', className)}>
      {uri ? (
        <>
          <Image
            source={{ uri }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={recyclingKey}
            priority={priority}
            blurRadius={blurRadius}
            transition={transition}
            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.15 }] }]}
          />
          <View pointerEvents="none" style={StyleSheet.absoluteFill} className="bg-black/5 dark:bg-black/25" />
          <Image
            source={{ uri }}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={recyclingKey}
            priority={priority}
            transition={transition}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <View className="h-full w-full items-center justify-center">
          <CalendarDays size={iconSize} color="#8a8d93" />
        </View>
      )}
    </View>
  );
}
