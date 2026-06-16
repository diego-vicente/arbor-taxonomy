export { ArborTaxonomy, ArborTaxonomyRecorder, colorLinksByType, normalizeType } from "./pageType";

// Re-export shared types from @quartz-community/types
export type {
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  QuartzPageTypePlugin,
  QuartzPageTypePluginInstance,
  QuartzFilterPlugin,
  PageMatcher,
  PageGenerator,
  VirtualPage,
} from "@quartz-community/types";
