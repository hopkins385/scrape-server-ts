// @ts-nocheck
import express from "express";
import TurndownService from "turndown";
import { getPageContents } from "./browser";
import { config } from "./config";
import consola from "consola";

const logger = consola
  .create({
    level: config.debug ? 5 : 3,
  })
  .withTag("Api");

const app = express();

const turndownService = new TurndownService();

app.get("/scrape", async (req: any, res: any) => {
  logger.info("Scraping page...");
  const url = req.query.url as string;
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

app.listen(config.port, () => {
  console.log(`Scraping API is listening at http://localhost:${config.port}`);
});
