'use strict';

var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var gutil = require('gulp-util');
var through = require('through-gulp');

var Util = require('../../util');

var config = {};
var mapJSONCache = {};

function replace (opts) {
  config = _.assign({
    cwd: undefined,
    module: undefined,
    replaceType: 'local'
  }, opts);

  if (!config.cwd || !config.module) {
    gutil.log(gutil.colors.red('传入参数有误 at replace!'));
    return;
  }
  var modulePath = path.join(config.cwd, config.module);
  // 读取module-conf配置文件
  var moduleConf = require(path.join(modulePath, 'module-conf'));
  var appConf = require(path.join(config.cwd, 'app-conf'));
  var resourcePrefix = null;
  var mapJson = JSON.parse(fs.readFileSync(path.join(modulePath, 'dist', 'map.json')).toString());
  mapJSONCache[config.module] = mapJson;
  if (appConf && moduleConf) {
    var deployObj = appConf.deploy;
    resourcePrefix = {};
    resourcePrefix.local = 'http://localhost:3001/';
    resourcePrefix.qiang = '/' + deployObj.qiang.remotePath + '/';
    resourcePrefix.jdTest = '//' + deployObj.jdTest.domain + deployObj.jdTest.fdPath + '/' + appConf.app + '/';
    resourcePrefix.tencent = '//' + deployObj.tencent.domain + deployObj.tencent.fdPath + '/' + appConf.app + '/';
  }

  var stream = through(function (file, encoding, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }
    if (file.isBuffer()) {
      var extname = path.extname(file.path);
      if (extname.match(/js/)) {
        file.contents = new Buffer(processJs(file.contents.toString(), resourcePrefix[config.replaceType]));
      } else if (extname.match(/(css|sass|less)/)) {
        file.contents = new Buffer(processCss(file.contents.toString(), resourcePrefix[config.replaceType]));
      } else if (extname.match(/html/)) {
        file.contents = new Buffer(processHtml(file.contents.toString(), resourcePrefix[config.replaceType]));
      }
      this.push(file);
      callback();
    } else if (file.isStream()){

      return callback(null, file);
    }
  }, function (callback) {
    callback();
  });

  return stream;
}

function processHtml (contents, resourcePrefix) {
  contents = Util.processHtml(contents, function (value) {
    value = transmitResource(value, resourcePrefix, false);
    return value;
  });
  return contents;
}

function processJs (contents, resourcePrefix) {
  return contents;
}

function processCss (contents, resourcePrefix) {
  contents = Util.processCss(contents, function (value) {
    value = transmitResource(value, resourcePrefix, true);
    return value;
  });
  return contents;
}

function transmitResource (value, resourcePrefix, needMd5) {
  var vStart = '';
  var vEnd = '';
  var mapJson = mapJSONCache[config.module];
  if (value.indexOf('\"') >= 0 || value.indexOf('\'') >= 0) {
    vStart = value[0];
    vEnd = value[value.length - 1];
    value = value.replace(/\"/g, '').replace(/\'/g, '');
  }
  value = value.replace(/\\/ig,'/');
  var moduleName = value.split('/')[0];
  if (moduleName !== config.module) {
    mapJson = mapJSONCache[moduleName] = JSON.parse(fs.readFileSync(path.join(config.cwd, moduleName, 'dist', 'map.json')).toString());
  }
  if (mapJson && needMd5) {
    value = Util.getHashName(value, mapJson);
  }
  value = resourcePrefix + value;
  value = vStart + value + vEnd;
  return value;
}

module.exports = replace;
