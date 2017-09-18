/** @namespace req.connection.remoteAddress */
/** @namespace Promise.config */


const config = require('config');

const express = require('express');


const Promise = require('bluebird');
Promise.config({
  cancellation: true
});
const request = require('request-promise');

const router = express.Router();

const moment = require('moment');

const uuidv1 = require('uuid/v1');

router.get('/home', function(req, res, next) {
  console.log('==========================================');
  console.log('home', req.session.openid);
  console.log('==========================================');

  var wechat_api = res.locals.wechat_api;

  var user_db = res.locals.user_db;
  var slow_db = res.locals.slow_db;

  var self_openid = req.session.openid;

  if (self_openid == undefined) {
    console.log('self_openid',self_openid);
    console.log('第0步：重导向 start_wx_openid');
    var redirect_url = config.get('redirect_server')+'/oauth/start_wx_openid';
    res.redirect(redirect_url);
    return;
  }
  console.log('self_openid',self_openid);

});

//取得openid 和 新增 user
router.get('/start_wx_openid', function(req,res, next){
  console.log('==========================================');
  console.log('start_wx_openid',req.session.openid);
  console.log('==========================================');
  console.log('第0步：重导向授权页 get_wx_openid');

  var authorize_config = {
    base_uri      : 'https://open.weixin.qq.com/connect/oauth2/authorize',
    appid         : config.get('wechat.appid'),
    redirect_uri  : encodeURIComponent(config.get('redirect_server')+"/oauth/get_wx_openid"),
    response_type : 'code',
    scope         : 'snsapi_base',
    state         : 'slow'
  };

  var authorize_uri = authorize_config.base_uri
    +'?appid='+authorize_config.appid
    +'&redirect_uri='+authorize_config.redirect_uri
    +'&response_type='+authorize_config.response_type
    +'&scope='+authorize_config.scope
    +'&state='+authorize_config.state
    +'#wechat_redirect';

  // =================================================================================================================================================================================
  // 第一步：用户同意授权，获取code
  // =================================================================================================================================================================================
  res.redirect(authorize_uri);
});

router.get('/get_wx_openid', function(req,res, next){

  var ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
  console.log('==========================================');
  console.log('get_wx_openid','target_uuid =',req.query.state);
  console.log('==========================================');

  console.log('第1步：用户同意授权，获取code');


  var user_db = res.locals.user_db;
  var users   = user_db.collection('users');

  var access_token_config = {
    base_uri   : 'https://api.weixin.qq.com/sns/oauth2/access_token',
    appid      : config.get('wechat.appid'),
    secret     : config.get('wechat.appSecret'),
    code       : req.query.code,
    grant_type : 'authorization_code'
  };

  var access_token_uri = access_token_config.base_uri
    +'?appid='+access_token_config.appid
    +'&secret='+access_token_config.secret
    +'&code='+access_token_config.code
    +'&grant_type='+access_token_config.grant_type;

  console.log('第2步：通过code换取网页授权access_token');

  var access_token_options = {
    uri: access_token_uri
  };


  // =================================================================================================================================================================================
  // 第二步：通过code换取openid
  // =================================================================================================================================================================================

  var api_user_promise = request.get(access_token_options);


  Promise
    .all([
      api_user_promise
    ])
    .spread(function(api_body) {

      var api_user = JSON.parse(api_body);

      console.log('第3步：api_user.openid = ', api_user.openid);

      if(api_body!=null) {
        console.log('第3步：api_user', api_body.substr(0,200));
      }

      var self_openid = api_user.openid;

      req.session.openid = self_openid;

      var db_user_promise = users.findOne({openid: self_openid});
      return db_user_promise;
    })
    .then(function (db_user) {

      var self_openid = req.session.openid;

      if (db_user == null) {

        console.log('第4步：新增db_user');

        db_user = {
          uuid           : uuidv1(),
          openid         : self_openid,

          subscribe      : 0,
          subscribe_time : -1,

          nickname       : '',
          headimgurl     : '',
          sex            : '',
          city           : '',
          language       : '',

          createtime     : moment().format("YYYY-MM-DD HH:mm:ss"),

          ip             : ip,

          result         : 0,

          from           : config.get('from')

        }
      }
      return users.save(db_user);
    })
    .then(function(result) {
      console.log('第5步：导到start_wx_userinfo');

      var redirect_url = config.get('redirect_server')+'/oauth/start_wx_userinfo';
      res.redirect(redirect_url);
      return;
    })
    .catch(function (error) {
      if(error) {
        console.log('catch error =', error);
      }

      res.render('99_error', {
        error : error
      });
      return;
    });
});

router.get('/start_wx_userinfo', function(req,res, next){

  console.log('==========================================');
  console.log('start_wx_userinfo',req.session.openid);
  console.log('==========================================');

  console.log('第0步：重导向授权页 get_wx_userinfo');

  var authorize_config = {
    base_uri : 'https://open.weixin.qq.com/connect/oauth2/authorize',
    appid         : config.get('wechat.appid'),
    redirect_uri  : encodeURIComponent(config.get('redirect_server')+"/oauth/get_wx_userinfo"),
    response_type : 'code',
    scope         : 'snsapi_userinfo',
    state         : 'slow'
  };

  var authorize_uri = authorize_config.base_uri
    +'?appid='+authorize_config.appid
    +'&redirect_uri='+authorize_config.redirect_uri
    +'&response_type='+authorize_config.response_type
    +'&scope='+authorize_config.scope
    +'&state='+authorize_config.state
    +'#wechat_redirect';

  // =================================================================================================================================================================================
  // 第一步：用户同意授权，获取code
  // =================================================================================================================================================================================
  res.redirect(authorize_uri);


});

router.get('/get_wx_userinfo', function(req,res, next){

  var ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
  console.log('==========================================');
  console.log('get_wx_userinfo',req.session.openid);
  console.log('==========================================');

  console.log('第1步：用户同意授权，获取code');

  var user_db   = res.locals.user_db;

  var users = user_db.collection('users');

  var access_token_config = {
    base_uri   : 'https://api.weixin.qq.com/sns/oauth2/access_token',
    appid      : config.get('wechat.appid'),
    secret     : config.get('wechat.appSecret'),
    code       : req.query.code,
    grant_type : 'authorization_code'
  };

  var access_token_uri = access_token_config.base_uri
    +'?appid='+access_token_config.appid
    +'&secret='+access_token_config.secret
    +'&code='+access_token_config.code
    +'&grant_type='+access_token_config.grant_type;

  console.log('第2步：通过code换取网页授权access_token');

  var access_token_options = {
    uri: access_token_uri
  };

  var wechat_userinfo_access_token_promise = request.get(access_token_options);

  Promise
    .all([
      wechat_userinfo_access_token_promise
    ])
    .spread(function(wechat_userinfo_access_token_body) {

      var access_token_info = JSON.parse(wechat_userinfo_access_token_body);

      var db_user_promise = users.findOne({openid:access_token_info.openid});

      var userinfo_config = {
        base_uri     : 'https://api.weixin.qq.com/sns/userinfo',
        access_token : access_token_info.access_token,
        openid       : access_token_info.openid,
        lang         : 'zh_CN',
      };

      req.session.openid = access_token_info.openid;

      var userinfo_uri = userinfo_config.base_uri
        +'?access_token='+userinfo_config.access_token
        +'&openid='+userinfo_config.openid
        +'&lang='+userinfo_config.lang;

      console.log('第3步：拉取用户信息(需scope为 snsapi_userinfo)');

      var userinfo_options = {
        uri: userinfo_uri
      };

      var user_info_promise = request.get(userinfo_options);
      return [user_info_promise,db_user_promise];
    })
    .spread(function(body,db_user) {

      console.log('第4步：获取微信信息成功！');

      if(body!=null) {
        console.log('第4步：body',body.substr(0,200));
      }

      console.log('第4步：db_user',db_user!=null);

      if (db_user == null) {
        req.session.openid = undefined;
        var redirect_url = config.get('redirect_server') + '/oauth/start_wx_openid';
        res.redirect(redirect_url);
        return;
      }

      var user_info = JSON.parse(body);

      db_user.nickname   = user_info.nickname;
      db_user.headimgurl = user_info.headimgurl;
      db_user.sex        = user_info.sex;
      db_user.city       = user_info.city;
      db_user.language   = user_info.language;
      db_user.ip         = ip;

      return users.save(db_user);
    })
    .then(function (result) {

      console.log('第5步：更新微信信息成功！');
      console.log('第6步：回首页！');

      var redirect_url = config.get('redirect_server')+'/oauth/home';
      res.redirect(redirect_url);
      return;
    })
    .catch(function (error) {
      if(error) {
        console.log('catch error =', error);
      }

      res.render('99_error', {
        redirect_server: config.get('redirect_server'),
        error          : error,
      });
      return;
    });
});
