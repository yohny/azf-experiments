import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";
import { v4 as uuidv4 } from 'uuid';

import { TableClient } from "@azure/data-tables";
import { RemoteSupportRequestEntity } from "./RemoteSupportRequest";

export async function registerSR(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const assetId = request.params.assetId;
    if(!assetId) {
        return { status: 400, body: 'Please provide an assetId' };
    }
    const user = request.headers.get('x-ms-client-principal-name');
    if(!user) {
        throw new Error('Missing user');
    }

    // const tc = new TableClient(
    // `https://iotsamplesa492.table.core.windows.net`,
    // 'RemoteSupportRequests',
    // new DefaultAzureCredential()
    // );
    const tc = TableClient.fromConnectionString(
        'UseDevelopmentStorage=true',
        'RemoteSupportRequests');
    //await tc.createTable()

    const query =  tc.listEntities({queryOptions: {filter: `PartitionKey eq '${assetId}' and StartedAt eq null`} });
    let cnt = 0
    for await (const entity of query) {
        cnt++;
        if(cnt > 0) {
            return { status: 400, body: 'Pending Support Request already exists for this asset' };
        }
    }

    const query2 =  tc.listEntities({queryOptions: {filter: `RequestedBy eq '${user}' and StartedAt eq null`} });
    let cnt2 = 0
    for await (const entity of query2) {
        cnt2++;
        if(cnt2 > 0) {
            return { status: 400, body: 'Pending Support Request already exists for this user' };
        }
    }

    const key = uuidv4();
    const entity: RemoteSupportRequestEntity = {
        partitionKey: assetId,
        requestedBy: user,
        requestedAt: new Date(),
        rowKey: key
    };
    tc.createEntity(entity);

    return { status: 201, body: key };
};

app.http('registerSR', {
    methods: ['POST'],
    route: 'registerSR/{assetId}',
    authLevel: 'anonymous',
    handler: registerSR
});
