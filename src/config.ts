require("dotenv").config();

export interface Config {
  debug: boolean;
  port: number;
  browser: {
    timeout: number;
    bodyLoadTimeout: number;
  };
}

export const config: Config = {
  debug: process.env.APP_DEBUG === "true",
  port: parseInt(process.env.APP_PORT || "3000"),
  browser: {
    timeout: parseInt(process.env.BROWSER_TIMEOUT || "5"),
    bodyLoadTimeout: parseInt(process.env.BROWSER_BODY_LOAD_TIMEOUT || "5"),
  },
};
