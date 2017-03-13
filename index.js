'use strict';

var dotenv = require('dotenv');
dotenv.load();
var colors = require('colors');
var async = require('async');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var Realm = require('realm');
var deepstream = require( 'deepstream.io-client-js' );
var ds = deepstream( process.env.DEEPSTREAM || 'localhost:6020' );
var articleList = ds.record.getList( 'articles' );
var port = Number(process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('json spaces', 2);
app.enable('trust proxy');

/********************************* REALM SETUP ********************************/

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

var SERVER_URL = 'realm://ec2-54-146-162-14.compute-1.amazonaws.com:9080';
var NOTIFIER_PATH = '.*/article';
var admin_user = Realm.Sync.User.adminUser(process.env.REALM_ADMIN_TOKEN);

var change_notification_callback = function(changeEvent) {
	let realm = changeEvent.realm;
	let changes = changeEvent.changes.article; // console.log(changes); // changes array
	var articles = realm.objects("article");
	var oldRealm = changeEvent.oldRealm.objects("article");

	// Deletions: Update in response to deleted objects
	changes.deletions.forEach((index) => {
		let deletedArticle = oldRealm[index];
		dsDelete(deletedArticle);
		console.log('DELETED Article from Realm: '.red + deletedArticle.id); //console.log(deletedArticle);
  });

	// Insertions: Update in response to inserted objects
  changes.insertions.forEach((index) => {
    let insertedArticle = articles[index];
		dsWrite(insertedArticle);
		console.log('INSERT Article from Realm: '.green + insertedArticle.id); //console.log(insertedArticle);
  });

	// Modifications: Update in response to modified objects
	changes.modifications.forEach((index) => {
    let modifiedArticle = articles[index];
		dsWrite(modifiedArticle);
		console.log('MODIFIED Article from Realm: '.blue + modifiedArticle.id); //console.log(modifiedArticle);
  });

};
Realm.Sync.addListener(SERVER_URL, admin_user, NOTIFIER_PATH, 'change', change_notification_callback);


/****************************** DEEPSTREAM SYNC *******************************/

ds.on( 'error', function() {
	console.log( 'error', arguments )
});

function dsLogin(callback) {
	ds.login({ username: 'tenon-lite server' }).on('connectionStateChanged', connectionState => {
		console.log('Deepstream Client: ' + connectionState);
		if (connectionState == 'OPEN') {
			console.log('Deepstream Client: CONNECTION IS NOW OPEN');
			callback(null);
		}
	});
}

function dsSync(callback) {
	articleList.whenReady( ( list ) => {
		realm.objects('article').map(function (article) {
			dsWrite(article); // add current REALM entries to deepstream
		});
		callback(null);
	});
}

function dsWrite(article, callback) {
	const recordName = article.id || 'article/' + ds.getUid();
	ds.record.has(recordName, function (err, has) {
		const articleStatus = ( has ) ? 'UPDATED' : 'ADDED';
		const articleRecord = ds.record.getRecord(recordName);
		articleRecord.set(article);
		if ( articleList.getEntries().indexOf(recordName) == -1 ) {
			articleList.addEntry(recordName) // add entry to list
		}
		return console.log(articleStatus.cyan + ' Article to Deepstream: '.cyan + article.id);
	});
}

function dsDelete(article, callback) {
	const recordName = article.id || 'article/' + ds.getUid();
	ds.record.has(recordName, function (err, has) {
		if ( has ) {
			const articleRecord = ds.record.getRecord(recordName);
			articleRecord.delete();
			if ( articleList.getEntries().indexOf(recordName) > -1 ) {
				articleList.removeEntry(recordName) // remove entry from list
			}
			return console.log('DELETED Article from Deepstream: '.cyan + article.id);
		} else {
			return // article not found
		}
	});
}

/******************************* EXPRESS ROUTES *******************************/

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
		realm.write(() => {
			let newArticle = realm.create('article', article, true);
		});
		//dsWrite(article);
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


/******************************* SERVER LISTEN ********************************/

app.listen(port, function () {
	async.waterfall([
	    dsLogin,
	    dsSync,
	], function (err, result) {
			console.log('App server is running on http://localhost:' + port);
	});
	console.log('App server is running on http://localhost:' + port);
});
