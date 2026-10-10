// TerraTrust AR — Design System Color Tokens (SRS Section 17.2; FDD Section 9.2)

export const COLORS = {
  FOREST_GREEN: '#2F855A', // primary green (buttons, key actions)
  DARK_SLATE: '#2D3748', // primary text
  TEAL: '#38B2AC', // accent/teal (zone markers, highlights)
  ERROR_RED: '#E53E3E', // error states
  WARNING_ORANGE: '#DD6B20', // warning/pending states
  OFF_WHITE: '#F7FAFC', // screen backgrounds
  CARD_WHITE: '#FFFFFF', // card backgrounds
  DISABLED_GREY: '#A0AEC0', // disabled elements
};

export const LIGHT_COLORS = {
  ...COLORS,
  FOREST_GREEN: '#236B46',
  DARK_SLATE: '#202124',
  TEAL: '#14746F',
  ERROR_RED: '#BE3030',
  WARNING_ORANGE: '#96500A',
  OFF_WHITE: '#F8F9FA',
  DISABLED_GREY: '#60646C',
  BORDER: '#DDDFE3',
  INPUT_BACKGROUND: '#F2F3F5',
  BUTTON_BACKGROUND: '#236B46',
  ON_PRIMARY: '#FFFFFF',
  INVERSE_TEXT: '#FFFFFF',
  HERO_BACKGROUND: '#202124',
  SUCCESS_SURFACE: '#E4F4E9',
  WARNING_SURFACE: '#FFF2D5',
  ERROR_SURFACE: '#FCE9E8',
  INFO_SURFACE: '#E0F2EF',
  DISABLED_BACKGROUND: '#E5E7EB',
  BANNER_ERROR: '#A92727',
  BANNER_WARNING: '#8C4908',
  BANNER_INFO: '#126761',
};

export type ThemeColors = { [Key in keyof typeof LIGHT_COLORS]: string };

export const DARK_COLORS: ThemeColors = {
  ...LIGHT_COLORS,
  FOREST_GREEN: '#75D79A',
  DARK_SLATE: '#F4F4F5',
  TEAL: '#75D9D0',
  ERROR_RED: '#FF9898',
  WARNING_ORANGE: '#F4BB71',
  OFF_WHITE: '#000000',
  CARD_WHITE: '#151515',
  DISABLED_GREY: '#AAAAB2',
  BORDER: '#333333',
  INPUT_BACKGROUND: '#202020',
  BUTTON_BACKGROUND: '#236B46',
  HERO_BACKGROUND: '#101010',
  SUCCESS_SURFACE: '#14281D',
  WARNING_SURFACE: '#302519',
  ERROR_SURFACE: '#342023',
  INFO_SURFACE: '#182B30',
  DISABLED_BACKGROUND: '#2A2A2A',
};
