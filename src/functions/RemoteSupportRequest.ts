export interface RemoteSupportRequest {
    requestedBy: string;
    requestedAt: Date;
    providedBy?: string;
    providedAt?: Date;
    finishedAt?: Date;
}