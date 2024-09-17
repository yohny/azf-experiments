import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";

import { TableClient } from "@azure/data-tables";
import { RemoteSupportRequestEntity } from "./RemoteSupportRequest";

export async function claimSR(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const assetId = request.params.assetId;
    if(!assetId) {
        return { status: 400, body: 'Please provide an assetId' };
    }
    const key = request.params.key;
    if(!key) {
        return { status: 400, body: 'Please provide a key' };
    }
    const user = request.headers.get('x-ms-client-principal-name');
    if(!user) {
        throw new Error('Missing user');
    }

    const tc = TableClient.fromConnectionString(
        'UseDevelopmentStorage=true',
        'RemoteSupportRequests');
    //await tc.createTable()

    const entity =  await tc.getEntity<RemoteSupportRequestEntity>(assetId, key); // throws error when not found
    if(entity.providedAt) {
        return { status: 409, body: 'Support request already claimed' };
    }

    entity.providedBy = user;
    entity.providedAt = new Date();

    await tc.updateEntity(entity, 'Merge', { etag: entity.etag }); // throws if etag has changed

    return { body: `Support request claimed` };
};

app.http('claimSR', {
    methods: ['POST'],
    route: 'claimSR/{assetId}/{key}',
    authLevel: 'anonymous',
    handler: claimSR
});
