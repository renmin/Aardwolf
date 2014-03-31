'use strict';

var path = require('path');
var fs = require('fs');
var cheerio = require('cheerio');
var beautify = require('js-beautify').js_beautify;
var $URL = require('url');
var http = require('http');

var config = require('../config/config.defaults.js');

//用于存储给调试器界面的可调式文件列表
var debugFiles={
  fileList:[],
  fileContent:{}
};
function submitList (data) {
    console.log('submitList: '+ JSON.stringify(data));
  debugFiles={
    fileList:[],
    fileContent:{}
  };
  if(data&&data.fileList){
    data.fileList.forEach(function (val,key) {
      debugFiles.fileList.push(val);
    })
  }
}


function isRewritable(filePath) {
    var fileServerBaseDir = path.normalize(config.fileServerBaseDir);
    var fullRequestedFilePath = path.join(fileServerBaseDir, filePath);
    
    /* File must exist and must be located inside the fileServerBaseDir */
    if (fs.existsSync(fullRequestedFilePath) &&
        fs.statSync(fullRequestedFilePath).isFile() &&
        fullRequestedFilePath.indexOf(fileServerBaseDir) === 0)
    {
        if (filePath.substr(-3) == '.js' || filePath.substr(-7) == '.coffee') {
            return true;
        }
        
        return false;
    }
}

function getRewrittenContent(filePath) {
    var fileServerBaseDir = path.normalize(config.fileServerBaseDir);
    var fullRequestedFilePath = path.join(fileServerBaseDir, filePath);
    
    var rewriter;
    
    if (filePath.substr(-3) == '.js') {
        rewriter = require('../rewriter/jsrewriter.js');
    }
    else if (filePath.substr(-7) == '.coffee') {
        rewriter = require('../rewriter/coffeerewriter.js');
    }
    
    if (rewriter) {
        var content = fs.readFileSync(fullRequestedFilePath).toString();
        return rewriter.addDebugStatements(filePath, content);
    }

}


function getRewrittenHTMLContent(data,callback){

    if(!data|| !data.url){return};

    var url = data.url.toLowerCase(),
      objUrl = $URL.parse(url),
      filePath=objUrl.pathname;

    var done = false, result;

    if(data.html)
    {
        doRewrite(data.html);
    }
    else{
        var html='';
      http.get(url, function(res) {
        console.log("Got response: " + res.statusCode);
        res.on('data',function(data){
                console.log("Got data, length: " + data.length);
                html += data;
                doRewrite(html);      
        });
      }).on('error', function(e) {
        console.log("Got error: " + e.message);
        var result={};
        result.error=true;
        result.message = e.message;
        callback(result);
      });

    }

    function doRewrite(html){
        try{
            var $ = cheerio.load(html);

            var linkScripts = getScripts($,url);

            //TODO: 添加weinre 引用文件
            addWeinreSupport();


            //TODO: 添加aardwolf.js节点
            //调试文件要加在最前面。但可能也有一些问题，测试一下，看看是不是要内嵌JS。
            var jsFilename = addInjectJS();
            var myhead = $('head').html()
            $('head').html(
                '<script type="text/javascript" src="'+jsFilename+'"></script>\n'
                +myhead
              );

            var result = {
            'html': $.html(),
            'linkScripts' : linkScripts,
            'jsFilename' : jsFilename
            }

            console.log('jsdom got result.');
            callback(result);
        }
        catch(ex){
            var result = {
            'error': true,
            'message': ex.message
            }

            console.log('Error occurs in getRewrittenHTMLContent, message:'+ex.message);

            callback(result);          
        }
    }
    function getScripts($,filePath){
        var linkScripts=[];

        $('script').each(function (index) {
            var jsTag = this,
                content;
                

            var jsSrc = jsTag.attr('src');

            if(jsSrc && jsSrc.length>0){

                //translate to absolute url
                if(jsSrc.indexOf('.')==0 || jsSrc.indexOf('/')==0){
                    if(url.indexOf('http')==0){        //这里主要为了防止file://的情况出现
                        jsSrc = $URL.resolve(url,jsSrc);
                    }
                }

                if (fs.existsSync(jsSrc) &&
                        fs.statSync(jsSrc).isFile()){
                    /* 本地文件不经过fiddler，忽略
                    */
                    return
                }
                else{
                    //console.log(this.src);
                    linkScripts.push(jsSrc);
                }
            }
            else {
                content = jsTag.html();
                if (content && content.length>0){
                    jsTag.html(rewriteJS(filePath+'-js-'+index,content).file);
                }
                else{
                    console.log('Warning: invalid script tag '+jsTag.outerHTML);
                }
            }
        });
        return linkScripts;
    }

    function addInjectJS (argument) {
        // body...
        var jsFilename = '__SERVER_URL__/mobile/wedere.js';
        return jsFilename
    }

    function addWeinreSupport (argument) {
        // body...
    }
    function addJs(file){ 
        var head = $('head');
        $("<scri"+"pt>"+"</scr"+"ipt>").attr({src:file,type:'text/javascript',id:'debug'}).appendTo(head);
    }

}//end of getRewrittenHTMLContent



function getRewrittenJSContent(data,callback){
    var url = data.url.toLowerCase(),
      objUrl = $URL.parse(url),
      filePath=objUrl.pathname,
      jsContent='',
      result={};


    if(data.js && data.js.length>0){      
      debugFiles.fileContent[url] = jsContent = data.js;
      result.js = rewriteJS(url,jsContent).file;
      callback(result);
    }
    else{
      //同步获取js文件
      console.log('Getting JS: '+url);

      http.get(url, function(res) {
        console.log("Got response: " + res.statusCode);
        res.on('data',function(data){
                console.log("Got data, length: " + data.length);
                jsContent += data;
                //jsContent = beautify(data, { indent_size: 2 });
                //debugFiles.fileContent[url] = jsContent;
                result.js = rewriteJS(url,jsContent).file;
                callback(result);      
        });
      }).on('error', function(e) {
        console.log("Got error: " + e.message);
        result.error=true;
        result.message = e.message;
        callback(result);
      });
    }



}//end of getRewrittenJSContent

function rewriteJS(filePath,jsContent){

      //js文件保存应该用绝对路径
      var notInList = true;
      debugFiles.fileList.forEach(function(val,key){
          if(val == filePath){
              notInList=false;
          }
      });

      if(notInList){
        debugFiles.fileList.push(filePath);
      }


  var rewriter,content;
  rewriter = require('../rewriter/jsrewriter.js');
  if (rewriter) {
      jsContent = beautify(jsContent, { indent_size: 2 });
      content = rewriter.addDebugStatements(filePath, jsContent);
      if(debugFiles&&debugFiles.fileContent){
        debugFiles.fileContent[filePath]={
                            data: jsContent, //保存原始js给调试器用。
                            breakpoints: content.breakpoints //可以加断点的行号
                        };
      }
  }
  return content
}

module.exports = {
    getRewrittenContent: getRewrittenContent,
    isRewritable: isRewritable,
    getRewrittenHTMLContent : getRewrittenHTMLContent,
    getRewrittenJSContent : getRewrittenJSContent,
    submitList: submitList,
    getFileslist : function () {
      if(debugFiles&&debugFiles.fileList){
        return debugFiles.fileList;
      }
      else{
        return [];
      }
    },
    getFileContent: function (filePath) {
        if (debugFiles&&debugFiles.fileContent) {
            return debugFiles.fileContent[filePath];
        };
        return null;
    }
};

