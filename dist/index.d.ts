import { Root } from 'hast';
import { QuartzPageTypePlugin, QuartzComponentProps } from '@quartz-community/types';
export { PageGenerator, PageMatcher, QuartzComponent, QuartzComponentConstructor, QuartzComponentProps, QuartzPageTypePlugin, QuartzPageTypePluginInstance, VirtualPage } from '@quartz-community/types';

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
declare const normalizeType: (raw: RawType) => string | null;
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
declare const colorLinksByType: (root: Root, _slug: unknown, componentData: QuartzComponentProps) => void;
/**
 * Arbor Taxonomy — colors internal links by the target note's `type`.
 *
 * Registered as a `pageType` plugin purely to hook `treeTransforms`, which run
 * at render time when `allFiles` (with frontmatter) is available. It generates
 * no routes and matches no files.
 */
declare const ArborTaxonomy: QuartzPageTypePlugin;

export { ArborTaxonomy, colorLinksByType, normalizeType };
