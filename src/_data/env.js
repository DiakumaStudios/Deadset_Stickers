// Netlify sets URL to the site's main address when it builds (the custom domain once it's connected).
export default {
  url: (process.env.URL || "").replace(/\/$/, ""),
};
