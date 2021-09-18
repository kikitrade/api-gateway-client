import './App.css';
import React from 'react';
import { WS } from '@kikitrade/api-gateway-client';
import env from 'react-dotenv'
let i = 0;
function messageList(d) {
  return <p key={i++}>{JSON.stringify(d)}</p>
}

/**
 * trim the data to 20
 * @param {list} l 
 * @returns 
 */
function trim(l) {
  if (l.length > 5) {
    let excess = l.length - 5;
    for (let i = 0; i < excess; i++) {
      l.shift();
    }
  }
  return l;
}

class App extends React.Component {
  state = {
    messages: []
  }


  componentDidMount() {
    let that = this;
    this.listener = (data) => {
      let d = [];
      d.push(this.state.messages);
      d.push(data);
      d = trim(d);
      that.setState({
        messages: d
      })
    };
    let ws = new WS({
      url: env.url,
      authType: env.authType,
      appCode: env.appCode,
      stage: "TEST",
      registerPath: "/api/register",
      unregisterPath: "/api/unregister",
    });

    ws.register(this.listener, "sdeedd", {
      room: "marketData",
      value: "",
    });

    setTimeout(() => {
      ws.send("POST", "/api/room", "COMMON", { symbol: "BCH_USD", room: "orderbook" });
    }, 5000);
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <p> messages: </p>
          {this.state.messages.map(p => messageList(p))}

        </header>
      </div>
    );
  }

}

export default App;
