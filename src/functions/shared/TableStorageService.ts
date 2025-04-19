import { TableClient, TableEntityResult } from "@azure/data-tables";
import { RemoteSupportRequest } from "../RemoteSupportRequest";
import { randomUUID } from "crypto";

export class TableStorageService {
  // const tc = new TableClient(
  // `https://iotsamplesa492.table.core.windows.net`,
  // 'RemoteSupportRequests',
  // new DefaultAzureCredential()
  // );
  private readonly _tableClient = TableClient.fromConnectionString(
    process.env["AzureWebJobsStorage"]!,
    "RemoteSupportRequests"
  );

  public async pendingOrActiveSupportRequestExists(
    user: string,
    assetId?: string
  ): Promise<boolean> {
    var assetQueryPart = assetId ? ` or PartitionKey eq '${assetId}'` : null;
    const query = this._tableClient.listEntities({
      queryOptions: {
        filter: `(requestedBy eq '${user}' or providedBy eq '${user}'${
          assetQueryPart ? assetQueryPart : ""
        }) and finishedAt eq null`, //filtering null does not work against real Azure Table storage (but works fine agains Azurite)
        // there is also no index support to prevent inserting another pending/active record for the same user/asset
        //maybe Cosmos DB can do this?
      },
    });
    let cnt = 0;
    for await (const entity of query) {
      cnt++;
      if (cnt > 0) {
        return true;
      }
    }
    return false;
  }

  public async createSupportRequest(
    assetId: string,
    user: string
  ): Promise<string> {
    const key = randomUUID();
    await this._tableClient.createEntity<RemoteSupportRequest>({
      partitionKey: assetId,
      rowKey: key,
      requestedBy: user,
      requestedAt: new Date(),
    });
    return key;
  }

  public async getSupportRequest(assetId: string, key: string) {
    return await this._tableClient.getEntity<RemoteSupportRequest>(
      assetId,
      key
    );
  }

  public async claimSupportRequest(
    assetId: string,
    key: string,
    user: string,
    etag: string
  ) {
    await this._tableClient.updateEntity<Partial<RemoteSupportRequest>>(
      {
        partitionKey: assetId,
        rowKey: key,
        providedBy: user,
        providedAt: new Date(),
      },
      "Merge",
      { etag: etag }
    );
  }

  public async updateSupportRequestRequestorConnected(
    assetId: string,
    key: string,
    connectionId: string
  ) {
    await this._tableClient.updateEntity<Partial<RemoteSupportRequest>>(
      {
        partitionKey: assetId,
        rowKey: key,
        requestorConnectionId: connectionId,
        requestorConnectedAt: new Date(),
      },
      "Merge"
    );
  }

  public async updateSupportRequestProviderConnected(
    assetId: string,
    key: string,
    connectionId: string
  ) {
    await this._tableClient.updateEntity<Partial<RemoteSupportRequest>>(
      {
        partitionKey: assetId,
        rowKey: key,
        providerConnectionId: connectionId,
        providerConnectedAt: new Date(),
      },
      "Merge"
    );
  }

  public async finishSupportRequest(assetId: string, key: string) {
    await this._tableClient.updateEntity<Partial<RemoteSupportRequest>>(
      {
        partitionKey: assetId,
        rowKey: key,
        finishedAt: new Date(),
      },
      "Merge"
      //{ etag: etag }
      // with concurrency check (etag) this might fail if someone else in the meantime claimed or finished the request:
      //  if it fails because it was claimed, ideally we would retry once to get the fresh entity and notify the other side (claimer/provider) about our disconnection (after updating finishedAt)
      //  if it fails because it was finished, the retry would also work as it would not find the entity anymore and thus we would not do anything (no need to set finishedAt, no need to notify anyone as they are disconnected already)
      // without concurrency check (and subsequent missing retry which reloads the entity), we might miss notifying the other side if the request was claimed in the meantime which is acceptable
    );
  }
}
