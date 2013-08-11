var url = require('url'),
	http = require('http'),
	https = require('https'),
	express = require('express'),
	azure = require('azure'),
    app = express();

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

app.post('/searchresults', function (req, res) {
	res.render('searchresults', {})
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



app.listen(process.env.PORT || 3000);


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