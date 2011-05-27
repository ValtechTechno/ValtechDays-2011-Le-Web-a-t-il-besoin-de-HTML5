var keyLock = false; // keyboard lock flag, for WebGl demo

var sendDataByWebSocket = null; // 'public' method to send data when slide has changed

window.addEventListener('load', function() {
 
	var userAgentIsTheMaster = false;

	var connection = (function() {

		var 	socket = null,
				url = null,
				heartbeat = new Date();

		var init = function() {
			userAgentIsTheMaster = window.navigator.userAgent.indexOf('A_BROWSER_TO_RULE_THEM_ALL') != -1;
			document.getElementById('websocketMasterImage').style['display'] = (userAgentIsTheMaster) ? 'block' : 'none';

			var socketOptions = { 
				'transports': ['websocket'] /*, 'port':1234 */
			};
			if (socket)
				socket.disconnect()

			socket = new io.Socket(window.location.hostname, socketOptions);
			socket.connect();

			socket.on('connect', function() {
				document.getElementById('websocketConnectionImage').style['display'] = 'block';
			});
			socket.on('message', function (data) {
				if (data) {
					heartbeat = new Date();
					if ('pong' == data) {
						// Response to a ping
					} else {
						var obj = JSON.parse(data);
						if (obj) {
							if (obj['slide'] && !userAgentIsTheMaster) {
								var hash = obj['slide'];
								if (hash) {
									var slide = hash.replace('#', '');
									SlideShow.go(slide, false);
								}
							}

							if (obj['quote'] && !isNaN(obj['quote']))
								points.push(parseFloat(obj['quote']));

							if (obj['marketIndex'])
								marketIndex = obj['marketIndex'];

							realQuotes = (obj['realQuotes'] == 'true');
						}
					}
				}
			});
			socket.on('disconnect', function() {
				socket = null;
				document.getElementById('websocketConnectionImage').style['display'] = 'none';
			});
		};

		var reconnectIfNeeded = function() {
			var diff = ((new Date()).getTime() - heartbeat.getTime()) / 1000;
			if (diff > 5)
				send('ping');
			if (!socket || !socket.connected || diff > 10)
				init();
			setTimeout(reconnectIfNeeded, 5000);
		};
		reconnectIfNeeded();

		var connected = function() { 
			return socket && socket.connected;
		};
		var send = function(msg) { 
			if (socket && socket.connected)
				socket.send(msg);
		};

		return {
			"connected": connected,
			"send": send
		}
	})();



	// Fill points when no connection
	var randomPoint = function() {
		if (!connection.connected()) {
			points.push(Math.random()*3 + 5);
			realQuotes = false;
		}
		setTimeout(randomPoint, 1000);
	}
	randomPoint();


	var send = function() {
		if (userAgentIsTheMaster)
			connection.send('{"slide":"' + window.location.hash + '", "I_AM_THE_MASTER":"true"}');
	}
	window.addEventListener( "hashchange", send, false);

	sendDataByWebSocket = send;

}, false);
