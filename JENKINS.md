# Jenkins test project

This repository contains a tiny Node.js project used to test a Jenkins pipeline.

## What is here

| File | Purpose |
| --- | --- |
| `src/calculator.js` | The sample application |
| `src/calculator-ui.js` | Browser UI for the calculator |
| `test/calculator.test.js` | Tests using Node's built-in test runner |
| `scripts/test-ci.js` | Runs tests and writes `reports/junit.xml` |
| `scripts/build.js` | Builds the static site into `dist/` |
| `package-lock.json` | Locked dependency graph used by `npm ci` |
| `Jenkinsfile` | Declarative pipeline definition |

No third-party dependencies are required: the tests use Node's built-in
`node:test` module.

## Run locally

```bash
npm ci
npm run build
npm test
```

Or run exactly what Jenkins runs:

```bash
npm run test:ci
```

The JUnit report is written to `reports/junit.xml`.

## Set up the Jenkins job

1. Push this repository to GitHub (or another Git server Jenkins can reach).
2. In Jenkins, click **New Item** → **Pipeline** → give it a name.
3. Under **Pipeline**, choose **Pipeline script from SCM**.
4. Select **Git**, enter the repository URL, and set the branch.
5. Set **Script Path** to `Jenkinsfile`.
6. Save and click **Build Now**.

The pipeline will:

1. Scan the checkout for obvious committed secrets.
2. Install dependencies from the lockfile (`npm ci`).
3. Build the static site into `dist/` and archive it as a Jenkins artifact.
4. Run a dependency audit (`npm audit --audit-level=high`).
5. Verify the build artifact exists and run the tests (`npm run test:ci`).
6. Publish the JUnit results to the build page.
7. Deploy the built site to Nginx at http://localhost:8081.

## Deployment (CD)

The `Deploy` stage runs after a successful build. It recreates the
`learn-jenkins-site` container, copies `dist/` into it, and verifies that the
deployed page contains "Simple Calculator". The Jenkins job is configured to
build the `master` branch.

| Item | Value |
| --- | --- |
| Deployed URL | http://localhost:8081 |
| Container | `learn-jenkins-site` |
| Image | `nginx:alpine@sha256:713fc2eb…` (pinned) |

Equivalent deploy commands:

```bash
docker rm -f learn-jenkins-site
docker run -d --name learn-jenkins-site --restart unless-stopped \
  --security-opt=no-new-privileges -p 8081:80 nginx:alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11
docker cp dist/. learn-jenkins-site:/usr/share/nginx/html/
docker exec learn-jenkins-site wget -qO- http://localhost/ | grep -q 'Simple Calculator'
```

The Jenkins agent needs access to the Docker daemon (the `jenkins` container
has `/var/run/docker.sock` mounted) to run this stage.

## Security measures in the pipeline

- **Pinned build image.** Node runs in
  `node:24-alpine@sha256:a34ab6d7…` so the image cannot change silently.
  Update the digest deliberately when upgrading Node.
- **Isolated container.** Build steps run with `--cap-drop=ALL`,
  `--security-opt=no-new-privileges`, and a PID limit.
- **No dependency lifecycle scripts.** `NPM_CONFIG_IGNORE_SCRIPTS=true` and
  `npm ci --ignore-scripts` prevent install-time scripts from executing.
- **Lockfile-only installs.** `npm ci` installs exactly what is in
  `package-lock.json`, making builds reproducible.
- **Dependency audit.** The build fails on high or critical vulnerabilities.
- **Secret scan.** The pipeline scans tracked source files for common token
  and private-key patterns. It prints only file names, never the matched value.
- **Build limits.** A 15-minute timeout, `disableConcurrentBuilds()`, and log
  rotation limit runaway builds and retained data.
- **Pinned deploy image.** The Nginx image is pinned by digest and runs with
  `--security-opt=no-new-privileges`.

## Jenkins configuration recommendations

These are Jenkins-side settings, not things the `Jenkinsfile` can enforce:

- Keep Jenkins and all plugins up to date.
- Enable CSRF protection and use matrix-based authorization.
- Give jobs the minimum permissions they need; do not run untrusted PRs with
  production credentials.
- Store secrets in **Manage Jenkins → Credentials**, never in the repository,
  and inject them with `withCredentials` only when required.
- Prefer short-lived, read-only tokens, and rotate them regularly.
- Restrict who can create or edit pipeline jobs, since pipeline code can run
  arbitrary commands.
- Use a dedicated, isolated build agent for untrusted code.

## Try a failing build

Change an expected value in `test/calculator.test.js` (for example `5` to `6`),
push, and run the job again. The Test stage will fail and the build will be
marked as failed — useful for seeing how Jenkins reports failures.
