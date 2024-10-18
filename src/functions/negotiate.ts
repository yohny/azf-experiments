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
  userId: "{headers.x-ms-client-principal-name}", // normally filled by Azure when using Azure auth., but in this sample we are adding it on clients manually
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
    // return { jsonBody: context.extraInputs.get(inputSignalR) };
    const connStr = process.env.AzureSignalRConnectionString!;
    const endpoint = /Endpoint=(.*?);/.exec(connStr)![1];
    const port = /Port=(.*?);/.exec(connStr)![1];
    const accessKey = /AccessKey=(.*?);/.exec(connStr)![1];
    const token = sign(
      {
        aud: `${endpoint}/client/?hub=serverless`, // audience is withot port
        "asrs.s.uid": "my-user", // manualy set user identity
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
