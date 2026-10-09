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
  DARK_SLATE: '#183225',
  TEAL: '#14746F',
  ERROR_RED: '#BE3030',
  WARNING_ORANGE: '#96500A',
  OFF_WHITE: '#F6F9F7',
  DISABLED_GREY: '#53675B',
  BORDER: '#D6E2D9',
  INPUT_BACKGROUND: '#F0F5F1',
  BUTTON_BACKGROUND: '#236B46',
  ON_PRIMARY: '#FFFFFF',
  INVERSE_TEXT: '#FFFFFF',
  HERO_BACKGROUND: '#173D2D',
  SUCCESS_SURFACE: '#E4F4E9',
  WARNING_SURFACE: '#FFF2D5',
  ERROR_SURFACE: '#FCE9E8',
  INFO_SURFACE: '#E0F2EF',
  DISABLED_BACKGROUND: '#E2E8E3',
  BANNER_ERROR: '#A92727',
  BANNER_WARNING: '#8C4908',
  BANNER_INFO: '#126761',
};

export type ThemeColors = {[Key in keyof typeof LIGHT_COLORS]: string};

export const DARK_COLORS: ThemeColors = {
  ...LIGHT_COLORS,
  FOREST_GREEN: '#80E5AC',
  DARK_SLATE: '#EDF7F0',
  TEAL: '#75D9D0',
  ERROR_RED: '#FF9898',
  WARNING_ORANGE: '#F4BB71',
  OFF_WHITE: '#0D1712',
  CARD_WHITE: '#18261E',
  DISABLED_GREY: '#A5B8AA',
  BORDER: '#35493D',
  INPUT_BACKGROUND: '#112018',
  BUTTON_BACKGROUND: '#236B46',
  HERO_BACKGROUND: '#132C20',
  SUCCESS_SURFACE: '#193D2A',
  WARNING_SURFACE: '#3A2D18',
  ERROR_SURFACE: '#3F2425',
  INFO_SURFACE: '#183735',
  DISABLED_BACKGROUND: '#2B3D31',
};
