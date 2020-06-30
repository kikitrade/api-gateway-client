"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = __importDefault(require("uuid"));
const util_1 = require("./util");
const url_1 = __importStar(require("url"));
class WS {
    constructor(config) {
        this.registered = false;
        this.registerResp = false;
        this.hbStarted = false;
        this.autoConnect = true;
        this.config = config;
        this.timer = null;
        this.host = url_1.default.parse(config.url).host;
        if (config.registerPath) {
            this.registerPath = config.registerPath;
        }
        if (config.unregisterPath) {
            this.unregisterPath = config.unregisterPath;
        }
        this.ws = new WebSocket(this.config.url);
    }
    register(update, deviceId, bodyInJson) {
        if (this.registered) {
            throw new Error('unregister the previous subscription to call register');
        }
        let that = this;
        this.ws.onopen = function open() {
            console.log('open:');
            that.ws.send('RG#' + deviceId);
        };
        this.ws.onmessage = function incoming(event) {
            console.log('data:', event.data);
            if (event.data.startsWith('NF#')) {
                let msg = JSON.parse(event.data.substr(3));
                if (msg) {
                    console.log('receiving ' + msg);
                    update(JSON.parse(msg));
                }
                return;
            }
            if (!that.hbStarted && event.data.startsWith('RO#')) {
                console.log('login successfully');
                if (!that.registered) {
                    that.registered = true;
                    let reg = that.regMsg(that.host, that.registerPath, bodyInJson);
                    that.ws.send(JSON.stringify(reg));
                }
                that.hbStarted = true;
                that.timer = setInterval(function () {
                    that.ws.send('H1');
                }, 15 * 1000);
                return;
            }
            if (!that.registerResp) {
                that.registerResp = true;
                //ignore register resp
                return;
            }
        };
        this.ws.onclose = function (event) {
            console.log('ws closed:', event);
            if (that.timer) {
                clearInterval(that.timer);
                that.timer = null;
            }
            that.registered = false;
            that.registerResp = false;
            that.hbStarted = false;
            //reconnect
            if (that.autoConnect) {
                if (that.ws) {
                    //force close
                    try {
                        that.ws.close();
                        that.ws = new WebSocket(this.url);
                    }
                    catch (e) {
                        //slient
                    }
                }
                that.register(update, deviceId, bodyInJson);
            }
        };
    }
    ;
    unregister(body) {
        let reg = this.unregMsg(this.host, this.unregisterPath, body);
        this.autoConnect = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.registered = false;
        this.registerResp = false;
        this.hbStarted = false;
        this.ws.send(JSON.stringify(reg));
    }
    send(method, path, webSocketApiType, body) {
        let data = '';
        //if form data, else json
        if (body && body instanceof FormData) {
            data = this.formDataString(path, body);
        }
        if (this.config.authType === 'none') {
            const msg = {
                method: method,
                host: this.host,
                headers: Object.assign({
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'isBase64': 0,
                    'ca_version': '1',
                }, webSocketApiType ? { 'x-ca-websocket_api_type': webSocketApiType } : {}),
                path: path,
                body: data || body || '',
            };
            this.ws.send(JSON.stringify(msg));
            return;
        }
        if (this.config.authType === 'appCode') {
            const msg = {
                method: method,
                host: this.host,
                headers: Object.assign({
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'Authorization': `APPCODE ${this.config.appCode}`,
                    'isBase64': 0,
                    'ca_version': '1',
                }, webSocketApiType ? { 'x-ca-websocket_api_type': webSocketApiType } : {}),
                path: path,
                body: data || body || '',
            };
            this.ws.send(JSON.stringify(msg));
            return;
        }
        // else signature mode
        const util = new util_1.Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(path, this.config.url).toString(), {}, (body && body instanceof FormData) ? util_1.Content_Type_Form_Data : util_1.Content_Type_Json_Data, util_1.Content_Type_Json_Data, webSocketApiType, body);
        const msg = {
            method: 'POST',
            host: this.host,
            headers: headers,
            path: path,
            isBase64: 0,
            body: data || body || '',
        };
        this.ws.send(JSON.stringify(msg));
        return;
    }
    regMsg(host, registerPath = '/register', body) {
        let data = '';
        //if form data, else json
        if (body && body instanceof FormData) {
            data = this.formDataString(registerPath, body);
        }
        if (this.config.authType === 'none') {
            const msg = {
                method: 'POST',
                host: host,
                headers: {
                    'x-ca-websocket_api_type': 'REGISTER',
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'isBase64': 0,
                    'ca_version': '1',
                },
                path: registerPath,
                body: data || body || '',
            };
            return msg;
        }
        if (this.config.authType === 'appCode') {
            const msg = {
                method: 'POST',
                host: host,
                headers: {
                    'x-ca-websocket_api_type': 'REGISTER',
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'Authorization': `APPCODE ${this.config.appCode}`,
                    'isBase64': 0,
                    'ca_version': '1',
                },
                path: registerPath,
                body: data || body || '',
            };
            return msg;
        }
        // else signature mode
        const util = new util_1.Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(registerPath, this.config.url).toString(), {}, (body && body instanceof FormData) ? util_1.Content_Type_Form_Data : util_1.Content_Type_Json_Data, util_1.Content_Type_Json_Data, 'REGISTER', body);
        const msg = {
            method: 'POST',
            host: host,
            headers: headers,
            path: registerPath,
            isBase64: 0,
            body: data || body || '',
        };
        return msg;
    }
    unregMsg(host, unregisterPath = '/unregister', body) {
        let data = '';
        //if form data, else json
        if (body && body instanceof FormData) {
            data = this.formDataString(unregisterPath, body);
        }
        if (this.config.authType === 'none') {
            const msg = {
                method: 'POST',
                host: host,
                headers: {
                    'x-ca-websocket_api_type': 'UNREGISTER',
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'isBase64': 0,
                    'ca_version': '1',
                },
                path: unregisterPath,
                body: data || body || '',
            };
            return msg;
        }
        if (this.config.authType === 'appCode') {
            const msg = {
                method: 'POST',
                host: host,
                headers: {
                    'x-ca-websocket_api_type': 'UNREGISTER',
                    'x-ca-seq': new Number(util_1.seqInc()).toString(),
                    'x-ca-nonce': uuid_1.default.v4().toString(),
                    'date': new Date().toUTCString(),
                    'x-ca-timestamp': new Date().getTime().toString(),
                    'ca_version': '1',
                    'isBase64': 0,
                    'Authorization': `APPCODE ${this.config.appCode}`
                },
                path: unregisterPath,
                body: data || body || '',
            };
            return msg;
        }
        // else signature mode
        const util = new util_1.Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(unregisterPath, this.config.url).toString(), {}, (body && body instanceof FormData) ? util_1.Content_Type_Form_Data : util_1.Content_Type_Json_Data, util_1.Content_Type_Json_Data, 'UNREGISTER', body);
        const msg = {
            method: 'POST',
            host: host,
            headers: headers,
            path: unregisterPath,
            isBase64: 0,
            body: data || body || '',
        };
        return msg;
    }
    formDataString(unregisterPath, body) {
        const parsedUrl = url_1.parse(new URL(unregisterPath, this.config.url).toString(), true);
        let fullQuery = Object.assign(parsedUrl.query, body);
        const parametersList = util_1.Util.buildParameters(fullQuery);
        if (parametersList.length > 0) {
            return parametersList.join('&');
        }
        return '';
    }
}
exports.WS = WS;
