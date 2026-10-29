import { Text as RNText, type TextProps } from 'react-native';

import { Type, type ThemeColor, type TypeVariant } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

export type TextTone = Extract<ThemeColor, 'ink' | 'body' | 'mute' | 'danger' | 'accentText' | 'onPrimary' | 'canvas'>;

/**
 * Text in one of the type-scale variants and a theme tone. `style` is for layout (flex, margins,
 * alignment); size, weight and color come from `variant` and `tone`.
 */
export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: TextTone }) {
  const theme = useTheme();
  return <RNText {...rest} style={[Type[variant], { color: theme[tone] }, style]} />;
}
