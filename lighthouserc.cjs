module.exports = {
  ci: {
    collect: {
      url: ["http://127.0.0.1:3000/"],
      // Three runs and the median: one desktop sample is too noisy to fail a
      // pull request on.
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      // Every assertion is a hard failure, so a regression stops the workflow
      // instead of scrolling past as a warning. Lighthouse 12 removed the PWA
      // category, and the offline shell is covered by tests/offline.test.ts.
      assertions: {
        "categories:performance": ["error", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lighthouse-report",
    },
  },
};
