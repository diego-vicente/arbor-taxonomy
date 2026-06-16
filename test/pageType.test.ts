import { describe, expect, it } from "vitest";
import type { Root, Element } from "hast";
import type { QuartzComponentProps } from "@quartz-community/types";
import {
  ArborTaxonomy,
  ArborTaxonomyRecorder,
  colorLinksByType,
  normalizeType,
} from "../src/pageType";

describe("normalizeType", () => {
  it("strips the wikilink wrapper and slugifies", () => {
    expect(normalizeType("[[Coffee Beans]]")).toBe("coffee-beans");
    expect(normalizeType("[[Concept]]")).toBe("concept");
  });

  it("drops alias and heading suffixes", () => {
    expect(normalizeType("[[Place|Cities]]")).toBe("place");
    expect(normalizeType("[[Note#Section]]")).toBe("note");
  });

  it("accepts a plain string or a single-element list", () => {
    expect(normalizeType("Idea")).toBe("idea");
    expect(normalizeType(["[[Person]]"])).toBe("person");
  });

  it("returns null when there is no usable type", () => {
    expect(normalizeType(undefined)).toBeNull();
    expect(normalizeType(null)).toBeNull();
    expect(normalizeType("")).toBeNull();
    expect(normalizeType(42)).toBeNull();
  });
});

const link = (props: Element["properties"]): Element => ({
  type: "element",
  tagName: "a",
  properties: props,
  children: [],
});

const treeOf = (...links: Element[]): Root => ({ type: "root", children: links });

const componentDataWith = (
  files: Array<{ slug: string; type?: unknown }>,
  vault?: Map<string, string>,
): QuartzComponentProps =>
  ({
    allFiles: files.map((f) => ({ slug: f.slug, frontmatter: { type: f.type } })),
    ctx: vault ? { __arborVaultTypes: vault } : {},
  }) as unknown as QuartzComponentProps;

const lockOf = (node: Element): Element | undefined =>
  node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "svg",
  );

describe("colorLinksByType", () => {
  it("tags a published internal link with the target note's type", () => {
    const internal = link({ className: ["internal"], "data-slug": "coffee/ethiopia" });
    const root = treeOf(internal);

    colorLinksByType(
      root,
      "any",
      componentDataWith([{ slug: "coffee/ethiopia", type: "[[Coffee Beans]]" }]),
    );

    expect(internal.properties?.["data-link-type"]).toBe("coffee-beans");
  });

  it("colors a link to a type's own note by that type, not its frontmatter type", () => {
    // The "Idea" note (slug "idea") is itself typed "[[Obsidian Entity]]", but a
    // link to it should read as the Idea type (yellow), not obsidian-entity.
    const toIdea = link({ className: ["internal"], "data-slug": "idea" });
    const root = treeOf(toIdea);

    colorLinksByType(
      root,
      "any",
      componentDataWith([
        { slug: "idea", type: "[[Obsidian Entity]]" },
        { slug: "some-bright-idea", type: "[[Idea]]" }, // makes "idea" a known type slug
      ]),
    );

    expect(toIdea.properties?.["data-link-type"]).toBe("idea");
  });

  it("leaves external links and typeless targets untouched", () => {
    const external = link({ className: ["external"], href: "https://example.com" });
    const typeless = link({ className: ["internal"], "data-slug": "misc/scratch" });
    const root = treeOf(external, typeless);

    colorLinksByType(root, "any", componentDataWith([{ slug: "misc/scratch" }]));

    expect(external.properties?.["data-link-type"]).toBeUndefined();
    expect(typeless.properties?.["data-link-type"]).toBeUndefined();
  });

  it("leaves a truly non-existent .broken link plain grey (no type, no padlock)", () => {
    const broken = link({ className: ["internal", "broken"], "data-slug": "ghost/note" });
    const root = treeOf(broken);
    const vault = new Map([["real/note", "concept"]]); // ghost/note is absent everywhere

    colorLinksByType(
      root,
      "any",
      componentDataWith([{ slug: "real/note", type: "[[Concept]]" }], vault),
    );

    expect(broken.properties?.["data-link-type"]).toBeUndefined();
    expect(lockOf(broken)).toBeUndefined();
  });

  it("colors an unpublished-but-existing link by type, flags it, and appends a padlock", () => {
    // Unpublished links are NOT broken (Quartz seeds allSlugs from the whole vault).
    const unpublished = link({ className: ["internal"], "data-slug": "drafts/secret" });
    const root = treeOf(unpublished);
    // Present in the full vault map, absent from allFiles → unpublished.
    const vault = new Map([["drafts/secret", "concept"]]);

    colorLinksByType(root, "any", componentDataWith([], vault));

    expect(unpublished.properties?.["data-link-type"]).toBe("concept");
    expect(unpublished.properties?.className).toContain("arbor-unpublished");
    expect(lockOf(unpublished)?.properties?.className).toContain("arbor-lock");
  });

  it("padlocks an unpublished typeless note without coloring it", () => {
    const unpublished = link({ className: ["internal"], "data-slug": "drafts/plain" });
    const root = treeOf(unpublished);
    const vault = new Map([["drafts/plain", ""]]); // exists, but no type

    colorLinksByType(root, "any", componentDataWith([], vault));

    expect(unpublished.properties?.["data-link-type"]).toBeUndefined();
    expect(unpublished.properties?.className).toContain("arbor-unpublished");
    expect(lockOf(unpublished)).toBeDefined();
  });
});

describe("ArborTaxonomyRecorder", () => {
  it("records every file's slug → type onto ctx and never prunes", () => {
    const filter = ArborTaxonomyRecorder();
    const ctx = {} as never;
    const file = (slug: string, type?: unknown) =>
      [{ type: "root", children: [] }, { data: { slug, frontmatter: { type } } }] as never;

    expect(filter.shouldPublish(ctx, file("a/concept", "[[Concept]]"))).toBe(true);
    expect(filter.shouldPublish(ctx, file("b/plain"))).toBe(true);

    const map = (ctx as unknown as { __arborVaultTypes: Map<string, string> }).__arborVaultTypes;
    expect(map.get("a/concept")).toBe("concept");
    expect(map.get("b/plain")).toBe("");
  });
});

describe("ArborTaxonomy plugin", () => {
  it("owns no pages and contributes the color transform", () => {
    const plugin = ArborTaxonomy();
    expect(plugin.name).toBe("ArborTaxonomy");
    expect(plugin.match("anything" as never)).toBe(false);
    expect(plugin.layout).toBe("content");
    const transforms = plugin.treeTransforms?.({} as never) ?? [];
    expect(transforms).toContain(colorLinksByType);
  });
});
