'use strict';

var path = require('path');
var fs = require('fs');
var jsdom = require("jsdom");
var $URL = require('url');
var http = require('http');

var config = require('../config/config.defaults.js');

var debugFiles={
  fileList=[],
  fileContent={}
};

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

function getRewrittenHTMLContent2(url,callback){


    url = url.toLowerCase();


    var done = false, result;

    jsdom.env(
      url,
      ["http://code.jquery.com/jquery.js"],
      function (errors, window) {

        if(errors){
            console.log(JSON.stringify(errors));
            return;
        }
        var $ = window.$;

        var linkScripts = getScripts($,url);

        $('.jsdom').remove();

        var result = {
          'html': window.document.outerHTML,
          'linkScripts' : linkScripts
        }

        console.log('jsdom got result.');
        callback(result);

      }
    );


    function getScripts($,filePath){
      var linkScripts=[];

            $('script').each(function (index) {
                var s = $(this),
                    content;

                if(this.getAttribute('class')==='jsdom'){return};
                
                if(this.src && this.src.length>0){

                  var jsSrc = this.src;

                  //translate to absolute url
                  if(jsSrc.indexOf('.')==0 || jsSrc.indexOf('/')==0){
                    if(url.indexOf('http')==0){
                      jsSrc = $URL.resolve(url,jsSrc);
                    }
                  }

                  if (fs.existsSync(jsSrc) &&
                        fs.statSync(jsSrc).isFile()){
                    /* 本地文件不经过fiddler，忽略
                    content = fs.readFileSync(this.src).toString();
                    linkScripts[this.src] = rewriteJS(content);
                    */
                    return
                  }
                  else{
                    //console.log(this.src);
                    linkScripts.push(jsSrc);
                  }
                }
                else if (this.text && this.text.length>0){
                    content = this.text;
                    this.text = rewriteJS(content,filePath+'-js-'+index);
                }
                else{
                    console.log('Warning: invalid script tag '+this.outerHTML);
                }

            });

      return linkScripts;

    }
    function rewriteJS(content){
      content='console.log("rewrited");'+content;
      return content;
    }


}//end of getRewrittenHTMLContent2


function getRewrittenHTMLContent(data,callback){


    var url = data.url.toLowerCase(),
      objUrl = $URL.parse(url),
      filePath=objUrl.pathname;

    var done = false, result;

    jsdom.env(
      data.html? data.html: url,
      ["http://cache.soso.com/wenwen/js/jquery-1.6.2.min.js"],
      function (errors, window) {

        if(errors){
            console.log(JSON.stringify(errors));
            return;
        }
        try{
          var $ = window.$;

          var linkScripts = getScripts($,filePath);

          $('.jsdom').remove();

          //TODO: 添加weinre 引用文件
          addWeinreSupport();


          //TODO: 添加aardwolf.js节点
          //调试文件要加在最前面。但可能也有一些问题，测试一下，看看是不是要内嵌JS。
          var jsFilename = addInjectJS();
          window.document.head.innerHTML = 
            '<script type="text/javascript" src="'+jsFilename+'"></script>\n'
            +window.document.head.innerHTML;

          var result = {
            'html': window.document.outerHTML,
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



        function getScripts($,filePath){
          var linkScripts=[];

                $('script').each(function (index) {
                    var jsTag = this,
                        content;

                    if(jsTag.getAttribute('class')==='jsdom'){return};
                    
                    if(jsTag.src && jsTag.src.length>0){

                      var jsSrc = jsTag.src;

                      //translate to absolute url
                      if(jsSrc.indexOf('.')==0 || jsSrc.indexOf('/')==0){
                        if(url.indexOf('http')==0){
                          jsSrc = $URL.resolve(url,jsSrc);
                        }
                      }

                      if (fs.existsSync(jsSrc) &&
                            fs.statSync(jsSrc).isFile()){
                        /* 本地文件不经过fiddler，忽略
                        content = fs.readFileSync(this.src).toString();
                        linkScripts[this.src] = rewriteJS(content);
                        */
                        return
                      }
                      else{
                        //console.log(this.src);
                        linkScripts.push(jsSrc);
                      }
                    }
                    else if (jsTag.text && jsTag.text.length>0){
                        content = jsTag.text;
                        jsTag.text = rewriteJS(filePath+'-js-'+index,content).file;
                    }
                    else{
                        console.log('Warning: invalid script tag '+jsTag.outerHTML);
                    }

                });

          return linkScripts;

        }
        function addInjectJS (argument) {
          // body...
          var jsFilename = '__SERVER_URL__/mobile/wedere.js';
          /*
          if (data.injectFileName) {
            jsFilename = './'+data.injectFileName;
          };
          */
          return jsFilename
        }

        function addWeinreSupport (argument) {
          // body...
        }
        function addJs(file){ 
          var head = $('head');
          $("<scri"+"pt>"+"</scr"+"ipt>").attr({src:file,type:'text/javascript',id:'debug'}).appendTo(head);
        }

      }
    );    
}//end of getRewrittenHTMLContent



function getRewrittenJSContent(data,callback){
    var url = data.url.toLowerCase(),
      objUrl = $URL.parse(url),
      filePath=objUrl.pathname,
      jsContent='',
      result={};

      if(!$.inArray(filePath,debugFiles.fileList)){
        debugFiles.fileList.push(filePath);
      }

    if(data.js && data.js.length>0){      
      debugFiles.fileContent[filePath] = jsContent = data.js;
      result.js = rewriteJS(filePath,jsContent).file;
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
                debugFiles.fileContent[filePath] = jsContent;
                result.js = rewriteJS(filePath,jsContent).file;
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
  var rewriter,content;
  rewriter = require('../rewriter/jsrewriter.js');
  if (rewriter) {
      content = rewriter.addDebugStatements(filePath, jsContent);
  }
  return content
}

module.exports = {
    getRewrittenContent: getRewrittenContent,
    isRewritable: isRewritable,
    getRewrittenHTMLContent : getRewrittenHTMLContent,
    getRewrittenJSContent : getRewrittenJSContent
};

