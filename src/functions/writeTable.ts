import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";

const tableOutput = output.table({
  tableName: "Person",
  partitionKey: "Test",
  rowKey: "{key}",
  connection: "AzureWebJobsStorage",
});

export async function writeTable(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const name = request.query.get("name") || "stranger";

  context.extraOutputs.set(tableOutput, { Name: name, Age: 99 });

  return { body: `Hello, ${name}!` };
}

app.http("writeTable", {
  methods: ["GET"],
  route: "write/{key}",
  extraOutputs: [tableOutput],
  authLevel: "anonymous",
  handler: writeTable,
});
