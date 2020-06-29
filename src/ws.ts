import uuid from 'uuid';

interface EventListener {
    (msg: any): void
}

class WS {
    ws: WebSocket;
    registered = false;
    registerResp = false;
    hbStarted = false;
    autoConnect = true;
    timer: number | null;
    registerPath?: string;
    unregisterPath?: string;
    url: string;
    host: string;

    constructor(host: string, url: string, registerPath?: string, unregisterPath?: string) {
        this.timer = null;
        this.url = url;
        this.host = host;
        if (registerPath) {
            this.registerPath = registerPath;
        }
        if (unregisterPath) {
            this.unregisterPath = unregisterPath;
        }
        this.ws = new WebSocket(this.url);
    }

    register(update: EventListener, deviceId: string, bodyInJson?: string) {
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
                    let reg = regMsg(that.host, that.registerPath, bodyInJson);
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
                    } catch (e) {
                        //slient
                    }
                }
                that.register(update, deviceId, bodyInJson);
            }
        };
    };

    unregister() {
        let reg = unregMsg(this.host, this.unregisterPath);
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
}


function regMsg(host: string, registerPath = '/register', body = '') {
    const reg = {
        method: 'POST',
        host: host,
        headers: {
            'x-ca-websocket_api_type': ['REGISTER'],
            'x-ca-seq': ['0'],
            'x-ca-nonce': [uuid.v4().toString()],
            'date': [new Date().toUTCString()],
            'x-ca-timestamp': [new Date().getTime().toString()],
            'CA_VERSION': ['1'],
        },
        path: registerPath,
        body: body,
    };
    return reg;
}

function unregMsg(host: string, unregisterPath: string = '/unregister') {
    const reg = {
        method: 'POST',
        host: host,
        headers: {
            'x-ca-websocket_api_type': ['UNREGISTER'],
            'x-ca-seq': ['0'],
            'x-ca-nonce': [uuid.v4().toString()],
            'date': [new Date().toUTCString()],
            'x-ca-timestamp': [new Date().getTime().toString()],
            'CA_VERSION': ['1'],
        },
        path: unregisterPath,
        body: '',
    };
    return reg;
}

export {WS, EventListener}
