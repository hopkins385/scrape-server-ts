require("dotenv").config();

export interface Config {
  debug: boolean;
  port: number;
  browser: {
    timeout: number;
    bodyLoadTimeout: number;
  };
  server: {
    timeout: number;
  };
}

export const config: Config = {
  debug: process.env.APP_DEBUG === "true",
  port: parseInt(process.env.APP_PORT || "3000"),
  browser: {
    timeout: parseInt(process.env.BROWSER_TIMEOUT || "25"),
    bodyLoadTimeout: parseInt(process.env.BROWSER_BODY_LOAD_TIMEOUT || "10"),
  },
  server: {
    timeout: parseInt(process.env.SERVER_TIMEOUT || "30"),
  },
};
