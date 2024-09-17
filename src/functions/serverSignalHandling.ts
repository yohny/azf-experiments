import { TableClient, TableEntityResult } from "@azure/data-tables";
import { app, output, trigger } from "@azure/functions";
import { RemoteSupportRequestEntity } from "./RemoteSupportRequest";

const signalR = output.generic({
  type: "signalR",
  name: "signalR",
  hubName: "serverless",
});

const tc = TableClient.fromConnectionString(
  'UseDevelopmentStorage=true',
  'RemoteSupportRequests');

app.generic("connected", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "connected",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "connected",
    category: "connections",
  }),
  extraOutputs: [signalR],
  handler: async (triggerInput, context) => {
    context.log(`Connection ${triggerInput.ConnectionId} (${triggerInput.UserId}) connected.`);
    //let the other side know that someone connected
    // drop connection if there is service request for the user (same rules as in negotiate)?
    const user = triggerInput.UserId;
    const asr = await getActiveServiceRequest(user);
    if(!asr) {
      return;
    }
    const otherSide = user === asr.requestedBy ? asr.providedBy : asr.requestedBy;
    if(!otherSide) { // might be that other side is not know yet (if this the requestor conecting)
      return;
    }
    context.extraOutputs.set(signalR, {
      target: "conectedSR",
      userId: otherSide,
      arguments: [new NewConnection(triggerInput.ConnectionId, triggerInput.UserId, "connected")],
    });
  },
});

app.generic("disconnected", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "disconnected",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "disconnected",
    category: "connections",
  }),
  handler: async (triggerInput, context) => {
    context.log(`Connection ${triggerInput.ConnectionId} (${triggerInput.UserId}) disconnected.`);
    //end active service request and let the other side know that one side disconnected
    // use durable function to end the request only if no connection back within 5 min?
    const user = triggerInput.UserId;
    const asr = await getActiveServiceRequest(user);
    if(!asr) {
      return;
    }
    //end the request
    asr.finishedAt = new Date();
    await tc.updateEntity(asr, 'Merge', { etag: asr.etag });
    context.log(`Service request ${asr.rowKey} ended.`);
    context.extraOutputs.set(signalR, {
      target: "disconnectedSR",
      userId: user === asr.requestedBy ? asr.providedBy : asr.requestedBy,
      arguments: [new NewConnection(triggerInput.ConnectionId, triggerInput.UserId, "disconnected")],
    });
  },
});

class NewConnection {
  constructor(
    public readonly connectionId: string,
    public readonly userId: string,
    public readonly info: string
  ) {}
}

app.generic("remoteSupportMessage", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "remoteSupportMessage",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "remoteSupportMessage",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: async (triggerInput, context) => {
    const sender = triggerInput.UserId;
    const asr = await getActiveServiceRequest(sender);
    context.extraOutputs.set(signalR, {
      target: "remoteSupportMessage",
      userId: sender === asr.requestedBy ? asr.providedBy : asr.requestedBy,
      arguments: [new NewMessage(triggerInput, triggerInput.Arguments[0])],
    });
  },
});

app.generic("broadcast", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "broadcast",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "broadcast",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: "broadcastMsgSR",
      arguments: [new NewMessage(triggerInput, triggerInput.Arguments[0])],
    });
  },
});

app.generic("sendToGroup", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "sendToGroup",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "sendToGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: 'toGroupMsgSR',
      groupName: triggerInput.Arguments[0],
      arguments: [new NewMessage(triggerInput, triggerInput.Arguments[1])],
    });
  },
});

app.generic("sendToUser", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "sendToUser",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "sendToUser",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: 'toUserMsgSR',
      userId: triggerInput.Arguments[0],
      arguments: [new NewMessage(triggerInput, triggerInput.Arguments[1])],
    });
  },
});

app.generic("sendToConnection", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "sendToConnection",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "sendToConnection",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: 'toConnectionMsgSR',
      connectionId: triggerInput.Arguments[0],
      arguments: [new NewMessage(triggerInput, triggerInput.Arguments[1])],
    });
  },
});

app.generic("joinGroup", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "joinGroup",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "joinGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      connectionId: triggerInput.Arguments[0],
      groupName: triggerInput.Arguments[1],
      action: "add",
    });
  },
});

app.generic("leaveGroup", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "leaveGroup",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "leaveGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      connectionId: triggerInput.Arguments[0],
      groupName: triggerInput.Arguments[1],
      action: "remove",
    });
  },
});

app.generic("joinUserToGroup", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "joinUserToGroup",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "joinUserToGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      userId: triggerInput.Arguments[0],
      groupName: triggerInput.Arguments[1],
      action: "add",
    });
  },
});

app.generic("leaveUserFromGroup", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "leaveUserFromGroup",
    direction: "in",
    hubName: "serverless",
    connectionStringSetting: "AzureSignalRConnectionString",
    event: "leaveUserFromGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      userId: triggerInput.Arguments[0],
      groupName: triggerInput.Arguments[1],
      action: "remove",
    });
  },
});

class NewMessage {
  public readonly sender: string;
  public readonly connectionId: string;
  public readonly text: string;
  constructor(triggerInput, message: string) {
    this.sender = triggerInput.UserId ? triggerInput.UserId : "";
    this.connectionId = triggerInput.ConnectionId;
    this.text = message;
  }
}

async function getActiveServiceRequest(user: string): Promise<TableEntityResult<RemoteSupportRequestEntity> | null> {
  const query = tc.listEntities<RemoteSupportRequestEntity>({queryOptions: {filter: `(requestedBy eq '${user}' or providedBy eq '${user}') and providedAt ne null and finishedAt eq null`} });
  let cnt = 0
  let result: TableEntityResult<RemoteSupportRequestEntity> | null = null;
  for await (const entity of query) {
      cnt++;
      if(cnt > 1) {
        throw new Error('Multiple active Support Requests exist for this user');
      }
      result = entity;
  }
  return result;
}
