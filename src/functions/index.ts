import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import path = require("path");
import fs = require('fs');

async function index(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {

        const filePath = path.join(__dirname,'./content/index.html');
        const html = await fs.promises.readFile(filePath);

        return {
            body: html,
            headers: {
                'Content-Type': 'text/html'
            }
        };

    } catch (error) {
        context.log(error);
        return {
            status: 500,
            jsonBody: error
        }
    }
};

async function remoteSupport(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {

        const filePath = path.join(__dirname,'./content/remote_support.html');
        const html = await fs.promises.readFile(filePath);

        return {
            body: html,
            headers: {
                'Content-Type': 'text/html'
            }
        };

    } catch (error) {
        context.error(error);
        return {
            status: 500,
            jsonBody: error
        }
    }
};

app.http('index', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: index
});

app.http('remoteSupport', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: remoteSupport
});

