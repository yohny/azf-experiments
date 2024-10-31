import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function getPrincipalInfo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const principal = request.headers.get("x-ms-client-principal");
  const principal_id = request.headers.get("x-ms-client-principal-id");
  const principal_name = request.headers.get("x-ms-client-principal-name");
  const principal_idp = request.headers.get("x-ms-client-principal-idp");

  return {
    jsonBody: { principal, principal_id, principal_name, principal_idp },
  };
}

app.http("principal", {
  methods: ["GET"],
  route: "principal",
  authLevel: "anonymous",
  handler: getPrincipalInfo,
});
