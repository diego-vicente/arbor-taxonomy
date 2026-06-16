import { describe, expect, it } from "vitest";
import type { Root, Element } from "hast";
import type { QuartzComponentProps } from "@quartz-community/types";
import { ArborTaxonomy, colorLinksByType, normalizeType } from "../src/pageType";

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

const componentDataWith = (files: Array<{ slug: string; type?: unknown }>): QuartzComponentProps =>
  ({
    allFiles: files.map((f) => ({ slug: f.slug, frontmatter: { type: f.type } })),
  }) as unknown as QuartzComponentProps;

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

  it("leaves external links and typeless targets untouched", () => {
    const external = link({ className: ["external"], href: "https://example.com" });
    const typeless = link({ className: ["internal"], "data-slug": "misc/scratch" });
    const root = treeOf(external, typeless);

    colorLinksByType(root, "any", componentDataWith([{ slug: "misc/scratch" }]));

    expect(external.properties?.["data-link-type"]).toBeUndefined();
    expect(typeless.properties?.["data-link-type"]).toBeUndefined();
  });

  it("does not tag links whose target is absent from allFiles (broken/unpublished)", () => {
    const broken = link({ className: ["internal", "broken"], "data-slug": "ghost/note" });
    const root = treeOf(broken);

    colorLinksByType(root, "any", componentDataWith([{ slug: "real/note", type: "[[Concept]]" }]));

    expect(broken.properties?.["data-link-type"]).toBeUndefined();
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
