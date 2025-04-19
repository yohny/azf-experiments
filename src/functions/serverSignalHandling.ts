import { app, output, trigger } from "@azure/functions";
import { TableStorageService } from "./shared/TableStorageService";

const signalR = output.generic({
  type: "signalR",
  name: "signalR",
  hubName: "serverless",
});

app.generic("connected", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "connected",
    direction: "in",
    hubName: "serverless",
    // connectionStringSetting: "AzureSignalRConnectionString", // this is default
    event: "connected",
    category: "connections",
  }),
  extraOutputs: [signalR],
  handler: async (triggerInput, context) => {
    context.log(
      `Connection ${triggerInput.ConnectionId} (${triggerInput.UserId}) connected.`
    );

    const tss = new TableStorageService();
    const sr = await tss.getSupportRequest(
      triggerInput.Claims.assetId,
      triggerInput.Claims.sessionId
    );
    if (!sr) {
      throw new Error("Support request not found.");
    }
    if (sr.finishedAt) {
      // other side already disconnected
      return;
    }
    let otherSide = null;
    if (sr.requestedBy === triggerInput.UserId) {
      tss.updateSupportRequestRequestorConnected(
        sr.partitionKey!,
        sr.rowKey!,
        triggerInput.ConnectionId
      );
      otherSide = sr.providerConnectionId;
    } else if (sr.providedBy === triggerInput.UserId) {
      tss.updateSupportRequestProviderConnected(
        sr.partitionKey!,
        sr.rowKey!,
        triggerInput.ConnectionId
      );
      otherSide = sr.requestorConnectionId;
    } else {
      throw new Error("User is not part of the support request.");
    }

    // let the other side know that we connected
    if (!otherSide) {
      // might be that other side is not known yet (if this is the requestor connecting before claim)
      return;
    }
    context.extraOutputs.set(signalR, {
      target: "conectedSR",
      connectionId: otherSide,
      arguments: [
        new ConnectionEvent(
          triggerInput.ConnectionId,
          triggerInput.UserId,
          "connected"
        ),
      ],
    });
  },
});

app.generic("disconnected", {
  trigger: trigger.generic({
    type: "signalRTrigger",
    name: "disconnected",
    direction: "in",
    hubName: "serverless",
    event: "disconnected",
    category: "connections",
  }),
  extraOutputs: [signalR],
  handler: async (triggerInput, context) => {
    context.log(
      `Connection ${triggerInput.ConnectionId} (${triggerInput.UserId}) disconnected.`
    );
    // use durable function to end the request only if no reconnection back within 5 min?

    const tss = new TableStorageService();
    const sr = await tss.getSupportRequest(
      triggerInput.Claims.assetId,
      triggerInput.Claims.sessionId
    );
    if (!sr) {
      throw new Error("Support request not found.");
    }
    if (sr.finishedAt) {
      // other side already disconnected
      return;
    }
    await tss.finishSupportRequest(sr.partitionKey!, sr.rowKey!);
    context.log(`Service request ${sr.rowKey} finished.`);

    // let the other side know that we disconnected
    const otherSide =
      triggerInput.UserId === sr.requestedBy
        ? sr.providerConnectionId
        : sr.requestorConnectionId;
    if (!otherSide) {
      // might be that other side is not known (if this is the requestor disconnecting before claim)
      return;
    }
    context.extraOutputs.set(signalR, {
      target: "disconnectedSR",
      connectionId: otherSide,
      arguments: [
        new ConnectionEvent(
          triggerInput.ConnectionId,
          triggerInput.UserId,
          "disconnected"
        ),
      ],
    });
  },
});

class ConnectionEvent {
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
    event: "remoteSupportMessage",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: async (triggerInput, context) => {
    context.log(
      `Message from ${triggerInput.ConnectionId} (${triggerInput.UserId})`
    );
    const tss = new TableStorageService();
    const sr = await tss.getSupportRequest(
      triggerInput.Claims.assetId,
      triggerInput.Claims.sessionId
    );
    if (!sr) {
      throw new Error("Support request not found.");
    }
    if (sr.finishedAt) {
      // other side already disconnected
      return;
    }
    context.extraOutputs.set(signalR, {
      target: "remoteSupportMessageSR",
      connectionId:
        triggerInput.UserId === sr.requestedBy
          ? sr.providerConnectionId
          : sr.requestorConnectionId,
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
    event: "sendToGroup",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: "toGroupMsgSR",
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
    event: "sendToUser",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: "toUserMsgSR",
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
    event: "sendToConnection",
    category: "messages",
  }),
  extraOutputs: [signalR],
  handler: (triggerInput, context) => {
    context.extraOutputs.set(signalR, {
      target: "toConnectionMsgSR",
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
  constructor(triggerInput: any, message: string) {
    this.sender = triggerInput.UserId ? triggerInput.UserId : "";
    this.connectionId = triggerInput.ConnectionId;
    this.text = message;
  }
}
