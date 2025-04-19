export interface RemoteSupportRequest {
  requestedBy: string;
  requestedAt: Date;
  providedBy?: string;
  providedAt?: Date;
  requestorConnectionId?: string;
  requestorConnectedAt?: Date;
  providerConnectionId?: string;
  providerConnectedAt?: Date;
  finishedAt?: Date;
}
