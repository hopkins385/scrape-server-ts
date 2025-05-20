import puppeteer from "puppeteer-extra";
import { Browser, Page, HTTPRequest, Target, Dialog } from "puppeteer"; // Import types from puppeteer
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
  .withTag("BrowserService"); // Changed tag to BrowserService

export class BrowserService {
  private browser: Browser | undefined;
  private page: Page | undefined;
  private defaultTimeout: number = config.browser.timeout * 1000;
  private defaultBodyLoadTimeout: number =
    config.browser.bodyLoadTimeout * 1000;

  constructor() {}

  public async getPageContents(url: string) {
    try {
      // Launch a new browser instance
      this.browser = await puppeteer.launch({
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

      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(this.defaultTimeout);
      await this.page.setViewport({ width: 800, height: 600 });

      await this.page.setRequestInterception(true);
      this.page.on("request", (interceptedRequest: HTTPRequest) => {
        // Added type HTTPRequest
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

      this.browser.on("targetcreated", async (target: Target) => {
        // Added type Target
        const pageTarget = await target.page();
        if (pageTarget && target.type() === "page") {
          await pageTarget.close();
        }
      });

      logger.info("Navigating to", url);

      try {
        // Navigate to the target URL
        await this.page.goto(url, {
          waitUntil: ["domcontentloaded", "networkidle2"],
        });
      } catch (e) {
        throw new Error(
          `Navigation failed for ${url}: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }

      const isLoaded = await this.page.evaluate(() => {
        return document.readyState === "complete";
      });
      if (!isLoaded) {
        throw new Error(
          `Page ${url} did not load completely (document.readyState was not 'complete').`
        );
      }

      logger.info("Page loaded");

      this.page.on("dialog", async (dialog: Dialog) => {
        // Added type Dialog
        await dialog.accept();
      });

      const bodySelector = "body";

      await this.page.waitForSelector(bodySelector, {
        timeout: this.defaultBodyLoadTimeout,
      });

      logger.info("Body selector found");

      const meta = await this.getMetaInfo(this.page);

      // remove unwanted elements
      await this.page.evaluate(() => {
        // Remove unwanted elements
        const elements = document.querySelectorAll("body *");

        for (const element of elements) {
          const style = getComputedStyle(element as HTMLElement); // Added type assertion

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
            (element as HTMLElement).tagName.toLowerCase() === "iframe" // Added type assertion
          ) {
            element.remove();
          }
        }
      });

      // etract html for markdown conversion
      const bodyHtml = await this.page.$eval(bodySelector, (body: Element) => {
        // Added type Element
        // Check for custom elements with content attribute
        const customElements = body.querySelectorAll("[content]");
        customElements.forEach((element: Element) => {
          // Added type Element
          element.innerHTML = element.getAttribute("content") ?? "";
        });

        // check for custom elements with text attribute
        const textElements = body.querySelectorAll("[text]");
        textElements.forEach((element: Element) => {
          // Added type Element
          element.innerHTML = element.getAttribute("text") ?? "";
        });

        return (body as HTMLElement).innerHTML; // Added type assertion
      });

      // Successfully completed operations, close browser before returning
      if (this.browser && this.browser.connected) {
        await this.browser.close();
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
      if (this.browser && this.browser.connected) {
        try {
          await this.browser.close();
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

  private async getMetaInfo(page: Page) {
    const meta: { [key: string]: string | null } = {};
    const metaTags = await page.$$("meta");
    for (const tag of metaTags) {
      const name = await tag.evaluate((node: Element) =>
        node.getAttribute("name")
      ); // Added type Element
      const property = await tag.evaluate(
        (
          node: Element // Added type Element
        ) => node.getAttribute("property")
      );
      const content = await tag.evaluate((node: Element) =>
        node.getAttribute("content")
      ); // Added type Element

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
}
