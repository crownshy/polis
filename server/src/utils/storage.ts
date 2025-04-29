/* eslint-disable no-console */
import {
  CreateTableCommand,
  DeleteItemCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import config from "../config";
import logger from "./logger";

type Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
}

type ClientConfig = {
  region: string;
  endpoint?: string;
  credentials: Credentials;
}

export default class DynamoStorageService {
  private client: DynamoDBClient;
  private tableName: string;
  private cacheDisabled: boolean;

  constructor(tableName: string, disableCache?: boolean) {
    const credentials: Credentials = {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    }
    const clientConfig: ClientConfig = { region: config.awsRegion, credentials };

    if (config.dynamoDbEndpoint) {
      clientConfig.endpoint = config.dynamoDbEndpoint;
    }
    
    this.client = new DynamoDBClient(clientConfig);
    this.tableName = tableName;
    this.cacheDisabled = disableCache || false;
  }

  /**
   * Checks if the table exists, and if not, creates it.
   */
  async initTable(): Promise<void> {
    try {
      const describeCmd = new DescribeTableCommand({
        TableName: this.tableName,
      });
      await this.client.send(describeCmd);
      logger.info(`Table "${this.tableName}" already exists.`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        logger.info(`Table "${this.tableName}" not found. Creating now...`);
        const createCmd = new CreateTableCommand({
          TableName: this.tableName,
          AttributeDefinitions: [
            { AttributeName: "rid_section_model", AttributeType: "S" },
            { AttributeName: "timestamp", AttributeType: "S" },
          ],
          KeySchema: [
            { AttributeName: "rid_section_model", KeyType: "HASH" },
            { AttributeName: "timestamp", KeyType: "RANGE" },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        });
        await this.client.send(createCmd);
        logger.info(`Table "${this.tableName}" created successfully.`);
      } else {
        throw error;
      }
    }
  }

  async putItem(item: Record<string, unknown> | undefined) {
    const params = {
      TableName: this.tableName,
      Item: item,
    };

    const command = new PutCommand(params);

    try {
      const response = await this.client.send(command);
      console.log(`item stored successfully: ${response}`);
      return response;
    } catch (error) {
      logger.error(error)
    }
  }

  async queryItemsByRidSectionModel(rid_section_model: string) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: "rid_section_model = :rid_section_model",
      ExpressionAttributeValues: {
        ":rid_section_model": rid_section_model,
      },
    };

    const command = new QueryCommand(params);

    if (this.cacheDisabled) {
      return [];
    }

    try {
      const data = await this.client.send(command);
      return data.Items;
    } catch (error) {
      logger.error("Error querying items:", error);
    }
  }

  async deleteReportItem(rid_section_model: string, timestamp: string) {
    const params = {
      TableName: this.tableName,
      Key: {
        rid_section_model: rid_section_model,
        timestamp: timestamp,
      },
    };

    const command = new DeleteCommand(params);

    try {
      const response = await this.client.send(command);
      logger.info("Item deleted successfully:", response);
      return response;
    } catch (error) {
      logger.error("Error deleting item:", error);
    }
  }

  async deleteAllByReportID(reportIdPrefix: string) {
    if (!reportIdPrefix) {
      console.error("reportIdPrefix cannot be empty or null.");
      return;
    }

    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const scanParams: ScanCommandInput = {
        TableName: this.tableName,
        FilterExpression: "begins_with(rid_section_model, :reportIdPrefix)",
        ExpressionAttributeValues: {
          // @ts-expect-error dynamo
          ":reportIdPrefix": String(reportIdPrefix),
        },
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const scanCommand = new ScanCommand(scanParams);
      let itemsToDelete;

      try {
        const scanResponse = await this.client.send(scanCommand);
        itemsToDelete = scanResponse.Items;
        lastEvaluatedKey = scanResponse.LastEvaluatedKey; // Capture for next iteration

        if (!itemsToDelete || itemsToDelete.length === 0) {
          if (!lastEvaluatedKey) {
            console.log(
              `No items found with report ID prefix: ${reportIdPrefix}`
            );
          }
          break;
        }
        console.log(
          `Found ${itemsToDelete.length} items to delete in this batch.`
        );
      } catch (scanError) {
        console.error("Error scanning for items:", scanError);
        return;
      }
      const deletePromises = itemsToDelete.map(async (item) => {
        const rid_section_model = item.rid_section_model;
        const timestamp = item.timestamp;

        const deleteParams = {
          TableName: this.tableName,
          Key: {
            rid_section_model: { S: rid_section_model },
            timestamp: { S: timestamp },
          },
        };

        const deleteItemCommand = new DeleteItemCommand(deleteParams);

        try {
          await this.client.send(deleteItemCommand);
          console.log(
            `Deleted item with rid_section_model: ${rid_section_model}${
              timestamp ? `, timestamp: ${timestamp}` : ""
            }`
          );
        } catch (deleteError) {
          console.error(
            `Error deleting item: rid_section_model: ${rid_section_model}${
              timestamp ? `, timestamp: ${timestamp}` : ""
            }`,
            deleteError
          );
        }
      });

      await Promise.all(deletePromises);
    } while (lastEvaluatedKey);
  }

  async getAllByReportID(reportIdPrefix: string) {
    if (!reportIdPrefix) {
      console.error("reportIdPrefix cannot be empty or null.");
      return [];
    }

    const scanParams = {
      TableName: this.tableName,
      FilterExpression: "begins_with(rid_section_model, :reportIdPrefix)",
      ExpressionAttributeValues: {
        ":reportIdPrefix": String(reportIdPrefix),
      },
    };

    const scanCommand = new ScanCommand(scanParams);

    try {
      const scanResponse = await this.client.send(scanCommand);
      const items = scanResponse.Items;

      if (!items || items.length === 0) {
        console.log(`No items found with report ID prefix: ${reportIdPrefix}`);
        return [];
      }

      console.log(
        `Found ${items.length} items with report ID prefix: ${reportIdPrefix}`
      );

      return items;
    } catch (scanError) {
      console.error("Error scanning for items:", scanError);
      return;
    }
  }
}
