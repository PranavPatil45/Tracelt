import React, { useLayoutEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LogoIcon from "./src/components/auth/LogoIcon"; // Adjust path as needed

export const DynamicFavicon = () => {
  useLayoutEffect(() => {
    // 1. Render the SVG component to a static XML string
    const svgString = renderToStaticMarkup(<LogoIcon size={500} />);

    // 2. Format as a valid Data URI
    const faviconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    // 3. Locate existing link tag or append a new one
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    link.type = "image/svg+xml";
    link.href = faviconUrl;
  }, []);

  return null;
};
