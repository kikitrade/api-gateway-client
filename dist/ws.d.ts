import { FormData, WebSocketApiType } from './util';
import Timeout = NodeJS.Timeout;
interface EventListener {
    (msg: any): void;
}
interface Config {
    url: string;
    registerPath?: string;
    unregisterPath?: string;
    authType: 'appCode' | 'accessKey' | 'none';
    stage: 'TEST' | 'RELEASE';
    appCode?: string;
    appKey?: string;
    appSecret?: string;
}
declare class WS {
    ws: WebSocket | null;
    registered: boolean;
    registerResp: boolean;
    hbStarted: boolean;
    autoConnect: boolean;
    timer: Timeout | null;
    registerPath?: string;
    unregisterPath?: string;
    host: string;
    config: Config;
    constructor(config: Config);
    register(update: EventListener, deviceId: string, bodyInJson?: string | FormData): void;
    unregister(body?: string | FormData): void;
    send(method: string, path: string, webSocketApiType?: WebSocketApiType, body?: string | FormData): void;
    private reconnect;
    private regMsg;
    private createMsg;
    private unregMsg;
    private formDataString;
}
export { WS, EventListener };
//# sourceMappingURL=ws.d.ts.map