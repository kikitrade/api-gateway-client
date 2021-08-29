import './App.css';
import { useEffect, useState } from 'react';
import { WS } from '@kikitrade/api-gateway-client';
import env from 'react-dotenv'

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
    console.log(env.url)
    let ws = new WS({
      url: env.url,
      authType: env.authType,
      appCode: env.appCode,
      stage: "TEST",
      registerPath: "/api/register",
      unregisterPath: "/api/unregister",
    });

    ws.register(listener, "test111111222", {
      room: "marketData",
      value: "",
    });

    setTimeout(() => {
      ws.send("POST", "/api/room", "COMMON", { symbol: "BTC_USDT", room: "orderbook" });
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
