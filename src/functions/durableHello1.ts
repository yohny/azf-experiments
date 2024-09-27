import {
  app,
  HttpHandler,
  HttpRequest,
  HttpResponse,
  InvocationContext,
} from "@azure/functions";
import * as df from "durable-functions";
import {
  ActivityHandler,
  OrchestrationContext,
  OrchestrationHandler,
} from "durable-functions";

const activityName = "durableHello1";

const durableHello1Orchestrator: OrchestrationHandler = function* (
  context: OrchestrationContext
) {
  const outputs = [];
  outputs.push(yield context.df.callActivity(activityName, "Tokyo"));
  outputs.push(yield context.df.callActivity(activityName, "Seattle"));
  outputs.push(yield context.df.callActivity(activityName, "Cairo"));

  return outputs;
};
df.app.orchestration("durableHello1Orchestrator", durableHello1Orchestrator);

const durableHello1: ActivityHandler = (input: string): string => {
  return `Hello, ${input}`;
};
df.app.activity(activityName, { handler: durableHello1 });

const durableHello1HttpStart: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponse> => {
  const client = df.getClient(context);
  const body: unknown = await request.text();
  const instanceId: string = await client.startNew(
    request.params.orchestratorName,
    { input: body }
  );

  context.log(`Started orchestration with ID = '${instanceId}'.`);

  return client.createCheckStatusResponse(request, instanceId);
};

app.http("durableHello1HttpStart", {
  route: "orchestrators/{orchestratorName}",
  extraInputs: [df.input.durableClient()],
  handler: durableHello1HttpStart,
});
