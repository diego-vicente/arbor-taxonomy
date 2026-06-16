import { Root } from 'hast';
import { QuartzPageTypePlugin, QuartzFilterPlugin, QuartzComponentProps } from '@quartz-community/types';
export { PageGenerator, PageMatcher, QuartzComponent, QuartzComponentConstructor, QuartzComponentProps, QuartzFilterPlugin, QuartzPageTypePlugin, QuartzPageTypePluginInstance, VirtualPage } from '@quartz-community/types';

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
declare const colorLinksByType: (root: Root, _slug: unknown, componentData: QuartzComponentProps) => void;
/**
 * Records every note's `slug → type` into `ctx` so the render-time transform can
 * recognize unpublished targets. Must run **before** any publish/draft filter so
 * it sees the full vault; wire it at the front of `config.plugins.filters`.
 * Always returns `true` — it prunes nothing.
 */
declare const ArborTaxonomyRecorder: QuartzFilterPlugin;
/**
 * Arbor Taxonomy — colors internal links by the target note's `type`.
 *
 * Registered as a `pageType` plugin purely to hook `treeTransforms`, which run
 * at render time when `allFiles` (with frontmatter) is available. It generates
 * no routes and matches no files. Pair it with {@link ArborTaxonomyRecorder} to
 * also flag unpublished targets with a padlock.
 */
declare const ArborTaxonomy: QuartzPageTypePlugin;

export { ArborTaxonomy, ArborTaxonomyRecorder, colorLinksByType, normalizeType };
