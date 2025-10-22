import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'my-github-token');

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    const project = new codebuild.PipelineProject(this, 'BuildProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'npm install -g aws-cdk',
              'npm ci'
            ]
          },
          build: {
            commands: [
              'npm run build',
              'npx cdk synth',
              'npx cdk deploy --require-approval never'
            ]
          }
        },
        artifacts: {
          'base-directory': 'cdk.out',
          files: ['**/*']
        }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
      }
    });

    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['*'],
      resources: ['*']
    }));

    new codepipeline.Pipeline(this, 'GitHubLambdaPipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              actionName: 'GitHub_Source',
              owner: 'pfu-fukuzawa',
              repo: 'test',
              oauthToken: githubToken.secretValue,
              output: sourceOutput,
              branch: 'main'
            })
          ]
        },
        {
          stageName: 'BuildDeploy',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BuildAndDeploy',
              project,
              input: sourceOutput,
              outputs: [buildOutput]
            })
          ]
        }
      ]
    });
  }
}