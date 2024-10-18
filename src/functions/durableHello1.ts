import {
  app,
  HttpHandler,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getClient, input, app as dfApp } from "durable-functions";
import { OrchestrationContext, OrchestrationHandler } from "durable-functions";

const connectionDroppedOrchestrator: OrchestrationHandler = function* (
  context: OrchestrationContext
) {
  // The connection has 2 min to recover
  const expiration = new Date(
    context.df.currentUtcDateTime.valueOf() + 2 * 60 * 1000
  );

  const timeoutTask = context.df.createTimer(expiration);
  const connectionrestoredTask =
    context.df.waitForExternalEvent("ConnectionRestored");

  const winner = yield context.df.Task.any([
    connectionrestoredTask,
    timeoutTask,
  ]);

  if (winner === timeoutTask) {
    // Timeout expired without reconnection - return disconected (true)
    return true;
  }

  // Connection restored - return connected (false)
  if (!timeoutTask.isCompleted) {
    // All pending timers must be complete or canceled before the function exits.
    timeoutTask.cancel();
  }
  return false;
};

dfApp.orchestration(
  "connectionDroppedOrchestrator",
  connectionDroppedOrchestrator
);

const connectionStateChangeHandler: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  if (!request.params.state || !request.params.connectionId) {
    return {
      status: 400,
      body: "Misisng state or connectionId",
    };
  }
  const state = request.params.state;
  if (state !== "on" && state !== "off") {
    return {
      status: 400,
      body: "Invalid connection state value",
    };
  }

  const client = getClient(context);

  if (state === "off") {
    const instanceId = await client.startNew("connectionDroppedOrchestrator", {
      instanceId: request.params.connectionId,
    });
    context.log(
      `Started 'connectionDroppedOrchestrator' with ID = '${instanceId}'.`
    );
    return client.createCheckStatusResponse(request, instanceId);
  } else {
    try {
      await client.raiseEvent(
        request.params.connectionId,
        "ConnectionRestored",
        null
      );
    } catch (error) {
      context.error(error);
    }
    return { status: 202, body: "Connection restored event raised" };
  }
};

app.http("durableConnectionState", {
  route: "connection/{connectionId}/{state}",
  extraInputs: [input.durableClient()],
  handler: connectionStateChangeHandler,
});
