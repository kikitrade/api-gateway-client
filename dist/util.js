import { parse } from 'url';
import CryptoJS from 'crypto-js';
import { v4 } from 'uuid';
const Content_Type_Form_Data = 'application/x-www-form-urlencoded; charset=utf-8';
const Content_Type_Json_Data = 'application/octet-stream; charset=utf-8';
const Accept_JSON = 'application/json; charset=utf-8';
let seq = 1;
function seqInc() {
    return seq++;
}
class Util {
    constructor(key, secret, stage) {
        this.appKey = key;
        this.appSecret = Buffer.from(secret, 'utf8');
        this.stage = stage;
    }
    static buildUrl(parsedUrl, data = {}) {
        let toStringify = Object.assign(parsedUrl.query, data);
        let result = parsedUrl.pathname;
        if (Object.keys(toStringify).length) {
            let list = this.buildParameters(toStringify);
            result += '?' + list.join('&');
        }
        return result;
    }
    static buildParameters(toStringify) {
        let keys = Object.keys(toStringify).sort();
        let list = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (toStringify[key] !== undefined && toStringify[key] !== null && ('' + toStringify[key])) {
                list[i] = `${key}=${toStringify[key]}`;
            }
            else {
                list[i] = `${key}`;
            }
        }
        return list;
    }
    buildStringToSign(method, headers, signedHeadersStr, url, data = {}) {
        // accept, contentMD5, contentType,
        const lf = '\n';
        let list = [method, lf];
        const accept = headers['accept'];
        if (accept) {
            list.push(accept);
        }
        list.push(lf);
        const contentMD5 = headers['content-md5'];
        if (contentMD5) {
            list.push(contentMD5);
        }
        list.push(lf);
        const contentType = (headers['content-type'] || '');
        if (contentType) {
            list.push(contentType);
        }
        list.push(lf);
        const date = headers['date'];
        if (date) {
            list.push(date);
        }
        list.push(lf);
        if (signedHeadersStr) {
            list.push(signedHeadersStr);
            list.push(lf);
        }
        if (contentType.startsWith(Content_Type_Form_Data)) {
            list.push(Util.buildUrl(url, data));
        }
        else {
            list.push(Util.buildUrl(url));
        }
        return list.join('');
    }
    sign(stringToSign) {
        return CryptoJS.HmacSHA256(stringToSign, this.appSecret).toString(CryptoJS.enc.Base64);
    }
    static md5(content) {
        return CryptoJS.MD5(content).toString(CryptoJS.enc.Base64);
    }
    getSignHeaderKeys(headers) {
        const keys = Object.keys(headers).sort();
        const signKeys = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // x-ca- 开头的header或者指定的header
            if (key.startsWith('x-ca-')) {
                signKeys.push(key);
            }
        }
        // 按字典序排序
        return signKeys.sort();
    }
    buildHeaders(headers = {}, extra = {}) {
        return Object.assign({
            'ca_version': ['1'],
            'x-ca-timestamp': [Date.now()],
            'x-ca-key': [this.appKey],
            'x-ca-nonce': [v4()],
            'x-ca-seq': [Number(seqInc()).toString()],
            'x-ca-stage': [this.stage],
        }, headers, extra);
    }
    getSignedHeadersString(signHeaders, headers) {
        let list = [];
        for (let i = 0; i < signHeaders.length; i++) {
            let key = signHeaders[i];
            list.push(key + ':' + headers[key]);
        }
        return list.join('\n');
    }
    // normal post or get to ws signed request
    createSignedRequestHeaders(method, url, requestHeaders, contentType, acceptType, webSocketApiType, body, deviceId) {
        // 小写化，合并之后的headers
        let headers = this.buildHeaders(requestHeaders, { 'content-type': [contentType], 'accept': [acceptType] });
        if (webSocketApiType) {
            headers['x-ca-websocket_api_type'] = [webSocketApiType];
        }
        if (deviceId) {
            headers['x-ca-deviceid'] = [deviceId];
        }
        let requestContentType = headers['content-type'] || '';
        //stream form
        if (method === 'POST' && !requestContentType.startsWith(Content_Type_Form_Data) && body) {
            headers['content-md5'] = [Util.md5(body)];
        }
        let signHeaderKeys = this.getSignHeaderKeys(headers);
        headers['x-ca-signature-headers'] = [signHeaderKeys.join(',')];
        let signedHeadersStr = this.getSignedHeadersString(signHeaderKeys, headers);
        let parsedUrl = parse(url, true);
        let stringToSign = this.buildStringToSign(method, headers, signedHeadersStr, parsedUrl, body);
        headers['x-ca-signature'] = [this.sign(stringToSign)];
        return headers;
    }
}
export { Util, seqInc, Content_Type_Form_Data, Content_Type_Json_Data, Accept_JSON };
