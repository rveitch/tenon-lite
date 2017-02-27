'use strict';

var express = require('express');
var app = express();
var port = Number(process.env.PORT || 3000);

app.set('json spaces', 2);
app.enable('trust proxy');

/* Default Endpoint */
app.use('*', function (req, res) { //app.get
	var responseMessage = {
		'headers': req.headers,
		'body': req.body,
	};
	console.log(responseMessage);
	res.json(responseMessage);
});

app.listen(port, function () {
	console.log('App server is running on http://localhost:' + port);
});
