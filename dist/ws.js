import { v4 } from 'uuid';
import { Accept_JSON, Content_Type_Form_Data, Content_Type_Json_Data, seqInc, Util } from './util';
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
                try {
                    let msg = JSON.parse(event.data.substr(3));
                    if (msg) {
                        console.log('receiving ' + msg);
                        update(msg);
                    }
                }
                catch (e) {
                    //ignore error from update callback
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
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.status > 400) {
                        that.ws.close();
                        that.reconnect(update, deviceId, bodyInJson);
                    }
                }
                catch (e) {
                    //ignore
                }
                that.registerResp = true;
                //ignore register resp
                return;
            }
        };
        this.ws.onclose = function (event) {
            console.log('ws closed:', event);
            that.reconnect(update, deviceId, bodyInJson);
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
    send(method, path, webSocketApiType = 'COMMON', body) {
        if (this.ws && this.ws.readyState != 1) {
            return;
        }
        let data = '';
        let contentType = Content_Type_Json_Data;
        //if form data, else json
        if (body && typeof (body) == 'object') {
            data = this.formDataString(path, body);
            contentType = Content_Type_Form_Data;
        }
        else {
            data = body;
        }
        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg(method, this.host, path, 'COMMON', contentType, Accept_JSON, data);
            this.ws.send(JSON.stringify(msg));
            return msg;
        }
        // else signature mode
        const util = new Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(path, this.config.url).toString(), {}, contentType, Content_Type_Json_Data, webSocketApiType, body);
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
    reconnect(update, deviceId, bodyInJson) {
        if (this.autoConnect) {
            if (this.ws) {
                //force close
                try {
                    this.ws.close();
                    if (this.timer) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                    this.registered = false;
                    this.registerResp = false;
                    this.hbStarted = false;
                }
                catch (e) {
                    //slient
                }
            }
            this.register(update, deviceId, bodyInJson);
        }
    }
    regMsg(host, registerPath = '/register', body) {
        let data = '';
        let contentType = Content_Type_Json_Data;
        //if form data, else json
        if (body && typeof (body) == 'object') {
            data = this.formDataString(registerPath, body);
            contentType = Content_Type_Form_Data;
        }
        else {
            data = body;
        }
        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg('POST', host, registerPath, 'REGISTER', contentType, Accept_JSON, data);
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
    createMsg(method, host, path, api_type = 'COMMON', content_type, accept, body) {
        const msg = {
            method: method,
            host: host,
            headers: {
                'content-type': [content_type],
                'accept': [accept],
                'x-ca-stage': [this.config.stage],
                'x-ca-websocket_api_type': [api_type],
                'x-ca-seq': [new Number(seqInc()).toString()],
                'x-ca-nonce': [v4().toString()],
                'date': [new Date().toUTCString()],
                'x-ca-timestamp': [new Date().getTime().toString()],
                'ca_version': ['1'],
            },
            path: path,
            'isBase64': 0,
        };
        if (this.config.appCode) {
            msg.headers['Authorization'] = [`APPCODE ${this.config.appCode}`];
        }
        if (body) {
            msg.body = body;
            msg.headers['content-md5'] = [Util.md5(body)];
        }
        return msg;
    }
    unregMsg(host, unregisterPath = '/unregister', body) {
        let data = '';
        let contentType = Content_Type_Json_Data;
        //处理body， 如果是form data， 则格式化为 a=1&b=2这样的字符串
        //如果本身体是json string， 则需要添加header， 里面有md5
        if (body && typeof (body) == 'object') {
            data = this.formDataString(unregisterPath, body);
            contentType = Content_Type_Form_Data;
        }
        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg('POST', host, unregisterPath, 'UNREGISTER', contentType, Accept_JSON, data);
            return msg;
        }
        // else signature mode
        const util = new Util(this.config.appKey, this.config.appSecret, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(unregisterPath, this.config.url).toString(), {}, contentType, Content_Type_Json_Data, 'UNREGISTER', body);
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
        const parsedUrl = parse(new URL(unregisterPath).toString(), true);
        let fullQuery = Object.assign(parsedUrl.query, body);
        const parametersList = Util.buildParameters(fullQuery);
        if (parametersList.length > 0) {
            return parametersList.join('&');
        }
        return '';
    }
}
export { WS };
