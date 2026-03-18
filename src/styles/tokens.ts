export const designTokens = {
  color: {
    background: "#f2f6fc",
    backgroundAccent: "#edf3fc",
    surface: "#ffffff",
    surfaceMuted: "#f6f9ff",
    surfaceGlass: "rgba(255, 255, 255, 0.94)",
    topRegionBg: "#0b1220",
    topRegionBgEnd: "#1a2438",
    topRegionText: "#f5f8ff",
    topRegionTextMuted: "rgba(245, 248, 255, 0.96)",
    topRegionBorder: "rgba(255, 255, 255, 0.12)",
    textPrimary: "#1c2438",
    textSecondary: "#253752",
    textTertiary: "#344965",
    border: "#dce4f2",
    borderStrong: "#aebdd7",
    primary: "#1b63f0",
    primaryHover: "#174fbe",
    primarySoft: "rgba(27, 99, 240, 0.12)",
    success: "#138a6a",
    warning: "#ca7d1a",
    danger: "#cb3f5b",
    focusRing: "rgba(27, 99, 240, 0.3)"
  },
  spacing: {
    4: "4px",
    8: "8px",
    12: "12px",
    16: "16px",
    24: "24px",
    32: "32px",
    40: "40px",
    48: "48px"
  },
  radius: {
    8: "8px",
    12: "12px",
    16: "16px",
    20: "20px"
  },
  shadow: {
    level1: "0 2px 8px rgba(14, 30, 62, 0.06), 0 1px 2px rgba(14, 30, 62, 0.06)",
    level2: "0 10px 26px rgba(14, 30, 62, 0.12)",
    level3: "0 18px 42px rgba(14, 30, 62, 0.16)"
  },
  typography: {
    32: { size: "32px", lineHeight: "40px", weight: 600 },
    24: { size: "24px", lineHeight: "32px", weight: 600 },
    20: { size: "20px", lineHeight: "28px", weight: 600 },
    16: { size: "16px", lineHeight: "24px", weight: 500 },
    14: { size: "14px", lineHeight: "20px", weight: 400 },
    12: { size: "12px", lineHeight: "16px", weight: 400 }
  }
} as const;

export const antdThemeToken = {
  colorPrimary: designTokens.color.primary,
  colorPrimaryHover: designTokens.color.primaryHover,
  colorInfo: designTokens.color.primary,
  colorText: designTokens.color.textPrimary,
  colorTextSecondary: designTokens.color.textSecondary,
  colorTextDescription: designTokens.color.textTertiary,
  colorBgBase: designTokens.color.background,
  colorBgLayout: designTokens.color.background,
  colorBgContainer: designTokens.color.surface,
  colorFillAlter: designTokens.color.surfaceMuted,
  colorBorderSecondary: designTokens.color.border,
  colorBorder: designTokens.color.border,
  controlOutline: designTokens.color.focusRing,
  colorSuccess: designTokens.color.success,
  colorWarning: designTokens.color.warning,
  colorError: designTokens.color.danger,
  borderRadius: 12,
  borderRadiusSM: 8,
  borderRadiusLG: 20,
  lineWidth: 1,
  boxShadow: designTokens.shadow.level2,
  boxShadowSecondary: designTokens.shadow.level1,
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeHeading1: 32,
  fontSizeHeading2: 24,
  fontSizeHeading3: 20,
  fontSizeHeading4: 16,
  fontSizeHeading5: 14,
  lineHeight: 20 / 14,
  lineHeightSM: 16 / 12,
  lineHeightLG: 24 / 16,
  lineHeightHeading1: 40 / 32,
  lineHeightHeading2: 32 / 24,
  lineHeightHeading3: 28 / 20,
  lineHeightHeading4: 24 / 16,
  lineHeightHeading5: 20 / 14
} as const;

export const antdComponentTokens = {
  Layout: {
    bodyBg: designTokens.color.background,
    headerBg: "transparent",
    siderBg: "transparent",
    triggerBg: designTokens.color.surface
  },
  Card: {
    borderRadiusLG: 16,
    boxShadow: designTokens.shadow.level1,
    bodyPadding: 16,
    headerPadding: 16,
    headerHeight: 48
  },
  Menu: {
    itemHeight: 40,
    itemPaddingInline: 14,
    itemMarginInline: 8,
    itemMarginBlock: 5,
    itemBorderRadius: 10,
    activeBarHeight: 0,
    itemColor: "#2d3a57",
    itemHoverBg: "rgba(27, 99, 240, 0.08)",
    itemHoverColor: designTokens.color.primaryHover,
    itemSelectedBg: designTokens.color.primarySoft,
    itemSelectedColor: designTokens.color.primary
  },
  Button: {
    controlHeight: 40,
    borderRadius: 10,
    paddingInline: 16,
    fontWeight: 500
  },
  Input: {
    controlHeight: 40,
    borderRadius: 8,
    paddingInline: 12
  },
  Select: {
    controlHeight: 40,
    optionHeight: 40
  },
  Drawer: {
    colorBgElevated: designTokens.color.surface
  },
  Typography: {
    titleMarginTop: 24,
    titleMarginBottom: 16
  }
} as const;
