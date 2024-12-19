let ws = null;
const markets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];

function connect() {
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    
    ws.onopen = () => {
        console.log('Worker: WebSocket connected');
        subscribeToMarkets();
    };
    
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.tick) {
            postMessage({
                type: 'TICK_UPDATE',
                tick: data.tick
            });
        }
    };
    
    ws.onclose = () => {
        console.log('Worker: WebSocket closed, reconnecting...');
        setTimeout(connect, 5000);
    };
}

function subscribeToMarkets() {
    markets.forEach(market => {
        ws.send(JSON.stringify({
            ticks: market,
            subscribe: 1
        }));
    });
}

connect(); 