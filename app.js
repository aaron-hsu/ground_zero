const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

const path = require('path');

process.env.NODE_ENV = "default";
const config = require('config');


const Promise = require("bluebird");

const mongo = require('mongodb-bluebird');

const moment = require('moment');
require('log-timestamp')(function() { return '[' + moment().format('YYYY-MM-DD HH:mm:ss') + ']' });


const wechatAPI = require('wechat-api');
const fs = require("fs");
var wechat_api;

var server = require('http').Server(app);


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// mongo
////////////////////////////////////////////////////////////////////////////////////////////////////////////

var user_db;

var user_db_promise= mongo.connect(config.get('user_mongo.db'))
  .then(function(db) {
    console.info("mongo user init");
    return db;
  }).catch(function(err) {
    console.error("mongo user went wrong",err);
  });

var slow_db;

var slow_db_promise= mongo.connect(config.get('slow_mongo.db'))
  .then(function(db) {
    console.info("mongo slow init");
    return db;
  }).catch(function(err) {
    console.error("mongo slow went wrong",err);
  });

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// session
////////////////////////////////////////////////////////////////////////////////////////////////////////////

var slow_session = session({
  secret: 'abcde', // 建议使用 128 个字符的随机字符串
  cookie: { maxAge: 60 * 1000 * 120 },
  resave: true,
  saveUninitialized: true
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// program start
////////////////////////////////////////////////////////////////////////////////////////////////////////////

console.log('===================================');
console.log('|        all service init         |');
console.log('===================================');

Promise
  .all([
    user_db_promise,
    slow_db_promise,
    new Promise(function(resolve){
      resolve('fake service init');
    })
  ])
  .spread(function(_mongo_user_db,_mongo_slow_db ,value1) {

    user_db = _mongo_user_db;
    slow_db = _mongo_slow_db;

    console.log(value1);

    console.log('===================================');
    console.log('|        all service ready        |');
    console.log('===================================');

  })
  .then(function() {
    console.log('wechat init');

    wechat_api = new wechatAPI(config.get('wechat.appid'), config.get('wechat.appSecret'), function (callback) {
      // 传入一个获取全局token的方法
      fs.readFile('../access_token.json', 'utf8', function (err, txt) {
        if (err) {return callback(err);}
        callback(null, JSON.parse(txt));
      });
    }, function (token, callback) {

      console.info('***************************************');
      console.info('renew token');
      console.info('***************************************');

      // 请将token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
      // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
      fs.writeFile('../access_token.json', JSON.stringify(token), callback);
    });
    wechat_api.setOpts({timeout: 2 * 60 * 1000});    /** @namespace wechat_api.setOpts */
    wechat_api.setEndpoint('sh.api.weixin.qq.com');  /** @namespace wechat_api.setEndpoint */

    Promise.promisifyAll(wechat_api); /** @namespace Promise.promisifyAll */

  })
  .then(function() {
    console.log('express init');


    app.use(express.static(path.join(__dirname, 'public')));

    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    app.use('/js', express.static(__dirname + '/node_modules/jquery/dist'));
    app.use('/js', express.static(__dirname + '/node_modules/jquery-mobile-dist'));
    app.use('/js', express.static(__dirname + '/node_modules/socket.io-client/dist'));

    app.use(bodyParser.json() );       // to support JSON-encoded bodies
    app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
      extended: true
    }));


    app.use(slow_session);

    app.use(function(req, res, next){

      res.locals.user_db = user_db;
      res.locals.slow_db = slow_db;
      res.locals.wechat_api = wechat_api;
      res.locals.io = io;

      var fake = config.get('game.fake');
      if (fake == '1') {
        req.session.openid = config.get('game.fake_openid');
      }

      next();
    });


  })
  .then(function() {
    console.log('express routers init');

    app.get('/hello', function (req, res) {
      res.send('Hello World!')
    });

    // var oauth = require('./routes/oauth');
    // app.use('/oauth', oauth);

    app.get('*', function(req, res){
      res.send('what???', 404);
    });

  })
  .then(function() {



  })
  .then(function() {
    server.listen(5003,function () {
      console.log('===================================');
      console.log('|   app listening on port 5003!   |');
      console.log('===================================');
    })
  });


function graceful() {

  console.log('graceful');

  if (user_db) {
    user_db.close();
  }

  if (slow_db) {
    slow_db.close();
  }

  console.log('bye');

  process.exit(0);
}



process.on('SIGTERM', graceful);
process.on('SIGINT' , graceful);
