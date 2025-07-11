declare module 'phoenix' {
  export interface SocketConnectOption {
    params?: any;
    timeout?: number;
    heartbeatIntervalMs?: number;
    reconnectAfterMs?: number;
  }

  export class Socket {
    constructor(endPoint: string, opts?: SocketConnectOption);
    connect(): void;
    disconnect(): void;
    channel(topic: string, params?: any): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: any) => void): void;
  }

  export class Channel {
    join(): Push;
    leave(): Push;
    on(event: string, callback: (payload: any) => void): void;
    push(event: string, payload: any): Push;
  }

  export class Push {
    receive(status: string, callback: (response?: any) => void): Push;
  }
}