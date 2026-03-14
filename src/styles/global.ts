import { createGlobalStyle } from "styled-components";
import { designTokens } from "./tokens";

const t = designTokens;

export const GlobalStyle = createGlobalStyle`
  :root {
    --color-bg: ${t.color.background};
    --color-surface: ${t.color.surface};
    --color-surface-muted: ${t.color.surfaceMuted};
    --color-top-region-bg: ${t.color.topRegionBg};
    --color-top-region-text: ${t.color.topRegionText};
    --color-top-region-text-muted: ${t.color.topRegionTextMuted};
    --color-top-region-border: ${t.color.topRegionBorder};
    --color-text-primary: ${t.color.textPrimary};
    --color-text-secondary: ${t.color.textSecondary};
    --color-text-tertiary: ${t.color.textTertiary};
    --color-border: ${t.color.border};
    --color-border-strong: ${t.color.borderStrong};
    --color-primary: ${t.color.primary};
    --color-focus-ring: ${t.color.focusRing};

    --space-4: ${t.spacing[4]};
    --space-8: ${t.spacing[8]};
    --space-12: ${t.spacing[12]};
    --space-16: ${t.spacing[16]};
    --space-24: ${t.spacing[24]};
    --space-32: ${t.spacing[32]};
    --space-40: ${t.spacing[40]};
    --space-48: ${t.spacing[48]};

    --radius-8: ${t.radius[8]};
    --radius-12: ${t.radius[12]};
    --radius-16: ${t.radius[16]};

    --shadow-1: ${t.shadow.level1};
    --shadow-2: ${t.shadow.level2};

    --font-32: ${t.typography[32].size};
    --font-24: ${t.typography[24].size};
    --font-20: ${t.typography[20].size};
    --font-16: ${t.typography[16].size};
    --font-14: ${t.typography[14].size};
    --font-12: ${t.typography[12].size};

    --lh-32: ${t.typography[32].lineHeight};
    --lh-24: ${t.typography[24].lineHeight};
    --lh-20: ${t.typography[20].lineHeight};
    --lh-16: ${t.typography[16].lineHeight};
    --lh-14: ${t.typography[14].lineHeight};
    --lh-12: ${t.typography[12].lineHeight};
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: var(--color-bg);
    min-height: 100vh;
    color: var(--color-text-primary);
    font-size: var(--font-14);
    line-height: var(--lh-14);
  }

  #root {
    min-height: 100vh;
  }

  .type-32 {
    font-size: var(--font-32);
    line-height: var(--lh-32);
    font-weight: ${t.typography[32].weight};
  }

  .type-24 {
    font-size: var(--font-24);
    line-height: var(--lh-24);
    font-weight: ${t.typography[24].weight};
  }

  .type-20 {
    font-size: var(--font-20);
    line-height: var(--lh-20);
    font-weight: ${t.typography[20].weight};
  }

  .type-16 {
    font-size: var(--font-16);
    line-height: var(--lh-16);
    font-weight: ${t.typography[16].weight};
  }

  .type-14 {
    font-size: var(--font-14);
    line-height: var(--lh-14);
    font-weight: ${t.typography[14].weight};
  }

  .type-12 {
    font-size: var(--font-12);
    line-height: var(--lh-12);
    font-weight: ${t.typography[12].weight};
  }

  .card-info {
    margin: 0;
    font-size: var(--font-14);
    line-height: var(--lh-14);
    color: var(--color-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ant-card .ant-card-body .ant-typography.ant-typography-secondary {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ant-card .ant-list .ant-list-item .ant-typography {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ant-card {
    border-color: var(--color-border);
    box-shadow: var(--shadow-1);
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .ant-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-2);
  }

  .ant-btn,
  .ant-input,
  .ant-select-selector,
  .ant-menu-item,
  .ant-tag {
    transition: all 160ms ease;
  }

  .ant-select-focused .ant-select-selector,
  .ant-input:focus,
  .ant-input-affix-wrapper:focus,
  .ant-input-affix-wrapper-focused,
  .ant-btn:focus-visible,
  .ant-menu-item:focus-visible,
  a:focus-visible {
    box-shadow: 0 0 0 var(--space-4) var(--color-focus-ring);
  }
`;
