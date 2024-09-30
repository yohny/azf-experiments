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
  userId: "{headers.x-ms-client-principal-name}", // normally filled by Azure when using Azure auth., but in this sample we are adding it on clinets manually
  //idToken: "{headers.authorization}", // needs to remove 'Bearer ' from header to parse JWT successfully
  //claimTypeList: ["name", "email"], // claims are sucessfully propagated to acess token, but SignalR does not recognize/use them as user identity
  //connectionStringSetting: 'SIGNALR_CONNECTION_STRING', // only if we want to override connection string setting name, default is AzureSignalRConnectionString
});

async function negotiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  //request.user is null, maybe with proper auth it would be filled?
  const user = request.headers.get("x-ms-client-principal-name");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  const tss = new TableStorageService();
  if (!(await tss.pendingOrActiveSupportRequestExists(user))) {
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
