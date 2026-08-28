import { useEffect } from "react";

const DRIVER_MANIFEST = "/driver.webmanifest";
const DRIVER_TITLE = "BMC Driver";

/** While /conductor is mounted, use the Driver PWA manifest. Restore on leave. */
export default function useDriverManifest() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let link = document.querySelector('link[rel="manifest"]');
    const created = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    const prevHref = link.getAttribute("href");
    link.setAttribute("href", DRIVER_MANIFEST);

    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const prevApple = apple?.getAttribute("content");
    apple?.setAttribute("content", DRIVER_TITLE);

    const prevTitle = document.title;
    document.title = DRIVER_TITLE;

    return () => {
      if (created) link.remove();
      else if (prevHref) link.setAttribute("href", prevHref);
      if (apple && prevApple != null) apple.setAttribute("content", prevApple);
      document.title = prevTitle;
    };
  }, []);
}
