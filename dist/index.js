import { createRequire } from 'module';

createRequire(import.meta.url);

// node_modules/unist-util-is/lib/index.js
var convert = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(test) {
    if (test === null || test === void 0) {
      return ok;
    }
    if (typeof test === "function") {
      return castFactory(test);
    }
    if (typeof test === "object") {
      return Array.isArray(test) ? anyFactory(test) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        propertiesFactory(
          /** @type {Props} */
          test
        )
      );
    }
    if (typeof test === "string") {
      return typeFactory(test);
    }
    throw new Error("Expected function, string, or object as test");
  })
);
function anyFactory(tests) {
  const checks = [];
  let index = -1;
  while (++index < tests.length) {
    checks[index] = convert(tests[index]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index2 = -1;
    while (++index2 < checks.length) {
      if (checks[index2].apply(this, parameters)) return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = (
    /** @type {Record<string, unknown>} */
    check
  );
  return castFactory(all);
  function all(node) {
    const nodeAsRecord = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      node
    );
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key]) return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node) {
    return node && node.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index, parent) {
    return Boolean(
      looksLikeANode(value) && testFunction.call(
        this,
        value,
        typeof index === "number" ? index : void 0,
        parent || void 0
      )
    );
  }
}
function ok() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}

// node_modules/unist-util-visit-parents/lib/color.node.js
function color(d) {
  return "\x1B[33m" + d + "\x1B[39m";
}

// node_modules/unist-util-visit-parents/lib/index.js
var empty = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, void 0, [])();
  function factory(node, index, parents) {
    const value = (
      /** @type {Record<string, unknown>} */
      node && typeof node === "object" ? node : {}
    );
    if (typeof value.type === "string") {
      const name = (
        // `hast`
        typeof value.tagName === "string" ? value.tagName : (
          // `xast`
          typeof value.name === "string" ? value.name : void 0
        )
      );
      Object.defineProperty(visit2, "name", {
        value: "node (" + color(node.type + (name ? "<" + name + ">" : "")) + ")"
      });
    }
    return visit2;
    function visit2() {
      let result = empty;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node, index, parents[parents.length - 1] || void 0)) {
        result = toResult(visitor(node, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node && node.children) {
        const nodeAsParent = (
          /** @type {UnistParent} */
          node
        );
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === void 0 ? empty : [value];
}

// node_modules/unist-util-visit/lib/index.js
function visit(tree, testOrVisitor, visitorOrReverse, maybeReverse) {
  let reverse;
  let test;
  let visitor;
  {
    test = testOrVisitor;
    visitor = visitorOrReverse;
    reverse = maybeReverse;
  }
  visitParents(tree, test, overload, reverse);
  function overload(node, parents) {
    const parent = parents[parents.length - 1];
    const index = parent ? parent.children.indexOf(node) : void 0;
    return visitor(node, index, parent);
  }
}

// src/pageType.ts
var normalizeType = (raw) => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return null;
  }
  let text = value.trim();
  const wikilinkMatch = text.match(/^\[\[([^\]]+)\]\]$/);
  if (wikilinkMatch?.[1]) {
    text = wikilinkMatch[1];
  }
  const target = text.replace(/[|#].*$/, "").trim();
  if (!target) {
    return null;
  }
  return target.toLowerCase().replace(/\s+/g, "-");
};
var classListOf = (node) => {
  const existing = node.properties?.className;
  if (Array.isArray(existing)) {
    return existing.filter((c) => typeof c === "string");
  }
  return typeof existing === "string" ? [existing] : [];
};
var INTERNAL_LINK_CLASS = "internal";
var BROKEN_LINK_CLASS = "broken";
var LINK_TYPE_ATTR = "data-link-type";
var SLUG_ATTR = "data-slug";
var LOCK_CLASS = "arbor-lock";
var UNPUBLISHED_CLASS = "arbor-unpublished";
var VAULT_TYPES_KEY = "__arborVaultTypes";
var VAULT_FILES_KEY = "fullVaultFiles";
var ctxStore = (ctx) => ctx;
var readVaultTypes = (ctx) => {
  if (!ctx || typeof ctx !== "object") {
    return void 0;
  }
  const stored = ctx[VAULT_TYPES_KEY];
  return stored instanceof Map ? stored : void 0;
};
var slugTypeMap = (files) => {
  const map = /* @__PURE__ */ new Map();
  for (const file of files ?? []) {
    const fileSlug = file?.slug;
    if (typeof fileSlug !== "string") {
      continue;
    }
    const type = normalizeType(file.frontmatter?.type);
    map.set(fileSlug, type ?? "");
  }
  return map;
};
var lockIcon = () => ({
  type: "element",
  tagName: "svg",
  properties: {
    className: [LOCK_CLASS],
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  },
  children: [
    {
      type: "element",
      tagName: "rect",
      properties: { width: 18, height: 11, x: 3, y: 11, rx: 2, ry: 2 },
      children: []
    },
    {
      type: "element",
      tagName: "path",
      properties: { d: "M7 11V7a5 5 0 0 1 10 0v4" },
      children: []
    }
  ]
});
var appendLock = (node) => {
  node.children.push(lockIcon());
};
var colorLinksByType = (root, _slug, componentData) => {
  const publishedTypes = slugTypeMap(componentData.allFiles);
  const vaultTypes = readVaultTypes(componentData.ctx);
  const typeSlugs = /* @__PURE__ */ new Set([
    ...publishedTypes.values(),
    ...vaultTypes ? vaultTypes.values() : []
  ]);
  visit(root, "element", (node) => {
    if (node.tagName !== "a" || !node.properties) {
      return;
    }
    const classes = classListOf(node);
    if (!classes.includes(INTERNAL_LINK_CLASS) || classes.includes(BROKEN_LINK_CLASS)) {
      return;
    }
    const slug = node.properties[SLUG_ATTR];
    if (typeof slug !== "string") {
      return;
    }
    if (typeSlugs.has(slug)) {
      node.properties[LINK_TYPE_ATTR] = slug;
      return;
    }
    if (publishedTypes.has(slug)) {
      const type = publishedTypes.get(slug);
      if (type) {
        node.properties[LINK_TYPE_ATTR] = type;
      }
      return;
    }
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
var ArborTaxonomyRecorder = () => ({
  name: "ArborTaxonomyRecorder",
  shouldPublish(ctx, [, vfile]) {
    const store = ctxStore(ctx);
    let map = store[VAULT_TYPES_KEY];
    if (!(map instanceof Map)) {
      map = /* @__PURE__ */ new Map();
      store[VAULT_TYPES_KEY] = map;
    }
    let files = store[VAULT_FILES_KEY];
    if (!Array.isArray(files)) {
      files = [];
      store[VAULT_FILES_KEY] = files;
    }
    files.push(vfile.data);
    const data = vfile.data;
    if (typeof data.slug === "string") {
      map.set(data.slug, normalizeType(data.frontmatter?.type) ?? "");
    }
    return true;
  }
});
var NoopBody = () => {
  const Component = (_props) => null;
  return Component;
};
var ArborTaxonomy = () => ({
  name: "ArborTaxonomy",
  match: () => false,
  layout: "content",
  body: NoopBody,
  treeTransforms: () => [colorLinksByType]
});

export { ArborTaxonomy, ArborTaxonomyRecorder, colorLinksByType, normalizeType };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map