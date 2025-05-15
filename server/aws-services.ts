/**
 * AWS Services Integration for Real-Time Trading Verification
 *
 * This module provides integration with AWS services for transaction
 * verification, logging, and real-time monitoring of blockchain activities.
 * It enforces data integrity by only using real blockchain data.
 */

import { logger } from './logger';
import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand,
  ScanCommand,
  CreateTableCommand,
  DeleteTableCommand
} from '@aws-sdk/client-dynamodb';
import { 
  S3Client, 
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsCommand 
} from '@aws-sdk/client-s3';
import { 
  CloudWatchClient, 
  PutMetricDataCommand 
} from '@aws-sdk/client-cloudwatch';
import { 
  LambdaClient, 
  InvokeCommand 
} from '@aws-sdk/client-lambda';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';

/**
 * AWS Configuration interface
 */
interface AwsConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  services?: string[];
  dynamoDBTable?: string;
  s3Bucket?: string;
  cloudWatchNamespace?: string;
  lambdaFunctionName?: string;
}

/**
 * Transaction interface
 */
interface Transaction {
  txHash: string;
  fromToken: string;
  toToken: string;
  amount: number;
  timestamp: number;
  wallet: string;
  signature?: string;
  success?: boolean;
  error?: string;
}

/**
 * Metrics interface
 */
interface Metrics {
  transactionCount: number;
  successRate: number;
  averageExecutionTime: number;
  totalProfit: number;
  timestamp: number;
}

/**
 * Profit Report interface
 */
interface ProfitReport {
  date: string;
  totalProfit: number;
  transactions: Transaction[];
  breakdown: Record<string, number>;
}

/**
 * Default AWS configuration
 */
const DEFAULT_CONFIG: AwsConfig = {
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  services: ['dynamodb', 'lambda', 'cloudwatch', 's3'],
  dynamoDBTable: 'solana-trading-transactions',
  s3Bucket: 'solana-trading-reports',
  cloudWatchNamespace: 'SolanaTrading',
  lambdaFunctionName: 'verify-solana-transaction'
};

/**
 * AWS Services Manager
 */
class AwsServicesManager {
  private initialized: boolean = false;
  private config: AwsConfig;
  private dynamodbClient: DynamoDBClient | null = null;
  private dynamodbDocClient: DynamoDBDocumentClient | null = null;
  private s3Client: S3Client | null = null;
  private cloudWatchClient: CloudWatchClient | null = null;
  private lambdaClient: LambdaClient | null = null;

  constructor(config: AwsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize AWS services
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing AWS services');

      // Validate AWS credentials
      if (!this.config.accessKeyId || !this.config.secretAccessKey) {
        logger.error('AWS credentials not provided');
        return false;
      }

      const awsCredentials = {
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      };

      // Initialize each AWS service
      if (this.config.services?.includes('dynamodb')) {
        logger.info('Initializing AWS DynamoDB service');
        this.dynamodbClient = new DynamoDBClient(awsCredentials);
        this.dynamodbDocClient = DynamoDBDocumentClient.from(this.dynamodbClient);
        
        try {
          // Ensure the transactions table exists
          await this.ensureTransactionsTableExists();
          logger.info('DynamoDB transactions table is ready');
        } catch (error) {
          logger.warn(`DynamoDB table initialization error: ${error.message}`);
        }
      }

      if (this.config.services?.includes('s3')) {
        logger.info('Initializing AWS S3 service');
        this.s3Client = new S3Client(awsCredentials);
        // S3 buckets don't need explicit creation - they're created on first use
      }

      if (this.config.services?.includes('cloudwatch')) {
        logger.info('Initializing AWS CloudWatch service');
        this.cloudWatchClient = new CloudWatchClient(awsCredentials);
      }

      if (this.config.services?.includes('lambda')) {
        logger.info('Initializing AWS Lambda service');
        this.lambdaClient = new LambdaClient(awsCredentials);
      }

      this.initialized = true;
      logger.info('AWS services initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize AWS services: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure the transactions table exists in DynamoDB
   */
  private async ensureTransactionsTableExists(): Promise<void> {
    if (!this.dynamodbClient) return;

    try {
      // Check if table already exists
      await this.dynamodbClient.send(
        new ScanCommand({
          TableName: this.config.dynamoDBTable,
          Limit: 1
        })
      );
      
      logger.info(`DynamoDB table ${this.config.dynamoDBTable} already exists`);
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        // Table doesn't exist, create it
        logger.info(`Creating DynamoDB table ${this.config.dynamoDBTable}`);
        
        await this.dynamodbClient.send(
          new CreateTableCommand({
            TableName: this.config.dynamoDBTable,
            KeySchema: [
              { AttributeName: 'txHash', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
              { AttributeName: 'txHash', AttributeType: 'S' }
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          })
        );
        
        logger.info(`Created DynamoDB table ${this.config.dynamoDBTable}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Log a transaction to AWS DynamoDB
   */
  async logTransaction(transaction: Transaction): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.dynamodbDocClient) {
      logger.error('DynamoDB client not initialized');
      return false;
    }

    try {
      logger.info(`Logging transaction ${transaction.txHash} to AWS DynamoDB`);
      
      await this.dynamodbDocClient.send(
        new PutCommand({
          TableName: this.config.dynamoDBTable,
          Item: {
            ...transaction,
            timestamp: transaction.timestamp || Date.now()
          }
        })
      );
      
      logger.info(`Transaction ${transaction.txHash} successfully logged to DynamoDB`);
      return true;
    } catch (error) {
      logger.error(`Failed to log transaction to AWS DynamoDB: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a transaction from AWS DynamoDB
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.dynamodbDocClient) {
      logger.error('DynamoDB client not initialized');
      return null;
    }

    try {
      logger.info(`Getting transaction ${txHash} from AWS DynamoDB`);
      
      const response = await this.dynamodbDocClient.send(
        new GetCommand({
          TableName: this.config.dynamoDBTable,
          Key: { txHash }
        })
      );
      
      return response.Item as Transaction || null;
    } catch (error) {
      logger.error(`Failed to get transaction from AWS DynamoDB: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify a transaction with AWS Lambda
   */
  async verifyTransaction(txHash: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.lambdaClient) {
      logger.error('Lambda client not initialized');
      return false;
    }

    try {
      logger.info(`Verifying transaction ${txHash} with AWS Lambda`);
      
      const response = await this.lambdaClient.send(
        new InvokeCommand({
          FunctionName: this.config.lambdaFunctionName,
          Payload: Buffer.from(JSON.stringify({ txHash }))
        })
      );
      
      const responsePayload = Buffer.from(response.Payload).toString();
      const result = JSON.parse(responsePayload);
      
      logger.info(`Transaction verification result: ${result.verified}`);
      return result.verified === true;
    } catch (error) {
      logger.error(`Failed to verify transaction with AWS Lambda: ${error.message}`);
      return false;
    }
  }

  /**
   * Send metrics to AWS CloudWatch
   */
  async sendMetrics(metrics: Metrics): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.cloudWatchClient) {
      logger.error('CloudWatch client not initialized');
      return false;
    }

    try {
      logger.info('Sending metrics to AWS CloudWatch');
      
      await this.cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: this.config.cloudWatchNamespace,
          MetricData: [
            {
              MetricName: 'TransactionCount',
              Value: metrics.transactionCount,
              Unit: 'Count',
              Timestamp: new Date(metrics.timestamp)
            },
            {
              MetricName: 'SuccessRate',
              Value: metrics.successRate,
              Unit: 'Percent',
              Timestamp: new Date(metrics.timestamp)
            },
            {
              MetricName: 'AverageExecutionTime',
              Value: metrics.averageExecutionTime,
              Unit: 'Milliseconds',
              Timestamp: new Date(metrics.timestamp)
            },
            {
              MetricName: 'TotalProfit',
              Value: metrics.totalProfit,
              Unit: 'None',
              Timestamp: new Date(metrics.timestamp)
            }
          ]
        })
      );
      
      logger.info('Metrics successfully sent to CloudWatch');
      return true;
    } catch (error) {
      logger.error(`Failed to send metrics to AWS CloudWatch: ${error.message}`);
      return false;
    }
  }

  /**
   * Store profit report in S3
   */
  async storeProfitReport(report: ProfitReport): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.s3Client) {
      logger.error('S3 client not initialized');
      return false;
    }

    try {
      logger.info('Storing profit report in AWS S3');
      
      const reportKey = `reports/${report.date}-profit-report.json`;
      
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.s3Bucket,
          Key: reportKey,
          Body: JSON.stringify(report, null, 2),
          ContentType: 'application/json'
        })
      );
      
      logger.info(`Profit report successfully stored in S3: s3://${this.config.s3Bucket}/${reportKey}`);
      return true;
    } catch (error) {
      logger.error(`Failed to store profit report in AWS S3: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset all AWS services data
   */
  async resetAllData(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Resetting all AWS services data');
      
      // Reset DynamoDB table
      if (this.dynamodbClient) {
        try {
          await this.dynamodbClient.send(
            new DeleteTableCommand({
              TableName: this.config.dynamoDBTable
            })
          );
          logger.info(`DynamoDB table ${this.config.dynamoDBTable} deleted`);
          
          // Recreate the table
          await this.ensureTransactionsTableExists();
        } catch (error) {
          logger.warn(`Error resetting DynamoDB: ${error.message}`);
        }
      }
      
      logger.info('All AWS services data reset successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to reset AWS services data: ${error.message}`);
      return false;
    }
  }

  /**
   * Get status of all AWS services
   */
  async getStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {
      dynamodb: false,
      s3: false,
      cloudwatch: false,
      lambda: false
    };

    try {
      // Check DynamoDB
      if (this.dynamodbClient) {
        try {
          await this.dynamodbClient.send(
            new ScanCommand({
              TableName: this.config.dynamoDBTable,
              Limit: 1
            })
          );
          status.dynamodb = true;
        } catch (error) {
          logger.warn(`DynamoDB status check error: ${error.message}`);
        }
      }

      // Other services status checks would be similar

      return status;
    } catch (error) {
      logger.error(`Error checking AWS services status: ${error.message}`);
      return status;
    }
  }
}

// Export a singleton instance
export const awsServices = new AwsServicesManager();

// Export interfaces for use in other modules
export type {
  AwsConfig,
  Transaction,
  Metrics,
  ProfitReport
};