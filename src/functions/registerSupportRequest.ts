import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
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
  const user = request.headers.get("x-ms-client-principal-name");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  const tss = new TableStorageService();
  if (await tss.pendingOrActiveSupportRequestExists(user, assetId)) {
    return {
      status: 400,
      body: "Pending or Active Support Request already exists for this asset or user",
    };
  }

  const key = await tss.createSupportRequest(assetId, user);
  return { status: 201, body: key };
}

app.http("registerSR", {
  methods: ["POST"],
  route: "registerSR/{assetId}",
  authLevel: "anonymous",
  handler: registerSR,
});
