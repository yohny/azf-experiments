import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { join } from "path";
import { promises } from "fs";

async function index(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const filePath = join(__dirname, "./content/index.html");
    const html = await promises.readFile(filePath);

    return {
      body: html,
      headers: {
        "Content-Type": "text/html",
      },
    };
  } catch (error) {
    context.log(error);
    return {
      status: 500,
      jsonBody: error,
    };
  }
}

async function remoteSupport(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const filePath = join(__dirname, "./content/remote_support.html");
    const html = await promises.readFile(filePath);

    return {
      body: html,
      headers: {
        "Content-Type": "text/html",
      },
    };
  } catch (error) {
    context.error(error);
    return {
      status: 500,
      jsonBody: error,
    };
  }
}

app.http("index", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: index,
});

app.http("remoteSupport", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: remoteSupport,
});
