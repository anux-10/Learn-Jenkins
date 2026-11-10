pipeline {
    // Checkout runs on the Jenkins agent (which has git); the Node steps run
    // inside a pinned, locked-down container.
    agent any

    options {
        timestamps()
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        CI = 'true'
        // Never run lifecycle scripts from dependencies.
        NPM_CONFIG_IGNORE_SCRIPTS = 'true'
        NPM_CONFIG_AUDIT = 'true'
        NPM_CONFIG_FUND = 'false'
        NPM_CONFIG_UPDATE_NOTIFIER = 'false'
    }

    stages {
        stage('Build and test') {
            agent {
                docker {
                    // Pinned by digest so the image cannot change silently.
                    image 'node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8'
                    reuseNode true
                    args '--cap-drop=ALL --security-opt=no-new-privileges --pids-limit=256'
                }
            }

            stages {
                stage('Secret scan') {
                    steps {
                        // Lists file names only, so a found secret is not echoed to the log.
                        // Uses BusyBox-compatible grep flags (the Alpine image has no GNU grep).
                        sh '''
                            set -eu
                            matches=$(grep -rIlE '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|xox[baprs]-[A-Za-z0-9-]+)' . 2>/dev/null | grep -vE '(^|/)([.]git|node_modules)/' | grep -vE '[.](md|pdf|png|jpg|jpeg|gif)$' || true)
                            if [ -n "$matches" ]; then
                                echo "$matches"
                                echo 'Potential secret detected in the files listed above. Failing the build.'
                                exit 1
                            fi
                            echo 'No obvious secrets found.'
                        '''
                    }
                }

                stage('Install') {
                    steps {
                        // Reproducible install from package-lock.json, without running
                        // dependency lifecycle scripts.
                        sh 'npm ci --ignore-scripts --no-audit --no-fund'
                    }
                }

                stage('Build') {
                    steps {
                        sh 'npm run build'
                    }
                    post {
                        success {
                            archiveArtifacts artifacts: 'dist/**', fingerprint: true
                        }
                    }
                }

                stage('Security audit') {
                    steps {
                        // Fails the build on high or critical vulnerabilities.
                        sh 'npm audit --audit-level=high'
                    }
                }

                stage('Test') {
                    steps {
                        // Fail fast if the Build stage did not produce the site.
                        sh '''
                            test -f dist/index.html
                            npm run test:ci
                        '''
                    }
                    post {
                        always {
                            junit testResults: 'reports/junit.xml',
                                  allowEmptyResults: true
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    CONTAINER=learn-jenkins-site
                    IMAGE=nginx:alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11

                    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
                    docker run -d --name "$CONTAINER" --restart unless-stopped --security-opt=no-new-privileges -p 8081:80 "$IMAGE" >/dev/null

                    # Wait for nginx to start.
                    for i in $(seq 1 20); do
                        if docker exec "$CONTAINER" wget -qO- http://localhost/ >/dev/null 2>&1; then
                            break
                        fi
                        sleep 1
                    done

                    docker cp dist/. "$CONTAINER":/usr/share/nginx/html/
                    docker exec "$CONTAINER" wget -qO- http://localhost/ | grep -q 'Simple Calculator'
                    echo 'Deployed to http://localhost:8081'
                '''
            }
        }
    }

    post {
        success {
            echo 'Build passed!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}
