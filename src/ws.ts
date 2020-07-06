import uuid from 'uuid';
import {
    Accept_JSON,
    Content_Type_Form_Data,
    Content_Type_Json_Data,
    FormData,
    seqInc,
    Util,
    WebSocketApiType
} from './util';
import url, {parse} from 'url';
import Timeout = NodeJS.Timeout;

interface EventListener {
    (msg: any): void
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

class WS {
    ws: WebSocket | null;
    registered = false;
    registerResp = false;
    hbStarted = false;
    autoConnect = true;
    timer: Timeout | null;
    registerPath?: string;
    unregisterPath?: string;
    host: string;
    config: Config;

    constructor(config: Config) {
        this.config = config;
        this.timer = null;
        this.host = url.parse(config.url).host as string;
        if (config.registerPath) {
            this.registerPath = config.registerPath;
        }
        if (config.unregisterPath) {
            this.unregisterPath = config.unregisterPath;
        }
        this.ws = null;
    }

    register(update: EventListener, deviceId: string, bodyInJson?: string | FormData) {
        this.ws = new WebSocket(this.config.url);
        let that = this;
        this.ws.onopen = function open() {
            console.log('open:');
            that.ws!.send('RG#' + deviceId);
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
                    that.ws!.send(JSON.stringify(reg));
                }

                that.hbStarted = true;
                that.timer = setInterval(function () {
                    that.ws!.send('H1');
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
                    } catch (e) {
                        //slient
                    }
                }
                that.register(update, deviceId, bodyInJson);
            }
        };
    };

    unregister(body?: string | FormData) {
        let reg = this.unregMsg(this.host, this.unregisterPath, body);
        this.autoConnect = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.registered = false;
        this.registerResp = false;
        this.hbStarted = false;
        this.ws!.send(JSON.stringify(reg));
    }

    send(method: string, path: string, webSocketApiType?: WebSocketApiType, body?: string | FormData): void {
        let data = '';
        let contentType = Content_Type_Json_Data;
        //if form data, else json
        if (body && body instanceof FormData) {
            data = this.formDataString(path, body);
            contentType = Content_Type_Form_Data;
        }
        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg(method, this.host, path, 'COMMON', contentType, Accept_JSON, data);
            this.ws!.send(JSON.stringify(msg));
            return msg;
        }

        // else signature mode
        const util = new Util(this.config.appKey as string, this.config.appSecret as string, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(path, this.config.url).toString(), {},
            contentType, Content_Type_Json_Data, webSocketApiType, body)
        const msg = {
            method: 'POST',
            host: this.host,
            headers: headers,
            path: path,
            isBase64: 0,
            body: data || body || '',
        };
        this.ws!.send(JSON.stringify(msg));
        return;
    }

    private regMsg(host: string, registerPath = '/register', body?: string | FormData) {
        let data = '';
        let contentType = Content_Type_Json_Data;
        //if form data, else json
        if (body && body instanceof FormData) {
            data = this.formDataString(registerPath, body);
            contentType = Content_Type_Form_Data;
        }
        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg('POST', host, registerPath, 'REGISTER', contentType, Accept_JSON, data);
            return msg;
        }

        // else signature mode
        const util = new Util(this.config.appKey as string, this.config.appSecret as string, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(registerPath, this.config.url).toString(), {},
            (body && body instanceof FormData) ? Content_Type_Form_Data : Content_Type_Json_Data, Content_Type_Json_Data, 'REGISTER', body)
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

    private createMsg(method: string, host: string, path: string, api_type = 'COMMON', content_type: string, accept: string, body?: string) {
        const msg: any = {
            method: method,
            host: host,
            headers: {
                'content-type': [content_type],
                'accept': [accept],
                'x-ca-stage': [this.config.stage],
                'x-ca-websocket_api_type': [api_type],
                'x-ca-seq': [new Number(seqInc()).toString()],
                'x-ca-nonce': [uuid.v4().toString()],
                'date': [new Date().toUTCString()],
                'x-ca-timestamp': [new Date().getTime().toString()],
                'ca_version': ['1'],
            },
            path: path,
            'isBase64': 0,

        };

        if (this.config.appCode) {
            msg.headers['Authorization'] = [`APPCODE ${this.config.appCode as string}`];
        }
        if (body) {
            msg.body = body;
            msg.headers['content-md5'] = [Util.md5(body)];
        }
        return msg;
    }

    private unregMsg(host: string, unregisterPath: string = '/unregister', body?: string | FormData) {
        let data = '';
        let contentType = Content_Type_Json_Data
        //处理body， 如果是form data， 则格式化为 a=1&b=2这样的字符串
        //如果本身体是json string， 则需要添加header， 里面有md5
        if (body && body instanceof FormData) {
            data = this.formDataString(unregisterPath, body);
            contentType = Content_Type_Form_Data;
        }

        if (this.config.authType === 'none' || this.config.authType === 'appCode') {
            const msg = this.createMsg('POST', host, unregisterPath, 'UNREGISTER', contentType, Accept_JSON, data);
            return msg;
        }


        // else signature mode
        const util = new Util(this.config.appKey as string, this.config.appSecret as string, this.config.stage);
        const headers = util.createSignedRequestHeaders('POST', new URL(unregisterPath, this.config.url).toString(), {},
            contentType, Content_Type_Json_Data, 'UNREGISTER', body)
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

    private formDataString(unregisterPath: string, body: FormData): string {
        const parsedUrl = parse(new URL(unregisterPath, this.config.url).toString(), true);
        let fullQuery = Object.assign(parsedUrl.query, body);
        const parametersList = Util.buildParameters(fullQuery);
        if (parametersList.length > 0) {
            return parametersList.join('&');
        }
        return '';
    }
}


export {WS, EventListener}
