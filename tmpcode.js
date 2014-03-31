'use strict';

var cheerio = require('cheerio');

function test1(){
    var cheerio = require('cheerio'),
    $ = cheerio.load(
        '<!doctype html>\
        <html lang="en">\
        <head>\        </head>\        <body>\
        </body>\
        </html>');

    var $script = $('<script></script>')
    $script.html('var i="<top>";console.log(i);');

    $('head').append($script);

    return $.html();
}


module.exports.test1 = test1;