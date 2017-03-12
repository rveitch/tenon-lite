'use strict';

var dotenv = require('dotenv');
dotenv.load();
var async = require('async');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var Realm = require('realm');
var deepstream = require( 'deepstream.io-client-js' );
var ds = deepstream( process.env.DEEPSTREAM || 'localhost:6020' );
var port = Number(process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('json spaces', 2);
app.enable('trust proxy');

/*** Realm ***/
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
	sync: {
    user: Realm.Sync.User.adminUser(process.env.REALM_ADMIN_TOKEN),
    url: 'realm://ec2-54-146-162-14.compute-1.amazonaws.com:9080/article'
  },
	path: './realm-data/articles.realm'
});

/*** Deepstream ***/
ds.login({ username: 'tenon-lite server' }).on('connectionStateChanged', connectionState => {
	console.log('Deepstream Client: ' + connectionState);
}).on( 'error', function() {
	console.log( 'error', arguments )
});

var articleList = ds.record.getList( 'articles' );
articleList.whenReady( ( list ) => {
	realm.objects('article').map(function (article) {
		dsWrite(article); // add current REALM entries to deepstream
	});
	console.log( list.getEntries() );
});

function dsWrite(article) {
	const recordName = article.id || 'article/' + ds.getUid(); // recordName 'article/iq6auu7d-p9i1vz3q0yi'
	ds.record.has(recordName, function (err, has) {
		if ( has ) { // update
			const articleRecord = ds.record.getRecord(recordName);
			articleRecord.set(article);
			console.log('Article ' + article.id + ' UPDATED to deepstream');
		} else { // create
			const articleRecord = ds.record.getRecord(recordName); // getRecord 'article/iq6auu7d-p9i1vz3q0yi'
			articleRecord.set(article); // set
			articleList.addEntry(recordName) // addEntry (tolist)
			console.log('Article ' + article.id + ' ADDED to deepstream');
		}
	});
}

/* Publish article endpoint */
app.use('/publish', function (req, res) {

	if (req.body.id) {
		var article = {
			id: req.body.id,
			title: req.body.title,
			published: req.body.published,
			created: req.body.created,
			modified: req.body.modified,
			url: req.body.url,
			body: req.body.body,
			description: req.body.description,
		}
		dsWrite(article);
		realm.write(() => {
			let newArticle = realm.create('article', article, true);
		});

	}

	var responseMessage = {
		'headers': req.headers,
		'body': req.body,
	};

	//console.log(responseMessage);
	res.json(responseMessage);
});

/* List Articles in Realm */
app.get('/articles', function (req, res) {
	let articles = realm.objects('article');
	//console.log(articles);
	res.json(articles);
});

/* List Articles in Deepstream */
app.get('/articles/deepstream', function (req, res) {
	var dsArticleList = [];
	articleList.getEntries().map((recordName) => {
		ds.record.getRecord(recordName).whenReady(record => {
			dsArticleList.push(record.get());
		});
	})
	res.json(dsArticleList);
});

/* Default Endpoint */
app.all('/', function (req, res) {
	var baseURL = req.protocol + '://' + req.headers.host;
	var responseMessage = {
		'routes': {
			'/articles': {
				path: baseURL + '/articles',
				method: 'GET',
			},
			'/articles/deepstream': {
				path: baseURL + '/articles/deepstream',
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
