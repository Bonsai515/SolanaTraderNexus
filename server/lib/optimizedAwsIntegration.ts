/**
 * Optimized AWS Integration
 * 
 * High-performance AWS services integration with batch processing,
 * request pooling, and compression.
 */

import { logger } from '../../logger';
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';
import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand,
  BatchWriteItemCommand
} from '@aws-sdk/client-dynamodb';
import { 
  S3Client, 
  PutObjectCommand,
  GetObjectCommand
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
  BatchWriteCommand,
  BatchGetCommand
} from '@aws-sdk/lib-dynamodb';

// Load AWS configuration
let awsConfig: any = {
  batchSize: 25,
  maxConcurrentRequests: 10,
  enableCompression: true,
  useParallelUploads: true,
  regionOptimization: true,
  cacheCredentials: true,
  localBuffering: true
};

try {
  const configPath = path.join(__dirname, '..', '..', '..', 'data', 'aws-config.json');
  if (fs.existsSync(configPath)) {
    awsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info('Loaded AWS configuration from file');
  }
} catch (error) {
  logger.warn(`Failed to load AWS configuration: ${error.message}`);
}

// Transaction interface
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
  [key: string]: any;
}

// Metrics interface
interface Metrics {
  transactionCount: number;
  successRate: number;
  averageExecutionTime: number;
  totalProfit: number;
  timestamp: number;
  [key: string]: any;
}

// AWS integration class
export class OptimizedAwsIntegration {
  private dynamodbClient: DynamoDBClient | null = null;
  private dynamodbDocClient: DynamoDBDocumentClient | null = null;
  private s3Client: S3Client | null = null;
  private cloudWatchClient: CloudWatchClient | null = null;
  private lambdaClient: LambdaClient | null = null;
  private isInitialized = false;
  private transactionBatch: Transaction[] = [];
  private metricsBatch: Metrics[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeRequests = 0;
  private maxConcurrentRequests: number;
  
  constructor(
    private region: string = 'us-east-1',
    private dynamoDBTable: string = 'solana-trading-transactions',
    private s3Bucket: string = 'solana-trading-reports',
    private cloudWatchNamespace: string = 'SolanaTrading',
    private config = awsConfig
  ) {
    this.maxConcurrentRequests = config.maxConcurrentRequests;
  }
  
  /**
   * Initialize AWS services
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Check for AWS credentials
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        logger.warn('AWS credentials not found in environment');
        return false;
      }
      
      const credentials = {
        region: this.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      };
      
      // Initialize clients
      this.dynamodbClient = new DynamoDBClient(credentials);
      this.dynamodbDocClient = DynamoDBDocumentClient.from(this.dynamodbClient);
      this.s3Client = new S3Client(credentials);
      this.cloudWatchClient = new CloudWatchClient(credentials);
      this.lambdaClient = new LambdaClient(credentials);
      
      // Start batch processing
      this.startBatchProcessing();
      
      this.isInitialized = true;
      logger.info('Optimized AWS Integration initialized');
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize AWS integration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Start batch processing
   */
  private startBatchProcessing(): void {
    // Process batches periodically
    this.batchTimer = setInterval(() => {
      this.processBatches();
    }, 5000); // Process every 5 seconds
  }
  
  /**
   * Process batches
   */
  private async processBatches(): Promise<void> {
    try {
      // Process transaction batch
      if (this.transactionBatch.length > 0) {
        await this.flushTransactionBatch();
      }
      
      // Process metrics batch
      if (this.metricsBatch.length > 0) {
        await this.flushMetricsBatch();
      }
    } catch (error) {
      logger.error(`Error processing batches: ${error.message}`);
    }
  }
  
  /**
   * Flush transaction batch
   */
  private async flushTransactionBatch(): Promise<void> {
    if (!this.dynamodbDocClient || this.transactionBatch.length === 0) return;
    
    try {
      // Wait for available request slot
      await this.waitForRequestSlot();
      
      // Increment active requests
      this.activeRequests++;
      
      // Take batch
      const batch = this.transactionBatch.splice(0, this.config.batchSize);
      
      // Prepare batch write request
      const putRequests = batch.map(transaction => ({
        PutRequest: {
          Item: transaction
        }
      }));
      
      // Split into chunks if needed (DynamoDB limit is 25 items per batch)
      const chunks = [];
      for (let i = 0; i < putRequests.length; i += 25) {
        chunks.push(putRequests.slice(i, i + 25));
      }
      
      // Execute each chunk
      for (const chunk of chunks) {
        await this.dynamodbDocClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.dynamoDBTable]: chunk
            }
          })
        );
      }
      
      logger.info(`Flushed ${batch.length} transactions to DynamoDB`);
    } catch (error) {
      logger.error(`Failed to flush transaction batch: ${error.message}`);
      
      // Put items back in batch
      this.transactionBatch.unshift(...this.transactionBatch.splice(0, this.config.batchSize));
    } finally {
      // Decrement active requests
      this.activeRequests--;
    }
  }
  
  /**
   * Flush metrics batch
   */
  private async flushMetricsBatch(): Promise<void> {
    if (!this.cloudWatchClient || this.metricsBatch.length === 0) return;
    
    try {
      // Wait for available request slot
      await this.waitForRequestSlot();
      
      // Increment active requests
      this.activeRequests++;
      
      // Take batch
      const batch = this.metricsBatch.splice(0, this.config.batchSize);
      
      // Prepare metric data
      const metricData = [];
      
      for (const metrics of batch) {
        for (const [key, value] of Object.entries(metrics)) {
          if (key === 'timestamp') continue;
          
          metricData.push({
            MetricName: key,
            Value: value as number,
            Unit: key.includes('Rate') ? 'Percent' : 'None',
            Timestamp: new Date(metrics.timestamp)
          });
        }
      }
      
      // Split into chunks if needed (CloudWatch limit is 20 metrics per request)
      const chunks = [];
      for (let i = 0; i < metricData.length; i += 20) {
        chunks.push(metricData.slice(i, i + 20));
      }
      
      // Execute each chunk
      for (const chunk of chunks) {
        await this.cloudWatchClient.send(
          new PutMetricDataCommand({
            Namespace: this.cloudWatchNamespace,
            MetricData: chunk
          })
        );
      }
      
      logger.info(`Flushed ${batch.length} metrics to CloudWatch`);
    } catch (error) {
      logger.error(`Failed to flush metrics batch: ${error.message}`);
      
      // Put items back in batch
      this.metricsBatch.unshift(...this.metricsBatch.splice(0, this.config.batchSize));
    } finally {
      // Decrement active requests
      this.activeRequests--;
    }
  }
  
  /**
   * Wait for available request slot
   */
  private async waitForRequestSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrentRequests) {
      return;
    }
    
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.activeRequests < this.maxConcurrentRequests) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
  
  /**
   * Log a transaction
   */
  async logTransaction(transaction: Transaction): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    // Add transaction to batch
    this.transactionBatch.push({
      ...transaction,
      timestamp: transaction.timestamp || Date.now()
    });
    
    // Flush batch if it's full
    if (this.transactionBatch.length >= this.config.batchSize) {
      await this.flushTransactionBatch();
    }
    
    return true;
  }
  
  /**
   * Log metrics
   */
  async logMetrics(metrics: Metrics): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    // Add metrics to batch
    this.metricsBatch.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    // Flush batch if it's full
    if (this.metricsBatch.length >= this.config.batchSize) {
      await this.flushMetricsBatch();
    }
    
    return true;
  }
  
  /**
   * Upload file to S3
   */
  async uploadToS3(
    key: string,
    data: string | Buffer,
    contentType: string = 'application/json'
  ): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    if (!this.s3Client) return false;
    
    try {
      // Wait for available request slot
      await this.waitForRequestSlot();
      
      // Increment active requests
      this.activeRequests++;
      
      // Compress data if enabled
      let body: Buffer | string = data;
      
      if (this.config.enableCompression && typeof data === 'string') {
        // This is a simplified example - in production you would use proper compression
        body = Buffer.from(data);
      }
      
      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      );
      
      logger.info(`Uploaded ${key} to S3`);
      return true;
    } catch (error) {
      logger.error(`Failed to upload to S3: ${error.message}`);
      return false;
    } finally {
      // Decrement active requests
      this.activeRequests--;
    }
  }
  
  /**
   * Invoke Lambda function
   */
  async invokeLambda(
    functionName: string,
    payload: any
  ): Promise<any> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }
    
    if (!this.lambdaClient) return null;
    
    try {
      // Wait for available request slot
      await this.waitForRequestSlot();
      
      // Increment active requests
      this.activeRequests++;
      
      // Invoke Lambda
      const response = await this.lambdaClient.send(
        new InvokeCommand({
          FunctionName: functionName,
          Payload: Buffer.from(JSON.stringify(payload))
        })
      );
      
      // Parse response
      const responsePayload = Buffer.from(response.Payload as Uint8Array).toString();
      
      try {
        return JSON.parse(responsePayload);
      } catch (e) {
        return responsePayload;
      }
    } catch (error) {
      logger.error(`Failed to invoke Lambda: ${error.message}`);
      return null;
    } finally {
      // Decrement active requests
      this.activeRequests--;
    }
  }
  
  /**
   * Get AWS integration stats
   */
  getStats(): any {
    return {
      transactionBatchSize: this.transactionBatch.length,
      metricsBatchSize: this.metricsBatch.length,
      activeRequests: this.activeRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Flush all batches
   */
  async flushAll(): Promise<void> {
    await this.processBatches();
  }
  
  /**
   * Shutdown AWS integration
   */
  shutdown(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    // Flush any remaining batches
    this.processBatches().catch(e => {
      logger.error(`Error flushing batches during shutdown: ${e.message}`);
    });
  }
}

// Export singleton instance
let awsIntegration: OptimizedAwsIntegration | null = null;

export function getAwsIntegration(): OptimizedAwsIntegration {
  if (!awsIntegration) {
    awsIntegration = new OptimizedAwsIntegration();
  }
  return awsIntegration;
}