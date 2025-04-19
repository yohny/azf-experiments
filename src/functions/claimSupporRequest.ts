import {
  app,
  HttpRequest,
  HttpResponseInit,
  input,
  InvocationContext,
} from "@azure/functions";
import { TableStorageService } from "./shared/TableStorageService";

export async function claimSR(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const assetId = request.params.assetId;
  if (!assetId) {
    return { status: 400, body: "Please provide an assetId" };
  }
  const key = request.params.key;
  if (!key) {
    return { status: 400, body: "Please provide a key" };
  }
  const user = request.headers.get("x-user-id");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  const tss = new TableStorageService();
  const entity = await tss.getSupportRequest(assetId, key);
  // OR use table storage binding to get the entity (bug https://github.com/Azure/azure-functions-host/issues/10356)
  //const entity = context.extraInputs.get(tableInput);
  if (entity.providedBy) {
    return { status: 409, body: "Support request already claimed" };
  }

  await tss.claimSupportRequest(assetId, key, user, entity.etag);

  return { status: 204 };
}

const tableInput = input.table({
  tableName: "RemoteSupportRequests",
  partitionKey: "{assetId}",
  rowKey: "{key}",
  connection: "AzureWebJobsStorage",
});

app.http("claimSR", {
  methods: ["POST"],
  route: "claimSR/{assetId}/{key}",
  //extraInputs: [tableInput],
  authLevel: "anonymous",
  handler: claimSR,
});
