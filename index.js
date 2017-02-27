'use strict';

var express = require('express');
var app = express();
	var bodyParser = require('body-parser');
	//var multer = require('multer'); // v1.0.5
	//var upload = multer(); // for parsing multipart/form-data
var port = Number(process.env.PORT || 3000);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
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
