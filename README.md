# Learn-Jenkins

Learn Jenkins during TP DCC class.

## Contents

- `index.html` — simple calculator web app.
- `src/calculator.js` — calculator logic shared by the page and the tests.
- `src/calculator-ui.js` — browser UI wiring for the calculator.
- `test/calculator.test.js` — unit tests using Node's built-in test runner.
- `scripts/test-ci.js` — runs the tests and writes `reports/junit.xml`.
- `scripts/build.js` — builds the static site into `dist/`.
- `package-lock.json` — locked dependency graph used by `npm ci`.
- `Jenkinsfile` — declarative Jenkins pipeline.
- `JENKINS.md` — steps for setting up the Jenkins job.

## Run the tests

```bash
npm ci
npm run build
npm test
```

Or run exactly what Jenkins runs:

```bash
npm run test:ci
```

## Jenkins

The pipeline scans for committed secrets, installs from the lockfile, builds
and archives `dist/`, audits dependencies, runs the tests, and publishes the
JUnit report. On `master`, it also deploys the built site to Nginx at
http://localhost:8081. See `JENKINS.md` for the job setup steps, deployment
details, and security measures.
