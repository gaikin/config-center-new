import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: radial-gradient(1200px 500px at 0% 0%, #fef3e2 0%, #f6f8fc 45%, #eef3ff 100%);
    min-height: 100vh;
    color: #1f2937;
  }

  #root {
    min-height: 100vh;
  }
`;
