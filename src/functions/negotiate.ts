import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  input,
} from "@azure/functions";
import { TableStorageService } from "./shared/TableStorageService";

const inputSignalR = input.generic({
  type: "signalRConnectionInfo",
  name: "connectionInfo",
  hubName: "serverless",
  userId: "{headers.x-ms-signalr-userid}",
  //connectionStringSetting: 'SIGNALR_CONNECTION_STRING', // only if we want to override connection string name, default is AzureSignalRConnectionString
});

async function negotiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  //request.user is null, maybe with proper auth it would be filled
  const user = request.headers.get("x-ms-signalr-userid");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  const tss = new TableStorageService();
  if (!(await tss.pendingOrActiveSupportRequestExists(user))) {
    // TODO: get user from request
    return { status: 403, body: "Unauthorized" };
  }

  try {
    return { body: JSON.stringify(context.extraInputs.get(inputSignalR)) };
  } catch (error) {
    context.log(error);
    return {
      status: 500,
      jsonBody: error,
    };
  }
}

app.post("negotiate", {
  authLevel: "anonymous",
  handler: negotiate,
  route: "negotiate",
  extraInputs: [inputSignalR],
});
