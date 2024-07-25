import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import blockResources from "puppeteer-extra-plugin-block-resources";
import anonymize from "puppeteer-extra-plugin-anonymize-ua";

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(
  blockResources({
    blockedTypes: new Set(["image", "stylesheet", "font"]),
  })
);
puppeteer.use(anonymize());

export async function pageGetContents(url: string) {
  // Launch a new browser instance
  const browser = await puppeteer.launch({
    // executablePath: puppeteer.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--incognito",
      "--disable-client-side-phishing-detection",
      "--disable-software-rasterizer",
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

  // Navigate to the target URL
  await page.goto(url, {
    waitUntil: "networkidle0",
  });

  const isLoaded = await page.evaluate(() => {
    return document.readyState === "complete";
  });
  if (!isLoaded) {
    console.log("Page did not fully load");
    // You might want to retry or handle this case
    throw new Error("Page did not fully load");
  }

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const bodySelector = "body";

  await page.waitForSelector(bodySelector);

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

  return bodyHtml;
}
