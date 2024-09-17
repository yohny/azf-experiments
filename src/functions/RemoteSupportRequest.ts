import { TableEntity } from "@azure/data-tables"

export interface RemoteSupportRequest {
    requestedBy: string;
    requestedAt: Date;
    providedBy?: string;
    providedAt?: Date;
    finishedAt?: Date;
}

export type RemoteSupportRequestEntity = TableEntity<RemoteSupportRequest>