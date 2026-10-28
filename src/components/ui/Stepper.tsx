import { View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function Stepper({ value, onChange, min = 0, max = Infinity, className }: StepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  const update = (next: number) => {
    haptics.selection();
    onChange(next);
  };

  return (
    <View className={cn('h-10 flex-row items-center gap-3', className)}>
      <PressableScale
        onPress={() => canDecrement && update(value - 1)}
        disabled={!canDecrement}
        accessibilityLabel="Decrease quantity"
        className={cn('h-9 w-9 items-center justify-center rounded-full bg-primary-light', !canDecrement && 'opacity-30')}
      >
        <Minus size={18} color="#ffffff" />
      </PressableScale>
      <AppText className="min-w-6 text-center font-gilroy-semibold text-base">{value}</AppText>
      <PressableScale
        onPress={() => canIncrement && update(value + 1)}
        disabled={!canIncrement}
        accessibilityLabel="Increase quantity"
        className={cn('h-9 w-9 items-center justify-center rounded-full bg-primary-light', !canIncrement && 'opacity-30')}
      >
        <Plus size={18} color="#ffffff" />
      </PressableScale>
    </View>
  );
}
