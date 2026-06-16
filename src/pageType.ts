import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  QuartzPageTypePlugin,
  QuartzPageTypePluginInstance,
} from "@quartz-community/types";

/** Frontmatter `type` value can be a wikilink string, a plain string, or a list. */
type RawType = unknown;

/**
 * Normalize a frontmatter `type` value into a stable, CSS-friendly slug.
 *
 * Obsidian stores the note type as a wikilink string, e.g. `"[[Coffee Beans]]"`,
 * sometimes with an alias/heading (`"[[Place|Cities]]"`, `"[[Note#X]]"`) or as a
 * single-element list. We strip the wikilink wrapper, drop alias/anchor, then
 * lowercase + hyphenate so `"[[Coffee Beans]]"` → `"coffee-beans"`.
 *
 * Returns `null` when there is no usable type (so the link keeps the default color).
 */
export const normalizeType = (raw: RawType): string | null => {
  const value: unknown = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return null;
  }

  let text = value.trim();
  const wikilinkMatch = text.match(/^\[\[([^\]]+)\]\]$/);
  if (wikilinkMatch?.[1]) {
    text = wikilinkMatch[1];
  }

  // Drop a `|alias` or `#heading` suffix from the wikilink target.
  const target = text.replace(/[|#].*$/, "").trim();
  if (!target) {
    return null;
  }

  return target.toLowerCase().replace(/\s+/g, "-");
};

/** HAST class list normalized to a string array regardless of source shape. */
const classListOf = (node: Element): string[] => {
  const existing = node.properties?.className;
  if (Array.isArray(existing)) {
    return existing.filter((c): c is string => typeof c === "string");
  }
  return typeof existing === "string" ? [existing] : [];
};

const INTERNAL_LINK_CLASS = "internal";
const LINK_TYPE_ATTR = "data-link-type";
const SLUG_ATTR = "data-slug";

/**
 * Render-time HAST transform: tag each *published* internal link with the
 * `type` of the note it points to, exposed as `data-link-type`. Arbor's CSS
 * maps each type slug to its Catppuccin color; links to typeless notes (no
 * attribute) keep the default accent, and broken links keep their grey
 * `.broken` styling from crawl-links.
 *
 * `componentData.allFiles` is the post-publish-filter file set, so only
 * published targets get a color here. Detecting *unpublished* targets (to grey
 * them + add a padlock) needs the full-vault map and lands in a later step.
 */
export const colorLinksByType = (
  root: Root,
  _slug: unknown,
  componentData: QuartzComponentProps,
): void => {
  const slugToType = new Map<string, string>();
  for (const file of componentData.allFiles ?? []) {
    const fileSlug = file?.slug;
    if (typeof fileSlug !== "string") {
      continue;
    }
    const type = normalizeType((file.frontmatter as Record<string, unknown> | undefined)?.type);
    if (type) {
      slugToType.set(fileSlug, type);
    }
  }

  visit(root, "element", (node: Element) => {
    if (node.tagName !== "a" || !node.properties) {
      return;
    }
    if (!classListOf(node).includes(INTERNAL_LINK_CLASS)) {
      return;
    }
    const slug = node.properties[SLUG_ATTR];
    if (typeof slug !== "string") {
      return;
    }
    const type = slugToType.get(slug);
    if (type) {
      node.properties[LINK_TYPE_ATTR] = type;
    }
  });
};

/**
 * Stub body: this plugin owns no pages (`match` always returns false), so the
 * body never renders. It exists only to satisfy the pageType contract and to
 * contribute the `colorLinksByType` tree transform to every rendered page.
 */
const NoopBody: QuartzComponentConstructor = () => {
  const Component: QuartzComponent = (_props: QuartzComponentProps) => null;
  return Component;
};

/**
 * Arbor Taxonomy — colors internal links by the target note's `type`.
 *
 * Registered as a `pageType` plugin purely to hook `treeTransforms`, which run
 * at render time when `allFiles` (with frontmatter) is available. It generates
 * no routes and matches no files.
 */
export const ArborTaxonomy: QuartzPageTypePlugin = (): QuartzPageTypePluginInstance => ({
  name: "ArborTaxonomy",
  match: () => false,
  layout: "content",
  body: NoopBody,
  treeTransforms: () => [colorLinksByType],
});
