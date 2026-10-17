const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9226',
  '--user-data-dir=d:\\project\\pembukuan\\scratch\\test_inspect_profile',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9226/json/list');
    const [tab] = await res.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 0, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 0, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'http://localhost:5173' } }));
      setTimeout(() => {
        // Submit PIN 1234
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              const inp = document.querySelector('#user-pin');
              if (inp) {
                inp.value = '1234';
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                const btn = document.querySelector('button[type="submit"]');
                if (btn) btn.click();
                return 'SUBMITTED';
              }
              return 'NO_PIN_INPUT';
            })()`,
            returnByValue: true
          }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const buttons = Array.from(document.querySelectorAll('button, a')).map(b => b.innerText.trim());
                return {
                  buttons,
                  bodyText: document.body.innerText.slice(0, 500)
                };
              })()`,
              returnByValue: true
            }
          }));
        }, 2000);
      }, 2000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.log('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
      } else if (msg.id === 10) {
        console.log('[LOGIN STEP RESULT]:', msg.result?.result?.value);
      } else if (msg.id === 2) {
        console.log('[AFTER LOGIN DOM STATE]:\n', JSON.stringify(msg.result?.result?.value, null, 2));
        chrome.kill();
        process.exit(0);
      }
    };
  } catch (err) {
    console.error(err);
    chrome.kill();
    process.exit(1);
  }
}, 1200);
