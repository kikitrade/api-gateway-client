import { UrlWithParsedQuery } from 'url';
import { ParsedUrlQuery } from "querystring";
declare const Content_Type_Form_Data = "application/x-www-form-urlencoded";
declare const Content_Type_Json_Data = "application/json";
declare function seqInc(): number;
declare type Stage = 'STAGE' | 'RELEASE';
declare type WebSocketApiType = 'NOTIFY' | 'REGISTER' | 'UNREGISTER';
interface Header {
    [key: string]: any | any[];
}
interface FormData {
    [key: string]: any;
}
declare class Util {
    appKey: string;
    appSecret: Buffer;
    stage: Stage;
    constructor(key: string, secret: string, stage: Stage);
    buildStringToSign(method: string, headers: Header, signedHeadersStr: string, url: UrlWithParsedQuery, data?: FormData): string;
    sign(stringToSign: string): string;
    md5(content: string): string;
    getSignHeaderKeys(headers: {}): string[];
    static buildUrl(parsedUrl: UrlWithParsedQuery, data?: {}): string;
    static buildParameters(toStringify: ParsedUrlQuery): any[];
    buildHeaders(headers?: {}, extra?: {}): Header;
    getSignedHeadersString(signHeaders: Header, headers: Header): string;
    createSignedRequestHeaders(method: string, url: string, requestHeaders: Header, contentType: string, acceptType: string, webSocketApiType?: WebSocketApiType, body?: string | FormData, deviceId?: string): Header;
}
export { Util, Stage, seqInc, WebSocketApiType, Content_Type_Form_Data, Content_Type_Json_Data };
//# sourceMappingURL=util.d.ts.map