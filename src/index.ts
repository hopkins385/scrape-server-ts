// @ts-nocheck
import express from "express";
import TurndownService from "turndown";
import { getPageContents } from "./browser";

const app = express();
const port = 3010;

const turndownService = new TurndownService();

app.get("/scrape", async (req: any, res: any) => {
  console.log("Scraping page...");
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
    console.error(error);
    res.status(500).send("An error occurred while scraping the page");
  }
});

app.listen(port, () => {
  console.log(`Scraping API is listening at http://localhost:${port}`);
});
