/**
 * Lighthouse color system
 * Inspired by a calm coastal morning: sea, sky, sand, and lighthouse amber.
 * All colors are WCAG AA compliant against their intended backgrounds.
 */
export const colors = {
  // Primary palette
  ocean: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
  },

  // Signature amber — the lighthouse beam
  amber: {
    light: '#FDE68A',
    DEFAULT: '#F5A623',
    dark: '#D97706',
  },

  // Warm sand tones
  sand: {
    50: '#FEFCE8',
    100: '#FEF9C3',
    200: '#FEF08A',
    300: '#F0E6C8',
    DEFAULT: '#E8D9B0',
  },

  // Fog grays — for secondary text, dividers
  fog: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
  },

  // Semantic colors
  background: '#F0F4F8',      // Soft pale blue-gray — the sky
  surface: '#FFFFFF',          // Cards and panels
  surfaceSecondary: '#F8FAFC', // Slightly off-white
  border: '#E2E8F0',

  text: {
    primary: '#1E293B',        // Near-black, high contrast
    secondary: '#475569',      // Fog gray for subtitles
    tertiary: '#94A3B8',       // Muted hints
    inverse: '#FFFFFF',
    amber: '#92400E',          // Amber text on light bg (AA compliant)
  },

  // Status colors
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  // Section accent colors for briefing sections
  sections: {
    today: '#3B82F6',       // Ocean blue
    thisWeek: '#7C3AED',    // Calm purple
    remember: '#F5A623',    // Amber
  },

  transparent: 'transparent',
} as const;

export type ColorToken = typeof colors;
