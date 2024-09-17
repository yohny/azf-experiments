import { app, HttpRequest, HttpResponseInit, InvocationContext, input } from "@azure/functions";

const inputSignalR = input.generic({
    type: 'signalRConnectionInfo',
    name: 'connectionInfo',
    hubName: 'serverless',
    userId: '{headers.x-ms-signalr-userid}'
    //connectionStringSetting: 'SIGNALR_CONNECTION_STRING', // only if we want to override connection string name, default is AzureSignalRConnectionString
});

export async function negotiate(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    //todo: refuse connection if there is no pending request by user as requestedBy or no active request by user as providedBy (return 403 Unauthorized)
    try {
        return { body: JSON.stringify(context.extraInputs.get(inputSignalR)) }
    } catch (error) {
        context.log(error);
        return {
            status: 500,
            jsonBody: error
        }
    }
};

app.post('negotiate', {
    authLevel: 'anonymous',
    handler: negotiate,
    route: 'negotiate',
    extraInputs: [inputSignalR],
});
