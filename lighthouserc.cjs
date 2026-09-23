module.exports = {
  ci: {
    collect: {
      url: ["http://127.0.0.1:3000/"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "categories:pwa": ["warn", { minScore: 0.8 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lighthouse-report",
    },
  },
};
