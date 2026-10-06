export default function (eleventyConfig) {
  // Copy images, styles and scripts straight through to the finished site.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ admin: "admin" });

  // Blog posts, newest first.
  eleventyConfig.addCollection("posts", (collection) =>
    collection.getFilteredByGlob("src/blog/posts/*.md").sort((a, b) => b.date - a.date)
  );

  // Dates like "17 September 2026".
  eleventyConfig.addFilter("auDate", (date) =>
    new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("readMins", (html) =>
    Math.max(2, Math.round(String(html).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200))
  );
  eleventyConfig.addFilter("excludeUrl", (posts, url) => posts.filter((p) => p.url !== url));
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));
  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString().slice(0, 10));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
