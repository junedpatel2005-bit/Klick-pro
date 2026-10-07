const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "caption",
  "col",
  "colgroup",
  "em",
  "h2",
  "h3",
  "h4",
  "li",
  "ol",
  "p",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const allowedAttributes = new Set(["href", "target", "rel", "colspan", "rowspan"]);

export function sanitizeCmsHtml(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      const attributes = rawAttributes.replace(
        /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        (
          attribute: string,
          rawName: string,
          doubleValue?: string,
          singleValue?: string,
          bareValue?: string,
        ) => {
          const name = rawName.toLowerCase();
          if (!allowedAttributes.has(name)) return "";
          const value = doubleValue ?? singleValue ?? bareValue ?? "";
          if (name === "href" && !/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return "";
          if (name === "target" && !["_blank", "_self"].includes(value)) return "";
          return ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
        },
      );
      return `<${tag}${attributes}>`;
    })
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}
