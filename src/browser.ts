import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import blockResources from "puppeteer-extra-plugin-block-resources";
import anonymize from "puppeteer-extra-plugin-anonymize-ua";
import consola from "consola";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(
  blockResources({
    blockedTypes: new Set(["image", "stylesheet", "font"]),
  })
);
puppeteer.use(anonymize());

const logger = consola.create({}).withTag("Browser");

export async function pageGetContents(url: string) {
  // Launch a new browser instance
  const browser = await puppeteer.launch({
    // executablePath: puppeteer.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // "--disable-dev-shm-usage",
      // "--disable-gpu",
      // "--incognito",
      // "--disable-client-side-phishing-detection",
      // "--disable-software-rasterizer",
    ],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000); // 2 minutes
  await page.setViewport({ width: 800, height: 600 });

  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    if (interceptedRequest.isInterceptResolutionHandled()) return;
    if (
      interceptedRequest.resourceType() === "script" ||
      interceptedRequest.resourceType() === "xhr" ||
      interceptedRequest.resourceType() === "fetch"
    ) {
      interceptedRequest.continue();
    } else if (interceptedRequest.resourceType() !== "document") {
      interceptedRequest.abort();
    } else {
      interceptedRequest.continue();
    }
  });

  browser.on("targetcreated", async (target) => {
    const page = await target.page();
    if (page && target.type() === "page") {
      await page.close();
    }
  });

  logger.info("Navigating to", url);

  // Navigate to the target URL
  await page.goto(url, {
    // waitUntil: "networkidle0",
    waitUntil: "networkidle2",
  });

  const isLoaded = await page.evaluate(() => {
    return document.readyState === "complete";
  });
  if (!isLoaded) {
    logger.error("Page did not fully load");
    // You might want to retry or handle this case
    throw new Error("Page did not fully load");
  }

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const bodySelector = "body";

  await page.waitForSelector(bodySelector);

  const meta = await getMetaInfo(page);

  // remove unwanted elements
  const re = await page.evaluate(() => {
    // Remove unwanted elements
    const elements = document.querySelectorAll("body *");

    for (const element of elements) {
      const style = getComputedStyle(element);

      if (
        style.position === "fixed" ||
        style.position === "sticky" ||
        style.position === "absolute"
      ) {
        if (element.clientHeight > 0 && element.clientWidth > 0) {
          element.remove();
        }
      }

      // script
      if (element.matches("script")) {
        element.remove();
      }

      if (element.matches("footer, .footer, #footer")) {
        element.remove();
      }

      if (element.matches("header, .header, #header")) {
        element.remove();
      }

      if (element.matches("nav, .nav, #nav")) {
        element.remove();
      }

      if (element.matches("banner, .banner, #banner")) {
        element.remove();
      }

      if (element.matches("aside, .aside, #aside")) {
        element.remove();
      }

      if (element.matches("sidebar, .sidebar, #sidebar")) {
        element.remove();
      }

      // Remove iframes and other embedded elements
      if (
        element.matches("iframe, video, audio, object, embed") ||
        element.tagName.toLowerCase() === "iframe"
      ) {
        element.remove();
      }
    }
  });

  // etract html for markdown conversion
  const bodyHtml = await page.$eval(bodySelector, (body) => {
    // Check for custom elements with content attribute
    const customElements = body.querySelectorAll("[content]");
    customElements.forEach((element) => {
      element.innerHTML = element.getAttribute("content") ?? "";
    });

    // check for custom elements with text attribute
    const textElements = body.querySelectorAll("[text]");
    textElements.forEach((element) => {
      element.innerHTML = element.getAttribute("text") ?? "";
    });

    return body.innerHTML;
  });

  await browser.close();

  return { meta, bodyHtml };
}

async function getMetaInfo(page: Page) {
  const meta: { [key: string]: string | null } = {};
  const metaTags = await page.$$("meta");
  for (const tag of metaTags) {
    const name = await tag.evaluate((node) => node.getAttribute("name"));
    const property = await tag.evaluate((node) =>
      node.getAttribute("property")
    );
    const content = await tag.evaluate((node) => node.getAttribute("content"));

    if (name) {
      meta[name] = content;
    } else if (property) {
      meta[property] = content;
    }
  }

  // filter and keep only the meta tags we want
  const allowedMetaTags = [
    "title",
    "description",
    "keywords",
    "og:title",
    "og:description",
    "og:site_name",
    "og:type",
    "og:locale",
  ];

  const filteredMeta = Object.keys(meta)
    .filter((key) => allowedMetaTags.includes(key))
    .reduce((obj: { [key: string]: string | null }, key) => {
      obj[key] = meta[key];
      return obj;
    }, {} as { [key: string]: string | null });

  return filteredMeta;
}
