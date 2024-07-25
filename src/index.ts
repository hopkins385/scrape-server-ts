// @ts-nocheck
import express, { raw } from "express";
import TurndownService from "turndown";
import { pageGetContents } from "./browser";

const app = express();
const port = 3010;

const turndownService = new TurndownService();

app.get("/scrape", async (req: any, res: any) => {
  const url = req.query.url as string;

  try {
    const pageContents = await pageGetContents(url);
    const pageContentMarkdown = turndownService.turndown(pageContents);
    const removeEmptyLines = pageContentMarkdown.replace(/^\s*[\r\n]/gm, "");
    res.send({
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
