export const designTokens = {
  color: {
    background: "#f5f6f8",
    surface: "#ffffff",
    surfaceMuted: "#fafbfc",
    topRegionBg: "#111827",
    topRegionText: "#f9fafb",
    topRegionTextMuted: "#9ca3af",
    topRegionBorder: "#1f2937",
    textPrimary: "#1f2329",
    textSecondary: "#4b5563",
    textTertiary: "#6b7280",
    border: "#e5e7eb",
    borderStrong: "#d1d5db",
    primary: "#2563eb",
    focusRing: "rgba(37, 99, 235, 0.2)"
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
    16: "16px"
  },
  shadow: {
    level1: "0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)",
    level2: "0 4px 16px rgba(15, 23, 42, 0.08)"
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
  colorInfo: designTokens.color.primary,
  colorText: designTokens.color.textPrimary,
  colorTextSecondary: designTokens.color.textSecondary,
  colorTextDescription: designTokens.color.textTertiary,
  colorBgBase: designTokens.color.background,
  colorBgLayout: designTokens.color.background,
  colorBgContainer: designTokens.color.surface,
  colorFillAlter: designTokens.color.surfaceMuted,
  colorBorder: designTokens.color.border,
  borderRadius: 12,
  borderRadiusSM: 8,
  borderRadiusLG: 16,
  lineWidth: 1,
  boxShadow: designTokens.shadow.level2,
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
    headerBg: designTokens.color.surface,
    siderBg: designTokens.color.surface,
    triggerBg: designTokens.color.surface
  },
  Card: {
    borderRadiusLG: 12,
    boxShadow: designTokens.shadow.level1,
    bodyPadding: 16,
    headerPadding: 16,
    headerHeight: 48
  },
  Menu: {
    itemHeight: 40,
    itemPaddingInline: 12,
    itemMarginInline: 8,
    itemMarginBlock: 4,
    itemBorderRadius: 8,
    activeBarHeight: 0
  },
  Button: {
    controlHeight: 40,
    borderRadius: 8,
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
