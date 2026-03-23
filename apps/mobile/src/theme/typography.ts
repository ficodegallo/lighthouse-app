import { TextStyle } from 'react-native';

/**
 * Typography system.
 * PRD requirement: minimum 18pt body text, rounded humanist sans-serif.
 * Using system fonts that approximate Nunito/Poppins feel on iOS.
 */
export const fontFamily = {
  // iOS: San Francisco (rounded variant)
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const fontSize = {
  xs: 14,
  sm: 16,
  base: 18,   // PRD minimum body size
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const typography: Record<string, TextStyle> = {
  /** Primary body text — min 18pt per PRD */
  body: {
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
    fontWeight: '400',
  },
  bodyLarge: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
    fontWeight: '400',
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    fontWeight: '500',
  },
  /** Section titles */
  title: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    fontWeight: '700',
  },
  /** Screen headings */
  heading: {
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    fontWeight: '700',
  },
  /** Hero text on briefing screen */
  display: {
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    fontWeight: '800',
  },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    fontWeight: '400',
  },
};
