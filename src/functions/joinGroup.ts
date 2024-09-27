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

async function joinGroup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const data = (await request.json()) as any;
  context.extraOutputs.set(signalR, {
    //userId: request.query.userId,
    connectionId: data.connectionId,
    groupName: data.group,
    action: "add",
  });
  return { status: 201 };
}

app.http("groups", {
  methods: ["PUT"],
  authLevel: "anonymous",
  extraOutputs: [signalR],
  handler: joinGroup,
});
