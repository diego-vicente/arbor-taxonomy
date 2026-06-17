import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  QuartzPageTypePlugin,
  QuartzPageTypePluginInstance,
  QuartzFilterPlugin,
  ProcessedContent,
  BuildCtx,
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
const BROKEN_LINK_CLASS = "broken";
const LINK_TYPE_ATTR = "data-link-type";
const SLUG_ATTR = "data-slug";
const LOCK_CLASS = "arbor-lock";
const UNPUBLISHED_CLASS = "arbor-unpublished";

/**
 * Key under which the recorder filter stashes the full-vault `slug → type` map
 * on the shared `BuildCtx`. The render-time transform reads it back from
 * `componentData.ctx` to tell *unpublished-but-existing* targets (which crawl-
 * links also marks `.broken`) apart from truly non-existent ones.
 */
const VAULT_TYPES_KEY = "__arborVaultTypes";

/**
 * Key under which the recorder stashes the FULL-vault file list (published +
 * unpublished `QuartzPluginData`). bases-page reads this from ctx as its
 * `linkUniverse` so backlink aggregates (Count) include unpublished notes while
 * rows stay published-only.
 */
const VAULT_FILES_KEY = "fullVaultFiles";

type VaultTypeMap = Map<string, string>;

const ctxStore = (ctx: BuildCtx): Record<string, unknown> =>
  ctx as unknown as Record<string, unknown>;

const readVaultTypes = (ctx: unknown): VaultTypeMap | undefined => {
  if (!ctx || typeof ctx !== "object") {
    return undefined;
  }
  const stored = (ctx as Record<string, unknown>)[VAULT_TYPES_KEY];
  return stored instanceof Map ? (stored as VaultTypeMap) : undefined;
};

/** Build a `slug → normalized type` map from a set of files (published or full vault). */
const slugTypeMap = (files: QuartzComponentProps["allFiles"] | undefined): VaultTypeMap => {
  const map: VaultTypeMap = new Map();
  for (const file of files ?? []) {
    const fileSlug = file?.slug;
    if (typeof fileSlug !== "string") {
      continue;
    }
    const type = normalizeType((file.frontmatter as Record<string, unknown> | undefined)?.type);
    // Record every file (type may be ""): existence drives the padlock, type drives the color.
    map.set(fileSlug, type ?? "");
  }
  return map;
};

/**
 * A SOLID padlock glyph (Material-style) as a HAST <svg>, filled with the link's
 * (greyed) color. Solid + sized at 1em by CSS so it reads like an emoji/letter
 * inline, rather than the thin stroke outline that looked odd at small sizes.
 */
const LOCK_PATH =
  "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z";

const lockIcon = (): Element => ({
  type: "element",
  tagName: "svg",
  properties: {
    className: [LOCK_CLASS],
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true",
  },
  children: [
    {
      type: "element",
      tagName: "path",
      properties: { d: LOCK_PATH },
      children: [],
    },
  ],
});

const appendLock = (node: Element): void => {
  node.children.push(lockIcon());
};

/**
 * Render-time HAST transform: color each internal link by the `type` of the
 * note it points to, exposed as `data-link-type` (Arbor's CSS maps each slug to
 * its Catppuccin hue). Three cases:
 *
 *  - **Published target** (present in `allFiles`): tag with its type → colored.
 *  - **Unpublished but existing** (absent from `allFiles` but present in the full
 *    vault map): tag with its type, mark `.arbor-unpublished`, AND append a
 *    padlock — colored-but-greyed, signaling "exists, not published". Note these
 *    are NOT `.broken`: Quartz seeds `ctx.allSlugs` from the *whole* vault, so
 *    crawl-links only marks genuinely missing targets broken.
 *  - **Non-existent** (absent everywhere; crawl-links marked it `.broken`): left
 *    as a plain grey `.broken` link.
 *
 * A link to a TYPE's own definition note (e.g. `[[Idea]]`) is colored by that type
 * itself (yellow), not by the type-note's frontmatter type (which is "Obsidian
 * Entity"). The set of type slugs is exactly the set of normalized `type` values.
 *
 * Typeless targets get no `data-link-type` and keep the default accent color.
 */
export const colorLinksByType = (
  root: Root,
  _slug: unknown,
  componentData: QuartzComponentProps,
): void => {
  const publishedTypes = slugTypeMap(componentData.allFiles);
  const vaultTypes = readVaultTypes(componentData.ctx);
  // Type slugs come from the FULL vault, not just published notes — otherwise a
  // type whose instances are all unpublished (e.g. Journal Entry) wouldn't be
  // recognized as a type, and links to its note wouldn't self-color.
  const typeSlugs = new Set<string>([
    ...publishedTypes.values(),
    ...(vaultTypes ? vaultTypes.values() : []),
  ]);

  visit(root, "element", (node: Element) => {
    if (node.tagName !== "a" || !node.properties) {
      return;
    }
    const classes = classListOf(node);
    if (!classes.includes(INTERNAL_LINK_CLASS) || classes.includes(BROKEN_LINK_CLASS)) {
      // Skip non-internal links and genuinely broken (non-existent) ones — the
      // latter keep their plain grey `.broken` styling.
      return;
    }
    const slug = node.properties[SLUG_ATTR];
    if (typeof slug !== "string") {
      return;
    }

    if (typeSlugs.has(slug)) {
      // Link to a type's own note → color it as that type, not "obsidian-entity".
      node.properties[LINK_TYPE_ATTR] = slug;
      return;
    }

    if (publishedTypes.has(slug)) {
      // Reachable, published link → color by its type, if any.
      const type = publishedTypes.get(slug);
      if (type) {
        node.properties[LINK_TYPE_ATTR] = type;
      }
      return;
    }

    // Not published. If it exists elsewhere in the vault, it's unpublished:
    // color it, flag it, and padlock it. Otherwise leave it alone.
    if (vaultTypes?.has(slug)) {
      const type = vaultTypes.get(slug);
      if (type) {
        node.properties[LINK_TYPE_ATTR] = type;
      }
      node.properties.className = [...classes, UNPUBLISHED_CLASS];
      appendLock(node);
    }
  });
};

/**
 * Records the full vault into `ctx` so render-time consumers can see unpublished
 * notes: a `slug → type` map (for link classification) and the full file list
 * (`ctx.fullVaultFiles`, used by bases-page as its `linkUniverse` so backlink
 * aggregates include unpublished notes). Must run **before** any publish/draft
 * filter so it sees everything; wire it at the front of `config.plugins.filters`.
 * Always returns `true` — it prunes nothing.
 */
export const ArborTaxonomyRecorder: QuartzFilterPlugin = () => ({
  name: "ArborTaxonomyRecorder",
  shouldPublish(ctx: BuildCtx, [, vfile]: ProcessedContent) {
    const store = ctxStore(ctx);
    let map = store[VAULT_TYPES_KEY];
    if (!(map instanceof Map)) {
      map = new Map<string, string>();
      store[VAULT_TYPES_KEY] = map;
    }
    let files = store[VAULT_FILES_KEY];
    if (!Array.isArray(files)) {
      files = [];
      store[VAULT_FILES_KEY] = files;
    }
    (files as unknown[]).push(vfile.data);
    const data = vfile.data as { slug?: string; frontmatter?: Record<string, unknown> };
    if (typeof data.slug === "string") {
      (map as VaultTypeMap).set(data.slug, normalizeType(data.frontmatter?.type) ?? "");
    }
    return true;
  },
});

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
 * no routes and matches no files. Pair it with {@link ArborTaxonomyRecorder} to
 * also flag unpublished targets with a padlock.
 */
export const ArborTaxonomy: QuartzPageTypePlugin = (): QuartzPageTypePluginInstance => ({
  name: "ArborTaxonomy",
  match: () => false,
  layout: "content",
  body: NoopBody,
  treeTransforms: () => [colorLinksByType],
});
