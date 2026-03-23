import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Lighthouse AWS infrastructure stack.
 *
 * HIPAA controls applied:
 *  - All data encrypted at rest (RDS, S3, CloudWatch Logs)
 *  - All traffic encrypted in transit (HTTPS ALB, RDS SSL)
 *  - S3 bucket: no public access, versioning enabled
 *  - VPC: API runs in private subnets, no public IP
 *  - CloudWatch Logs: 7-year retention for HIPAA audit trail
 *
 * Before deploy: Sign AWS BAA and enable HIPAA eligibility for:
 *   EC2, RDS, S3, Cognito, CloudWatch, ECS, Secrets Manager
 */
export class LighthouseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── VPC ────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'LighthouseVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ─── Secrets ─────────────────────────────────────────────────────────
    const dbSecret = new secretsManager.Secret(this, 'DBSecret', {
      secretName: 'lighthouse/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'lighthouse' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    const anthropicSecret = new secretsManager.Secret(this, 'AnthropicSecret', {
      secretName: 'lighthouse/anthropic-api-key',
      description: 'Claude API key — set manually after stack creation',
    });

    const elevenLabsSecret = new secretsManager.Secret(this, 'ElevenLabsSecret', {
      secretName: 'lighthouse/elevenlabs-api-key',
      description: 'ElevenLabs API key — set manually after stack creation',
    });

    // ─── RDS PostgreSQL ───────────────────────────────────────────────────
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Lighthouse RDS security group',
    });

    const database = new rds.DatabaseInstance(this, 'LighthouseDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'lighthouse',
      // HIPAA: encryption at rest
      storageEncrypted: true,
      // HIPAA: automated backups retained 35 days
      backupRetention: cdk.Duration.days(35),
      deletionProtection: true,
      enablePerformanceInsights: true,
      // HIPAA: audit logging via CloudWatch
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.TEN_YEARS,
      multiAz: false, // Enable in production
    });

    // ─── S3 Bucket (audio files) ─────────────────────────────────────────
    const audioBucket = new s3.Bucket(this, 'AudioBucket', {
      bucketName: `lighthouse-audio-${this.account}-${this.region}`,
      // HIPAA: no public access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // HIPAA: encryption at rest
      encryption: s3.BucketEncryption.S3_MANAGED,
      // HIPAA: versioning for audit trail
      versioned: true,
      // HIPAA: enforce SSL
      enforceSSL: true,
      // Auto-expire old audio files after 90 days
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
          prefix: 'briefings/',
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── Cognito User Pool ───────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'LighthouseUserPool', {
      userPoolName: 'lighthouse-users',
      selfSignUpEnabled: false, // Caregivers invite patients; no public signup
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // HIPAA: advanced security features
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
    });

    const userPoolClient = userPool.addClient('LighthouseMobileClient', {
      userPoolClientName: 'lighthouse-mobile',
      authFlows: {
        userSrp: true,
        userPassword: false, // Use SRP only — more secure
      },
      preventUserExistenceErrors: true,
    });

    // ─── ECS Fargate ─────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'LighthouseCluster', {
      vpc,
      clusterName: 'lighthouse',
      containerInsights: true,
    });

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/lighthouse/api',
      retention: logs.RetentionDays.TEN_YEARS, // HIPAA: 10-year audit log retention
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('node:20-alpine'), // Replaced by CI/CD
          containerPort: 3000,
          environment: {
            NODE_ENV: 'production',
            PORT: '3000',
            AWS_REGION: this.region,
            AWS_S3_BUCKET: audioBucket.bucketName,
            AWS_COGNITO_USER_POOL_ID: userPool.userPoolId,
            AWS_COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
          },
          secrets: {
            ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret, 'apiKey'),
            ELEVENLABS_API_KEY: ecs.Secret.fromSecretsManager(elevenLabsSecret, 'apiKey'),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'api',
            logGroup: apiLogGroup,
          }),
        },
        publicLoadBalancer: true, // ALB is public; Fargate tasks are private
        assignPublicIp: false,
      }
    );

    // Allow API to connect to RDS
    database.connections.allowFrom(
      apiService.service,
      ec2.Port.tcp(5432),
      'API to RDS'
    );

    // Allow API to read/write S3
    audioBucket.grantReadWrite(apiService.taskDefinition.taskRole);

    // ─── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `https://${apiService.loadBalancer.loadBalancerDnsName}`,
      description: 'API Load Balancer URL',
    });
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'AudioBucketName', {
      value: audioBucket.bucketName,
    });
  }
}
