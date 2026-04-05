export function ensureBrandIcons(iconHref = "/favicon.ico") {
  const links = [
    { rel: "icon", type: "image/png" },
    { rel: "apple-touch-icon", type: undefined },
  ] as const;

  links.forEach(({ rel, type }) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }

    if (type) link.type = type;
    link.href = iconHref;
  });
}
