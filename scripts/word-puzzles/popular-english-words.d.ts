declare module "popular-english-words" {
  export const words: {
    /** The `count` most popular English words, most popular first. */
    getMostPopular(count: number): string[];
  };
}
