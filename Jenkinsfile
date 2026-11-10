pipeline {
    agent any

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Install') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm install'
                    } else {
                        bat 'npm install'
                    }
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm run test:ci'
                    } else {
                        bat 'npm run test:ci'
                    }
                }
            }
            post {
                always {
                   junit testResults: 'reports/junit.xml', allowEmptyResults: true
                }
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
