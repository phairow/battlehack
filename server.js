var url = require('url'),
	http = require('http'),
	https = require('https'),
	express = require('express'),
    app = express(),
    twilio = require('twilio'),
    twillioclient = new twilio.RestClient('AC7cebfd9670e2722045546150d437d42c', 'ad5ea2ae24aeaa80ce77fe676c9859f3'),
    paypal_sdk = require('paypal-rest-sdk'),
    userEmail = 'phairow@yahoo.com',
    userName = 'Rai Phairow';


paypal_sdk.configure({
    'host': 'api.sandbox.paypal.com',
    'port': '',
    'client_id': 'Acj30BBhcO30NfQyTtWjhchRPXWAydb1_ECexc7x9AQpwsHmrV51aT8luLcu',
    'client_secret': 'EIHMERB3WkD-RpBHPJFFaJLFlX7dgYPz9-hZDSZ2Xgwi7fV2e8K_OWofJnT4'
});

app.configure(function(){
    app.use(express.bodyParser());
    app.use(app.router);
	app.use(express.logger());
	app.use(express.cookieParser());
	app.use(express.session({ secret: "test" }));
	app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));
	app.use(express.static(__dirname + '/public'));
	app.engine('ejs', require('ejs').renderFile);
	app.set('view engine', 'ejs')
    app.set("view options", { layout: false }) 
	app.set('views', __dirname + '/views');
});

app.get('/', function (req, res) {
	res.render('index', {})
});

app.get('/paymentprocess', function (req, res) {
		var url = require('url'),
			queryvars = parseQueryString(url.parse(req.url).query);
console.log(queryvars)
		if (queryvars.success == 'true') {

			var headers = {
				'Content-Type': 'application/json',
				'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
			};

			var done = true;

			var seed = randomString(2, '1234567890') + randomString(4).toLowerCase();

			var postdata = {
				email: userEmail,
				question: queryvars.q,
				seed: seed,
				created: (new Date()).getTime()
			};

			var callback = function (status) { 

				var callback = function (data) {
		
					for (var i = 0; i < data.result.length; i++ ) {
						done = false;
						twillioclient.sms.messages.create({
							//To: '+13146046275',
							To: '+1' + data.result[i].phone,
							From: '+14253411048',
							Body: seed + ' ' + unescape(queryvars.q)
						}, function (error, message) {
							//console.log('error: ', error);
							//console.log('message: ', message);

							res.render('searchexpert', { seed: seed});
						});
					}

					if (!done) {
						var checkDone = function () {
							twillioclient.sms.messages.list(function(err, data) {
								if (data.sms_messages.length) {
									var found = false;
									data.sms_messages.forEach(function(message) {
										if (message.direction == "inbound" && message.body.indexOf(seed) > -1) {
											found = true;
											console.log(message.body);

											var headers = {
												'Content-Type': 'application/json',
												'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
											};

											var callback = function (status) {
												console.log(status);
											};

											var data = {
												message: message.body.replace(seed + ' ', ''),
												to: message.to,
												from: message.from,
												status: message.status,
												seed: seed
											};

											httpPost('https://cloudsupport.azure-mobile.net/tables/answers', headers, data, callback);
										}
									});

									if (!found) {
										setTimeout(checkDone, 1000);
									}

								} else {
									setTimeout(checkDone, 1000);
								}
							});
						};

						setTimeout(checkDone, 1000);
					}
				}

				var headers = {
					'Content-Type': 'application/json',
					'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
				};

				var url = 'https://cloudsupport.azure-mobile.net/tables/providers?$filter=indexof(categories,\'' + queryvars.category + '\')%20ne%20-1';
				console.log(url)
				httpGet(url, headers, callback);
			};

			httpPost('https://cloudsupport.azure-mobile.net/tables/questions', headers, postdata, callback);
		} else {
			res.render('paymentcancel', {});
		}
});

app.post('/searchresults', function (req, res) {

	if (req.body.expert) {
		var url = req.protocol + "://" + req.get('host') + (req.get('port')?':' + req.get('host'):'') + '/paymentprocess'

		var create_payment_json = {
		    "intent": "sale",
		    "payer": {
		        "payment_method": "paypal"
		    },
		    "redirect_urls": {
		        "return_url": url + '?success=true&q=' + escape(req.body.q) + '&category=' + escape(req.body.category) ,
		        "cancel_url": url + '?success=false&q=' + escape(req.body.q) + '&category=' + escape(req.body.category) 
		    },
		    "transactions": [{
		        "amount": {
		            "currency": "USD",
		            "total": "1.00"
		        },
		        "description": "Expert Advice."
		    }]
		};

		paypal_sdk.payment.create(create_payment_json, function (error, payment) {
		    if (error) {
		        throw error;
		    } else {
		        console.log("Create Payment Response");
		        console.log(payment);

		        if (payment.links && payment.links.length) {
		        	for (var i = 0; i < payment.links.length; i++) {
		        		if (payment.links[i].rel == "approval_url") {
		        			res.redirect(payment.links[i].href);
		        		}
		        	}
		        }
		    }
		});
	} else {

		var url = 'https://hol.inbenta.com/api.php?action=search&project=hol_demo_en&query=' + escape(req.body.q) + '&_=' + (new Date()).getTime();

		var callback = function (data) {
			console.log(data);

			res.render('searchresults', data.result)
		};

		console.log('make request')
		httpGet(url, null, callback);
	}

});

app.get('/login', function (req, res) {
	res.render('login', {})
});

app.get('/register', function (req, res) {
	res.render('register', {})
});

app.post('/registersubmit', function (req, res) {

	console.log(req.body)

	var headers = {
		'Content-Type': 'application/json',
		'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
	};

	var categories = [];
	for (var n in req.body) {
		if (n.indexOf('category_') == 0) {
			categories.push(n.replace('category_', ''));
		}
	}

	var usertype = 'user';

	if (categories.length > 0) {
		usertype = 'expert';
	}

	var data = { usertype: usertype, name: req.body.name, email: req.body.email, phone: req.body.phone, categories: categories.join(',') };

	var callback = function (status, headers) {
		console.log('status: ', status)

		var headers = {
			'Content-Type': 'application/json',
			'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
		};

		var cb2 = function (data) {
			console.log('data:', data)
		};

		httpGet('https://cloudsupport.azure-mobile.net/tables/providers?$filter=(email%20eq%20\'' + req.body.email + '\')', headers, cb2);

	}

	httpPost('https://cloudsupport.azure-mobile.net/tables/providers', headers, data, callback);

		res.render('registersubmit', {postvars: req.body})
	});

	app.get('/paypalauthcomplete', function (req, res) {
		res.render('paypalauthcomplete', {})
	});

	app.get('/privacy', function (req, res) {
		res.render('privacy', {})
	});

	app.get('/useragreement', function (req, res) {
		res.render('useragreement', {})
	});


	/**
	 * http client get request
	 */
	function httpGet(address, headers, callback, errorCallback) {
		var httx = http;

			if (address.indexOf('https://') == 0) {
				httx = https;
			}

			if (address.indexOf('http://') != 0 && address.indexOf('https://') != 0) {
				errorCallback("invalid url");
				return;
			}

			var options = url.parse(address);
			options.headers = headers;

			var req = httx.get(options, function(res) {
				var result = "";

				res.setEncoding('utf-8');

				res.on('data', function (chunk) {
					for (var i=0; i<chunk.length; i++)
						if (chunk[i] === 0xd) chunk[i] = 0xa;

					result += chunk;
				});

				res.on('end', function() {
					var tmpResult = "";
					if (result && result.length > 0) {
						try {
							tmpResult = JSON.parse(result);
						} catch (e) {
							console.log("invalid json in response. returning as string");
						}
						callback({status: res.statusCode, headers: res.headers, result: tmpResult || result});
					} else {
						callback(res.statusCode, res.headers, "");
					}
				});
				res.on('error', function (error) {
					if (errorCallback) {
						errorCallback(null, null, error);
					}
					console.log('error: ');
					console.log(error);
				});
				res.on('timeout', function (error) {
					if (errorCallback) {
						errorCallback(null, null, "timeout");
					}
					console.log('error: ');
					console.log("res timeout");
				});
			});
			req.setTimeout(20000, function (error) {
				req.end();
				if (errorCallback) {
					errorCallback(null, null, "timeout");
				}
				console.log('error: ');
				console.log("req timeout");
			});
	}

	/**
	 * http client post request
	 */
	function httpPost(address, headers, data, callback, errorCallback) {
		var httx = http;

			if (address.indexOf('https://') == 0) {
				httx = https;
			}

			if (address.indexOf('http://') != 0 && address.indexOf('https://') != 0) {
				if (errorCallback) {
					errorCallback(null, null, "invalid url");
				}
				return;
			}
			var options = url.parse(address);
			options.method = 'POST';
			options.headers = headers || {};

			var req = httx.request(options, function(res) {
				res.on("end", function () { callback(res.statusCode, res.headers); });
				res.on('error', function (error) {
					if (errorCallback) {
						errorCallback(null, null, error);
					}
					console.log('error: ');
					console.log(error);
				});
				res.on('timeout', function (error) {
					if (errorCallback) {
						errorCallback(null, null, "timeout");
					}
					console.log('error: ');
					console.log("res timeout");
				});
			});
			req.setTimeout(20000, function (error) {
				req.end();
				if (errorCallback) {
					errorCallback(null, null, "timeout");
				}
				console.log('error: ');
				console.log("req timeout");
			});

			if (typeof data !== "string") {
				data = JSON.stringify(data);
			}
			
			req.write(data);
			req.end();
	}

	function randomString(len, charSet) {
	    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	    var randomString = '';
	    for (var i = 0; i < len; i++) {
	    	var randomPoz = Math.floor(Math.random() * charSet.length);
	    	randomString += charSet.substring(randomPoz,randomPoz+1);
	    }
	    return randomString;
	}
	
	function parseQueryString(text) {
		var result = {}, parts;

		if (text) {
			parts = text.split("&");
			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				var kvp = part.split("=");
				result[kvp[0]] = kvp[1];
			}
		}

		return result;
	}

var server = http.createServer(app).listen(process.env.PORT || 3000);


var io = require('socket.io').listen(server);
io.configure(function () {                //Added
  io.set('transports', ['xhr-polling']);  //Added
}); 

io.sockets.on('connection', function (socket) {

	socket.on('seed', function (seed) {

		var  checkAnswer = function () {

			var headers = {
				'Content-Type': 'application/json',
				'X-ZUMO-APPLICATION': 'kYDznzAyiivpjkHWkcuwCSRxzWYzTJ50'
			};

			var cb = function (data) {
				console.log(data.result)
				if (data.result.length) {
					for(var i = 0; i < data.result.length; i++) {
						socket.emit('answer', { data: data.result[i].message });

						var headers = {

						};

						var callback = function (data) {
							console.log(data)
						};

						httpGet('https://sendgrid.com/api/mail.send.json?api_user=vijaym&api_key=battlehack123&to=' + userEmail + '&toname=' + userName + '&subject=Answer Received&text=' + escape(data.result[i].message) + '&from=info@domain.com', headers, callback);
					}
				} else {
					setTimeout(checkAnswer, 5000);
				}
			};

			httpGet('https://cloudsupport.azure-mobile.net/tables/answers?$filter=(seed%20eq%20\'' + escape(seed) + '\')', headers, cb);
	  	};

	  	setTimeout(checkAnswer, 5000);
	});

});