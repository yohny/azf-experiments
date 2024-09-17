import { app, HttpRequest, HttpResponseInit, InvocationContext, input } from "@azure/functions";

const tableInput = input.table({
    tableName: 'Person',
    partitionKey: 'Test',
    rowKey: '{key}',
    connection: 'AzureWebJobsStorage',
});

export async function readTable(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const tableData = context.extraInputs.get(tableInput)

    return { jsonBody: tableData };
};

app.http('readTable', {
    methods: ['GET'],
    route: 'read/{key}',
    extraInputs: [tableInput],
    authLevel: 'anonymous',
    handler: readTable
});
