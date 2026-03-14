import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import { GlobalStyle } from "./styles/global";
import { antdComponentTokens, antdThemeToken } from "./styles/tokens";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: antdThemeToken,
        components: antdComponentTokens
      }}
    >
      <BrowserRouter>
        <GlobalStyle />
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
