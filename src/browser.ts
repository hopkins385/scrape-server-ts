import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import blockResources from "puppeteer-extra-plugin-block-resources";
import anonymize from "puppeteer-extra-plugin-anonymize-ua";
import consola from "consola";
import { config } from "./config";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(
  blockResources({
    blockedTypes: new Set(["image", "stylesheet", "font"]),
  })
);
puppeteer.use(anonymize());

const logger = consola
  .create({
    level: config.debug ? 5 : 3,
  })
  .withTag("Browser");

const defaultTimeout: number = config.browser.timeout * 1000;
const defaultBodyLoadTimeout: number = config.browser.bodyLoadTimeout * 1000;

export async function getPageContents(url: string) {
  let browser: Browser | undefined;
  try {
    // Launch a new browser instance
    browser = await puppeteer.launch({
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
    page.setDefaultNavigationTimeout(defaultTimeout);
    await page.setViewport({ width: 800, height: 600 });

    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest) => {
      if (interceptedRequest.isInterceptResolutionHandled()) return;

      switch (interceptedRequest.resourceType()) {
        case "script":
        case "xhr":
        case "fetch":
          interceptedRequest.continue();
          break;
        case "document":
          interceptedRequest.continue();
          break;
        default:
          interceptedRequest.abort();
          break;
      }
    });

    browser.on("targetcreated", async (target) => {
      const pageTarget = await target.page();
      if (pageTarget && target.type() === "page") {
        await pageTarget.close();
      }
    });

    logger.info("Navigating to", url);

    try {
      // Navigate to the target URL
      await page.goto(url, {
        waitUntil: ["domcontentloaded", "networkidle2"],
      });
    } catch (e) {
      throw new Error(
        `Navigation failed for ${url}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    const isLoaded = await page.evaluate(() => {
      return document.readyState === "complete";
    });
    if (!isLoaded) {
      throw new Error(
        `Page ${url} did not load completely (document.readyState was not 'complete').`
      );
    }

    logger.info("Page loaded");

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    const bodySelector = "body";

    await page.waitForSelector(bodySelector, {
      timeout: defaultBodyLoadTimeout,
    });

    logger.info("Body selector found");

    const meta = await getMetaInfo(page);

    // remove unwanted elements
    await page.evaluate(() => {
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

    // Successfully completed operations, close browser before returning
    if (browser && browser.connected) {
      await browser.close();
      logger.info("Browser closed on successful completion.");
    }

    return { meta, bodyHtml };
  } catch (error) {
    // logger.error(`Error in getPageContents for url "${url}":`, error);
    // The finally block will attempt to close the browser.
    // Re-throw a new error to signal failure to the caller.
    throw new Error(
      `Failed to get page contents for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    if (browser && browser.connected) {
      try {
        await browser.close();
        logger.info("Browser closed in finally block.");
      } catch (closeError) {
        // logger.error("Error closing browser in finally block:", closeError);
        // Optionally, re-throw or handle this specific error,
        // but the original error from the try/catch block is usually more critical.
        throw closeError;
      }
    }
  }
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
