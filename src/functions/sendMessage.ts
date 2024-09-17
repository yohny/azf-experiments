import {
  app,
  output,
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";

const signalR = output.generic({
  type: "signalR",
  name: "signalR",
  hubName: "serverless",
});

async function sendMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const data = (await request.json()) as any;
  data.sender =
    (request.headers && request.headers.get("x-ms-client-principal-name")) ||
    "";

  let recipientUserId = "";
  if (data.recipient) {
    recipientUserId = data.recipient;
    data.isPrivate = true;
  }
  context.extraOutputs.set(signalR, {
    //userId: recipientUserId,
    target: "groupMessage",
    arguments: [data.message],
    groupName: data.group,
  });
  return { status: 201 };
}

app.http("messages", {
  methods: ["POST"],
  authLevel: "anonymous",
  extraOutputs: [signalR],
  handler: sendMessage,
});
