import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import { CfnStage, HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');

export interface ChhatReadyStackProps extends cdk.StackProps {
  /** Folder with the built web app (apps/web/dist). */
  webDistDir: string;
  /** Verified SES sender, e.g. "ChhatReady <you@example.com>". Empty disables sending (the UI falls back to copy/mailto). */
  sesFrom?: string;
  /** Extra browser origins allowed by the API, comma separated (optional). */
  extraOrigins?: string;
  caseTtlDays?: number;
}

export class ChhatReadyStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: ChhatReadyStackProps) {
    super(scope, id, props);

    // ---- DynamoDB: one on-demand table, TTL on every item -------------------------------------
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // ---- S3: private uploads (bills, quotes, packs) with short lifecycle -----------------------
    const uploads = new s3.Bucket(this, 'Uploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'], // access is controlled by short-lived presigned URLs, not by origin
          allowedHeaders: ['*'],
          maxAge: 600
        }
      ],
      lifecycleRules: [
        { id: 'expire-uploads-1d', prefix: 'uploads/', expiration: cdk.Duration.days(1), abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) },
        { id: 'expire-packs-7d', prefix: 'packs/', expiration: cdk.Duration.days(7) }
      ]
    });

    // ---- S3 + CloudFront: the web app --------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true
      },
      additionalBehaviors: {
        '/config.json': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
        }
      },
      // Single-page app: unknown paths serve index.html so deep links like /c/<id>/plan work.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) }
      ]
    });
    const siteOrigin = `https://${distribution.distributionDomainName}`;

    // ---- Lambda: the whole API (Hono) ---------------------------------------------------------
    const logGroup = new logs.LogGroup(this, 'ApiLogs', { retention: logs.RetentionDays.TWO_WEEKS, removalPolicy: cdk.RemovalPolicy.DESTROY });
    const origin = [siteOrigin, ...(props.extraOrigins ? props.extraOrigins.split(',').map((s) => s.trim()).filter(Boolean) : [])].join(',');

    const api = new NodejsFunction(this, 'Api', {
      entry: path.join(REPO_ROOT, 'apps', 'api', 'src', 'lambda.ts'),
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, 'package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      logGroup,
      bundling: { minify: true, sourceMap: true, target: 'node22', externalModules: [] },
      environment: {
        TABLE_NAME: table.tableName,
        UPLOAD_BUCKET: uploads.bucketName,
        SES_FROM: props.sesFrom ?? '',
        ALLOWED_ORIGIN: origin,
        APP_URL: siteOrigin,
        CASE_TTL_DAYS: String(props.caseTtlDays ?? 30),
        MOCK_AWS: '0',
        LOG_LEVEL: 'INFO',
        POWERTOOLS_SERVICE_NAME: 'chhatready-api',
        POWERTOOLS_METRICS_NAMESPACE: 'ChhatReady',
        NODE_OPTIONS: '--enable-source-maps'
      }
    });

    table.grantReadWriteData(api);
    uploads.grantReadWrite(api);
    api.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'TextractRead',
        actions: ['textract:AnalyzeDocument', 'textract:DetectDocumentText'],
        resources: ['*'] // Textract does not support resource-level permissions
      })
    );
    api.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'SesSend',
        actions: ['ses:SendEmail'],
        resources: [`arn:${this.partition}:ses:${this.region}:${this.account}:identity/*`]
      })
    );

    // ---- API Gateway HTTP API in front of the Lambda ------------------------------------------
    // CORS is handled by the Lambda (Hono) so headers are never duplicated.
    const httpApi = new HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', api)
    });
    const stage = httpApi.defaultStage?.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = { throttlingRateLimit: 10, throttlingBurstLimit: 20 };

    // ---- Publish the web app + runtime config -------------------------------------------------
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      sources: [s3deploy.Source.asset(props.webDistDir), s3deploy.Source.jsonData('config.json', { apiUrl: httpApi.apiEndpoint })],
      distribution,
      distributionPaths: ['/*']
    });

    this.apiUrl = httpApi.apiEndpoint;
    this.siteUrl = siteOrigin;
    new cdk.CfnOutput(this, 'SiteUrl', { value: siteOrigin, description: 'Open this in your browser' });
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'UploadBucket', { value: uploads.bucketName });
  }
}
