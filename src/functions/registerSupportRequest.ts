import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  input,
  output,
} from "@azure/functions";
import { TableStorageService } from "./shared/TableStorageService";

async function registerSR(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const assetId = request.params.assetId;
  if (!assetId) {
    return { status: 400, body: "Missing assetId" };
  }
  const user = request.headers.get("x-user-id");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  // can not use input for desired filtering, because the filter experession only supports route params, no headers
  // const found = context.extraInputs.get(tableInput);
  const tss = new TableStorageService();
  if (await tss.pendingOrActiveSupportRequestExists(user, assetId)) {
    return {
      status: 400,
      body: "Pending or Active Support Request already exists for this asset or user",
    };
  }

  // output works as well, but there is no way to get the generated rowKey
  // context.extraOutputs.set(tableOutput, {
  //   requestedBy: user,
  //   requestedAt: new Date(),
  // });
  const key = await tss.createSupportRequest(assetId, user);
  return { status: 201, body: key };
}

const tableInput = input.table({
  tableName: "RemoteSupportRequests",
  filter:
    "(PartitionKey eq '{assetId}' or requestedBy eq '{header.x-user-id}' or providedBy eq '{header.x-user-id}') and finishedAt eq null",
  connection: "AzureWebJobsStorage",
});

const tableOutput = output.table({
  tableName: "RemoteSupportRequests",
  partitionKey: "{assetId}",
  rowKey: "{rand-guid}",
  connection: "AzureWebJobsStorage",
});

app.post("registerSR", {
  route: "registerSR/{assetId}",
  authLevel: "anonymous",
  //extraInputs: [tableInput],
  //extraOutputs: [tableOutput],
  handler: registerSR,
});
