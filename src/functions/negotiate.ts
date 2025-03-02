import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  input,
} from "@azure/functions";
import { TableStorageService } from "./shared/TableStorageService";
import { sign } from "jsonwebtoken";

const inputSignalR = input.generic({
  type: "signalRConnectionInfo",
  name: "connectionInfo",
  hubName: "serverless",
  //userId: "{headers.x-ms-client-principal-name}", // this header is filled by Azure when using Azure auth., not our case
  //userId: "{headers.x-user-id", // we can also specify custom header, but thats still not enough as we also want to check if there is pending or active support request for the user
  //idToken: "{headers.authorization}", // works only if there is IWT without any prefix (like 'Bearer', so not really usefull for standard Oauth flows)
  //claimTypeList: ["name", "email"], // specified claims are sucessfully propagated from incoming JWT to access token, but SignalR does not recognize them as user identity (it expects idenity in "asrs.s.uid" claim)
  //connectionStringSetting: 'SIGNALR_CONNECTION_STRING', // only if we want to override connection string setting name, default is AzureSignalRConnectionString
});

async function negotiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // minimal implementation
  // return { jsonBody: context.extraInputs.get(inputSignalR) };
  // it just passees user identity and tokens from inputSignalR binding above, but its not enought for our case
  // as we want to take identity from custom header (or custom JWT) and need to put it in claim of specific name to be recognized by SIgnalR (asrs.s.uid)
  // also we want to verify that  there is pending or active support request for the user

  // in reality we would take user identty from incoming JWT, but here we take it from header set by client
  const user = request.headers.get("x-user-id");
  if (!user) {
    return { status: 400, body: "Missing user" };
  }

  const tss = new TableStorageService();
  // ideally client should specify (in headers or query params) what Support request he wants to connest to (assetId + key)
  // we would then load it and werify if its still pending, if it has correct user etc.
  // const sr = await tss.getSupportRequest(assetId, key);
  // if (!sr) {
  //   return { status: 403, body: "Unauthorized" };
  // }
  // but for now we just check if there is any pending or active support request for the user
  const sr = await tss.getPendingOrActiveSupportRequest(user);
  if (!sr) {
    return { status: 403, body: "Unauthorized" };
  }

  // based on https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-concept-client-negotiation#self-exposing-negotiate-endpoint
  try {
    const connStr = process.env.AzureSignalRConnectionString!;
    const endpoint = /Endpoint=(.*?);/.exec(connStr)![1];
    const port = /Port=(.*?);/.exec(connStr)![1];
    const accessKey = /AccessKey=(.*?);/.exec(connStr)![1];
    const token = sign(
      {
        aud: `${endpoint}/client/?hub=serverless`, // audience is withot port
        "asrs.s.uid": user, // claim used by SignalR Service to hold user identity
        assetId: sr.partitionKey, // custom claim
        sessionId: sr.rowKey, // custom claim
      },
      accessKey,
      {
        expiresIn: 3600,
      }
    );
    return {
      jsonBody: {
        url: `${endpoint}:${port}/client/?hub=serverless`,
        accessToken: token,
      },
    };
  } catch (error) {
    context.error("Failed to produce connection info", error);
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
