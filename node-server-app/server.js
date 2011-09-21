/*
 * HTML5 demo server code published under Apache 2 license
 * Copyright 2011 Valtech SA
 *
 * Options passed on command line are :
 *  - --offline (optional) : do request quotes wich avoid exception if no connection are available
 *  - --port=X  (optional) : set port number to X instead of 8080 by default
 *  - --websocketport=Y (optional) : use the port Y for web socket
 *
 * The following code is intended to run on nodejs (>=0.2.6).
 */
var sys = require("sys"),
	 http = require("http"),
    express = require('express'),
    io = require('socket.io');

var realQuotes = true;
var webServerPort = 8080;
var webSocketPort = null;
var pathToStaticFiles = __dirname + '/../slides';
sys.log('Static content is served from: ' + pathToStaticFiles);

process.argv.forEach(function (val, index, array) {
	var idx;
	if (val == '--offline') {
		realQuotes = false;
	} else if ((idx = val.indexOf('--port=')) != -1) {
		var port = val.substr(idx + '--port='.length);
		if (port && !isNaN(port))
			webServerPort = port;
	} else if ((idx = val.indexOf('--websocketport=')) != -1) {
		var port = val.substr(idx + '--websocketport='.length);
		if (port && !isNaN(port))
			webSocketPort = port;
	}
});


/*
 * Express part to host static files
 */
var app = express.createServer();
app.configure(function() {
	app.use(app.router);
	app.use(express.static(pathToStaticFiles));
});
app.configure('production', function() {
	app.use(express.cache(1000 * 60 * 60));
});
app.listen(webServerPort);
sys.log('Express server listening on ' + webServerPort);


/*
 * WebSocket part
 */
var appToListen = app;
if (webSocketPort != null) { // Launching a server if we are listening on another port.
	appToListen = http.createServer();
	appToListen.listen(webSocketPort);
	sys.log("Socket.IO listening on port " + webSocketPort);
} else {
	sys.log("Socket.IO listening on port " + webServerPort);
}

var socket = io.listen(appToListen, {'transports': ['websocket'] }); 
socket.on('connection', function(client) { 
	//	for(var i in client)	sys.log(i);
	pool.add(client);
	sys.log('total users:' + pool.size());

	client.on('message', function(data) {
		sys.log('data [' + data + '] received from ' + client.sessionId);
		if (data.indexOf('I_AM_THE_MASTER') != -1) {
			sys.log('Master is sending an action');
			pool.send(data);
		} else if (data.indexOf('ping') != -1) {
			client.send('pong');
		}
	});
	client.on('disconnect', function() {  
		pool.remove(client);
		sys.log('total users:' + pool.size());
	});
}); 


/*
 * Sending quote by websocket part
 */
var getQuotes = function() {
	const host = 'finance.google.com';
	const path = '/finance/info?q=INDEXEURO%3APX1'
	const marketIndex = 'Cours du CAC40';
	if (pool && pool.size() > 0) {
		var httpClient = http.createClient(80, host)
		var request = httpClient.request('GET', path, {'host': host, 'User-Agent': 'NodeJS HTTP Client'});
		request.addListener('response', function (response) {
			var json = "";
			response.addListener('data', function(chunk) {
				json += chunk;
			}).addListener('end', function() {
				if (json) {
					try {
						var obj = JSON.parse(json.replace('//', ''));
						var quote = obj[0]['l'].replace(',', '');
						if (quote) {
							pool.send('{"quote": "'+ quote +'", "marketIndex":"'+ marketIndex +'", "realQuotes":"true"}');
						}
					} catch(e) {
						sys.debug('Eception:' + e);
					}
				}
			});
		});
		request.end();
	}
	setTimeout(getQuotes, 1000);
}

if (realQuotes) {
	sys.log('Launching quotes request each seconds...');
	getQuotes()
} else {
	sys.log('NOT launching quotes request each seconds. Simulating...');
	var simulateQuotes = function() { pool.send('{"quote": "'+ (Math.random() * 10 + 10) +'", "marketIndex":"CAC40", "realQuotes":"false"}'); setTimeout(simulateQuotes, 1000); };
	setTimeout(simulateQuotes, 1000);
}

/*
 * WebSocket connection pool
 */
var pool = (function() {
	var clients = [];
	var size = 0;

	return {
		'add': function(websocket) {
			var inserted = false;
			for (var i in clients) {
				if (clients[i] == null) { // Reusing an existing slot
					clients[i] = websocket;
					inserted = true;
					break;
				}
			}
			if (!inserted) // New slot
				clients.push(websocket);
			size++;
		},
		'remove': function(websocket) {
			clients[websocket] = null;
			size--;
		},
		'send': function(data) {
			for (var i in clients) {
				if (clients[i]) {
					//sys.debug('Writing [' + data + '] to ' + clients[i]);
					clients[i].send(data);
				}
			}
		},
		'size': function() {
			return size;
		}
	};
})();
