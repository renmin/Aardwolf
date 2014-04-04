'use strict';

var cheerio = require('cheerio');
var rewriter = require('./rewriter/jsrewriter.js');

function test1(){
    var cheerio = require('cheerio'),
    $ = cheerio.load(
        '<!doctype html>\
        <html lang="en">\
        <head>\        </head>\        <body>\
        </body>\
        </html>');

    var $script = $('<script></script>')
    $script.text('var i="<top>";console.log(i);');

    $('head').append($script);

    return $.html();
}


module.exports.test1 = test1;

module.exports.testJS1 = function(){
    var js = '\
    if (p.attachEvent)\
        for (n in {\
            submit: 1,\
            change: 1,\
            focusin: 1\
          }) m = "on" + n, o = m in p, o || (p.setAttribute(m, "return;"), o = typeof p[m] == "function"), b[n + "Bubbles"] = o;\
';
    return rewriter.addDebugStatements('testfile',js).file;
}