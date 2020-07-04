import uuid from 'uuid';
import { Content_Type_Form_Data, Content_Type_Json_Data, seqInc, Util } from './util';
import url, { parse } from 'url';
class WS {
    constructor(config) {
        this.registered = false;
        this.registerResp = false;
        this.hbStarted = false;
        this.autoConnect = true;
        this.config = config;
        this.timer = null;
        this.host = url.parse(config.url).host;
        if (config.registerPath) {
            this.registerPath = config.registerPath;
        }
        if (config.unregisterPath) {
            this.unregisterPath = config.unregisterPath;
        }
        this.ws = null;
    }
    register(update, deviceId, bodyInJson) {
        this.ws = new WebSocket(this.config.url);
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
        const util = new Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(path, this.config.url).toString(), {}, (body && body instanceof FormData) ? Content_Type_Form_Data : Content_Type_Json_Data, Content_Type_Json_Data, webSocketApiType, body);
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
        const util = new Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(registerPath, this.config.url).toString(), {}, (body && body instanceof FormData) ? Content_Type_Form_Data : Content_Type_Json_Data, Content_Type_Json_Data, 'REGISTER', body);
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
                    'x-ca-seq': new Number(seqInc()).toString(),
                    'x-ca-nonce': uuid.v4().toString(),
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
        const util = new Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(unregisterPath, this.config.url).toString(), {}, (body && body instanceof FormData) ? Content_Type_Form_Data : Content_Type_Json_Data, Content_Type_Json_Data, 'UNREGISTER', body);
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
        const parsedUrl = parse(new URL(unregisterPath, this.config.url).toString(), true);
        let fullQuery = Object.assign(parsedUrl.query, body);
        const parametersList = Util.buildParameters(fullQuery);
        if (parametersList.length > 0) {
            return parametersList.join('&');
        }
        return '';
    }
}
export { WS };
