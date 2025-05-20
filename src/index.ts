// @ts-nocheck
import express from "express";
import TurndownService from "turndown";
import { getPageContents } from "./browser";
import { config } from "./config";
import consola from "consola";
import { bodySchema } from "./validation";

const logger = consola
  .create({
    level: config.debug ? 5 : 3,
  })
  .withTag("Api");

const app = express();

const turndownService = new TurndownService();

app.get("/scrape", async (req: any, res: any) => {
  logger.info("Scraping page...");
  const validation = bodySchema.safeParse(req.query);
  if (!validation.success) {
    logger.error("Validation error:", validation.error);
    return res.status(400).send("Invalid URL");
  }
  const { url } = validation.data;
  logger.info("URL:", url);
  if (!url) {
    logger.error("URL is required");
    return res.status(400).send("URL is required");
  }
  const charLimit = 10000;

  try {
    const { meta, bodyHtml } = await getPageContents(url);
    let pageContentMarkdown = turndownService.turndown(bodyHtml);
    if (pageContentMarkdown.length > charLimit) {
      pageContentMarkdown = pageContentMarkdown.substring(0, charLimit);
    }
    const removeEmptyLines = pageContentMarkdown.replace(/^\s*[\r\n]/gm, "");

    res.send({
      meta,
      body: removeEmptyLines,
    });
    //
  } catch (error) {
    logger.error(error);
    res.status(500).send("An error occurred while scraping the page");
  }
});

const server = app.listen(config.port, () => {
  console.log(`Scraping API is listening at http://localhost:${config.port}`);
});

// server.setTimeout(config.server.timeout * 1000);
// server.on("timeout", () => {
//   logger.warn("Server timeout");
// });
server.on("error", (error) => {
  logger.error("Server error:", error);
});
server.on("close", () => {
  logger.info("Server closed");
});
