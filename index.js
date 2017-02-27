'use strict';

var express = require('express');
var app = express();
	var bodyParser = require('body-parser');
var Realm = require('realm');
var port = Number(process.env.PORT || 3000);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.set('json spaces', 2);
app.enable('trust proxy');

var ArticleSchema = {
  name: 'article',
	primaryKey: 'id',
  properties: {
		id: {type: 'string'},
    title: {type: 'string', optional: true},
		published: {type: 'string', optional: true},
		created: {type: 'string', optional: true},
		modified: {type: 'string', optional: true},
		url: {type: 'string', optional: true},
		body: {type: 'string', optional: true},
		description: {type: 'string', optional: true},
  }
};

let realm = new Realm({
	schema: [ArticleSchema],
	path: './realm-data/articles.realm'
});

/* Publish article endpoint */
app.use('/publish', function (req, res) {

	if (req.body.id) {
		realm.write(() => {
			let newArticle = realm.create('article', {
				id: req.body.id,
				title: req.body.title,
				published: req.body.published,
				created: req.body.created,
				modified: req.body.modified,
				url: req.body.url,
				body: req.body.body,
				description: req.body.description,
			}, true);
		});
	}

	var responseMessage = {
		'headers': req.headers,
		'body': req.body,
	};

	console.log(responseMessage);
	res.json(responseMessage);
});

/* List Articles in Realm */
app.get('/articles', function (req, res) {
	let articles = realm.objects('article');
	console.log(articles);
	res.json(articles);
});

/* Default Endpoint */
app.use('/', function (req, res) {
	var baseURL = req.protocol + '://' + req.headers.host;
	var responseMessage = {
		'routes': {
			'/articles': {
				path: baseURL + '/articles',
				method: 'GET',
			},
			'/publish': {
				path: baseURL + '/publish',
				method: 'PUT',
			}
		},
		schema: {
			article: ArticleSchema
		}
	};
	res.json(responseMessage);
});

app.listen(port, function () {
	console.log('App server is running on http://localhost:' + port);
});
