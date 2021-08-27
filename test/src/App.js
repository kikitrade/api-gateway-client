import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from 'react';
import { WS } from '@kikitrade/api-gateway-client';

function App() {
  const [messages, setMessages] = useState([]);
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
  let listener = (data) => {
    let d = [];
    d.push(messages);
    d.push(data);
    d = trim(d);
    setMessages(d)
  };

  useEffect(() => {
    let ws = new WS({
      url: "ws://wstest.kikitrade.com:8080",
      authType: "appCode",
      appCode: "c022929d0e1f4b0d8eace9cb9934bf0d",
      stage: "TEST",
      registerPath: "/api/register",
      unregisterPath: "/api/unregister",
    });

    ws.register(listener, "test111111", {
      room: "marketData",
      value: "",
    });

    setTimeout(() => {
      ws.send("POST", "/api/room", "COMMON", { symbol: "BTC-USDT", room: "orderbook" });
    }, 5000);
  });

  function messageList(d) {
    return <p>{JSON.stringify(d)}</p>
  }
  return (
    <div className="App">
      <header className="App-header">
        <p> messages: </p>
        {messages.map(p => messageList(p))}

      </header>
    </div>
  );
}

export default App;
