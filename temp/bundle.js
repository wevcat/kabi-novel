(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.4.5
var LZString = (function() {

// private property
var f = String.fromCharCode;
var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
var baseReverseDic = {};

function getBaseValue(alphabet, character) {
  if (!baseReverseDic[alphabet]) {
    baseReverseDic[alphabet] = {};
    for (var i=0 ; i<alphabet.length ; i++) {
      baseReverseDic[alphabet][alphabet.charAt(i)] = i;
    }
  }
  return baseReverseDic[alphabet][character];
}

var LZString = {
  compressToBase64 : function (input) {
    if (input == null) return "";
    var res = LZString._compress(input, 6, function(a){return keyStrBase64.charAt(a);});
    switch (res.length % 4) { // To produce valid Base64
    default: // When could this happen ?
    case 0 : return res;
    case 1 : return res+"===";
    case 2 : return res+"==";
    case 3 : return res+"=";
    }
  },

  decompressFromBase64 : function (input) {
    if (input == null) return "";
    if (input == "") return null;
    return LZString._decompress(input.length, 32, function(index) { return getBaseValue(keyStrBase64, input.charAt(index)); });
  },

  compressToUTF16 : function (input) {
    if (input == null) return "";
    return LZString._compress(input, 15, function(a){return f(a+32);}) + " ";
  },

  decompressFromUTF16: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    return LZString._decompress(compressed.length, 16384, function(index) { return compressed.charCodeAt(index) - 32; });
  },

  //compress into uint8array (UCS-2 big endian format)
  compressToUint8Array: function (uncompressed) {
    var compressed = LZString.compress(uncompressed);
    var buf=new Uint8Array(compressed.length*2); // 2 bytes per character

    for (var i=0, TotalLen=compressed.length; i<TotalLen; i++) {
      var current_value = compressed.charCodeAt(i);
      buf[i*2] = current_value >>> 8;
      buf[i*2+1] = current_value % 256;
    }
    return buf;
  },

  //decompress from uint8array (UCS-2 big endian format)
  decompressFromUint8Array:function (compressed) {
    if (compressed===null || compressed===undefined){
        return LZString.decompress(compressed);
    } else {
        var buf=new Array(compressed.length/2); // 2 bytes per character
        for (var i=0, TotalLen=buf.length; i<TotalLen; i++) {
          buf[i]=compressed[i*2]*256+compressed[i*2+1];
        }

        var result = [];
        buf.forEach(function (c) {
          result.push(f(c));
        });
        return LZString.decompress(result.join(''));

    }

  },


  //compress into a string that is already URI encoded
  compressToEncodedURIComponent: function (input) {
    if (input == null) return "";
    return LZString._compress(input, 6, function(a){return keyStrUriSafe.charAt(a);});
  },

  //decompress from an output of compressToEncodedURIComponent
  decompressFromEncodedURIComponent:function (input) {
    if (input == null) return "";
    if (input == "") return null;
    input = input.replace(/ /g, "+");
    return LZString._decompress(input.length, 32, function(index) { return getBaseValue(keyStrUriSafe, input.charAt(index)); });
  },

  compress: function (uncompressed) {
    return LZString._compress(uncompressed, 16, function(a){return f(a);});
  },
  _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary= {},
        context_dictionaryToCreate= {},
        context_c="",
        context_wc="",
        context_w="",
        context_enlargeIn= 2, // Compensate for the first entry which should not count
        context_dictSize= 3,
        context_numBits= 2,
        context_data=[],
        context_data_val=0,
        context_data_position=0,
        ii;

    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }

      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          if (context_w.charCodeAt(0)<256) {
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<8 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position ==bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<16 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }


        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        // Add wc to the dictionary.
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    // Output the code for w.
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        if (context_w.charCodeAt(0)<256) {
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<8 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<16 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i=0 ; i<context_numBits ; i++) {
          context_data_val = (context_data_val << 1) | (value&1);
          if (context_data_position == bitsPerChar-1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }


      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    // Mark the end of the stream
    value = 2;
    for (i=0 ; i<context_numBits ; i++) {
      context_data_val = (context_data_val << 1) | (value&1);
      if (context_data_position == bitsPerChar-1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }

    // Flush the last char
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == bitsPerChar-1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      }
      else context_data_position++;
    }
    return context_data.join('');
  },

  decompress: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    return LZString._decompress(compressed.length, 32768, function(index) { return compressed.charCodeAt(index); });
  },

  _decompress: function (length, resetValue, getNextValue) {
    var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = [],
        i,
        w,
        bits, resb, maxpower, power,
        c,
        data = {val:getNextValue(0), position:resetValue, index:1};

    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }

    bits = 0;
    maxpower = Math.pow(2,2);
    power=1;
    while (power!=maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb>0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch (next = bits) {
      case 0:
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 1:
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) {
        return "";
      }

      bits = 0;
      maxpower = Math.pow(2,numBits);
      power=1;
      while (power!=maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb>0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (c = bits) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 2:
          return result.join('');
      }

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result.push(entry);

      // Add w+entry[0] to the dictionary.
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;

      w = entry;

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

    }
  }
};
  return LZString;
})();

if (typeof define === 'function' && define.amd) {
  define(function () { return LZString; });
} else if( typeof module !== 'undefined' && module != null ) {
  module.exports = LZString
} else if( typeof angular !== 'undefined' && angular != null ) {
  angular.module('LZString', [])
  .factory('LZString', function () {
    return LZString;
  });
}

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bar_1 = require("../common/bar/bar");
var common_1 = require("../common/common");
var pagination_1 = require("../common/pagination/pagination");
var Article = /** @class */ (function () {
    function Article() {
        var _this = this;
        this.catalogue = [];
        this.loading = false;
        this.element = document.querySelector('.page.article');
        this.pagination = new pagination_1.default({
            root: this.element.querySelector('.content')
        });
        this.bar = new bar_1.default({
            element: this.element.querySelector('.bar'),
            pagination: this.pagination
        });
        window.Bind.bindView(this.element.querySelector('.content-inner'), this, 'content', function (content) {
            if (!content) {
                return '';
            }
            var html = "\n                <style>\n                </style>\n            ";
            content.split('\n').map(function (v) {
                return v.trim();
            }).filter(function (v) { return !!v; }).forEach(function (v) {
                html += "\n                    <p>".concat(v, "</p>\n                ");
            });
            window.setTimeout(function () {
                _this.pagination.checkPage();
                _this.setPageByProgress();
            });
            return html;
        });
        window.Bind.bind(this, 'progress', function (newV, oldV) {
            if (!oldV) {
                return;
            }
            window.Store.setObj("p_".concat(_this.currentBook.id), newV);
            if (_this.progress.pos > _this.content.length) {
                return;
            }
            window.Api.saveProgress(_this.currentBook, _this.progress);
        });
        var current = this.element.querySelector('.current-info');
        var changeInfo = function () {
            var _a, _b, _c;
            return "".concat((_a = _this.currentBook) === null || _a === void 0 ? void 0 : _a.name, " - ").concat((_b = _this.currentBook) === null || _b === void 0 ? void 0 : _b.author, " - ").concat((_c = _this.progress) === null || _c === void 0 ? void 0 : _c.title);
        };
        window.Bind.bindView(current, this, 'currentBook', changeInfo);
        window.Bind.bindView(current, this, 'progress', changeInfo);
        window.Bind.bindView(current, this, 'catalogue', changeInfo);
        var content = this.element.querySelector('.content');
        var contentInner = content.querySelector('.content-inner');
        window.Bind.bindStyle(contentInner, window.Layout, 'fontSize', 'fontSize', function (v) { return "".concat(v, "px"); });
        window.Bind.bindStyle(contentInner, window.Layout, 'lineHeight', 'lineHeight', function (v) { return "".concat(v, "px"); });
        window.Bind.bindStyle(content, window.Layout, 'lineHeight', 'height', function (v) {
            if (!_this.element.offsetHeight) {
                return '';
            }
            var base = _this.element.offsetHeight - 230 - 20;
            var oo = base % window.Layout.lineHeight;
            if (oo < 10) {
                oo += window.Layout.lineHeight;
            }
            var height = base - oo + 20;
            current.style.height = "".concat(oo, "px");
            current.style.lineHeight = "".concat(oo, "px");
            window.setTimeout(function () { return _this.pagination.checkPage(); });
            return "".concat(height, "px");
        });
        var func = function () {
            var current = window.Store.get('current');
            _this.currentBook = window.BookShelf.bookMap[current];
            if (!_this.currentBook) {
                if (window.Router.current === 'article') {
                    window.Router.go('bookshelf');
                }
                return;
            }
            window.Layout.lineHeight = window.Layout.lineHeight;
            _this.catalogue = window.Store.getObj("c_".concat(current)) || [];
            _this.progress = window.Store.getObj("p_".concat(_this.currentBook.id));
            _this.getContent();
        };
        window.Router.cbMap.article = func;
        func();
    }
    Article.prototype.getContent = function () {
        this.content = window.Store.get("a_".concat(this.currentBook.id, "_").concat(this.progress.index)) || '';
        var cb = function () {
            window.setTimeout(function () {
                var _a;
                (_a = window.Catalogue) === null || _a === void 0 ? void 0 : _a.doCache(5);
            });
        };
        if (!this.content) {
            this.getArticle(cb);
        }
        else {
            cb();
        }
    };
    Article.prototype.pageChange = function (num) {
        var target = this.pagination.pageIndex + num;
        if (target < 0 || target >= this.pagination.pageLimit) {
            var index = this.progress.index + num;
            var pos = num === -1 ? 999999999999 : 0; // to the end
            this.progress = (0, common_1.changeValueWithNewObj)(this.progress, { index: index, title: this.catalogue[index].title, time: new Date().getTime(), pos: pos });
            this.getContent();
        }
        else {
            this.pagination.setPage(target);
            this.getPagePos(target);
        }
    };
    Article.prototype.getPagePos = function (target) {
        var top = target * this.pagination.pageStep;
        var ps = this.element.querySelectorAll('.content-inner p');
        var str = '';
        for (var i = 0; i < ps.length; i++) {
            if (ps[i].offsetTop >= top) {
                str = ps[i].innerHTML;
                break;
            }
        }
        var pos = this.content.indexOf(str);
        this.progress = (0, common_1.changeValueWithNewObj)(this.progress, { time: new Date().getTime(), pos: pos });
    };
    Article.prototype.setPageByProgress = function () {
        var target = this.content.slice(0, this.progress.pos).split('\n').length - 1;
        var ele = this.element.querySelectorAll('.content-inner p')[target];
        var top = ele.offsetTop;
        var index = Math.floor(top / this.pagination.pageStep);
        this.pagination.setPage(index);
        if (this.progress.pos > this.content.length) { //reset to right
            this.getPagePos(index);
        }
    };
    Article.prototype.getArticle = function (cb) {
        var _this = this;
        if (this.loading === true) {
            window.Message.add({ content: '正在加载章节内容' });
            return;
        }
        this.loading = true;
        window.Api.getArticle(this.currentBook.source, this.progress.index, {
            success: function (res) {
                _this.loading = false;
                _this.content = res.data;
                window.Store.set("a_".concat(_this.currentBook.id, "_").concat(_this.progress.index), _this.content);
                cb && cb();
            },
            error: function (err) {
                _this.loading = false;
            }
        });
    };
    return Article;
}());
;
exports.default = Article;

},{"../common/bar/bar":6,"../common/common":8,"../common/pagination/pagination":13}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bar_1 = require("../common/bar/bar");
var common_1 = require("../common/common");
var pagination_1 = require("../common/pagination/pagination");
var BookShelf = /** @class */ (function () {
    function BookShelf() {
        var _this = this;
        this.bookMap = {};
        this.bookList = [];
        this.loading = false;
        this.element = document.querySelector('.page.bookshelf');
        this.pagination = new pagination_1.default({
            root: this.element.querySelector('.content')
        });
        this.bar = new bar_1.default({
            element: this.element.querySelector('.bar'),
            pagination: this.pagination
        });
        this.bookList = window.Store.getObj('bookshelf') || [];
        // this.bookList = window.Store.getByHead('b_').map(v => JSON.parse(window.Store.get(v) || ''));//wait
        window.Bind.bindView(this.element.querySelector('.book-list'), this, 'bookList', function (bookList, oldV) {
            if (oldV === void 0) { oldV = []; }
            _this.compareBookList(bookList, oldV);
            var height = _this.element.querySelector('.pagination-box').offsetHeight / 4;
            var imgWidth = height * 3 / 4;
            var width = Math.floor(_this.element.querySelector('.book-list').offsetWidth / 2);
            var html = "\n                <style>\n                    .book-item {height: ".concat(height, "px;}\n                    .book-item .book-cover {width: ").concat(imgWidth, "px;}\n                    .book-item .book-info {width: ").concat(width - imgWidth - 30, "px;}\n                </style>\n            ");
            bookList.forEach(function (book) {
                var date = new Date(book.latestChapterTime);
                var progress = window.Store.getObj("p_".concat(book.id));
                html += "\n                    <div class=\"book-item\" key=\"".concat(book.id, "\">\n                        <div class=\"book-cover\" style=\"background-image: url(").concat(book.customCoverUrl, ");\">\n                            <img src=\"").concat(book.coverUrl, "\" alt=\"").concat(book.name, "\"/>\n                        </div>\n                        <div class=\"book-info\">\n                            <div class=\"book-name\">").concat(book.name, "</div>\n                            <div class=\"book-author\">").concat(book.author, "</div>\n                            <div class=\"book-dur\">").concat(progress.title, "</div>\n                            <div class=\"book-latest\">").concat(book.latestChapterTitle, "</div>\n                            <div class=\"book-latest-time\">\u66F4\u65B0\u65F6\u95F4\uFF1A").concat(date.getFullYear(), "-").concat(date.getMonth() + 1, "-").concat(date.getDay(), "</div>\n                        </div>\n                    </div>\n                ");
            });
            window.setTimeout(function () {
                _this.pagination.checkPage();
            });
            return html;
        });
        window.Router.cbMap.bookshelf = function () {
            _this.bookList = [].concat(_this.bookList);
        };
    }
    BookShelf.prototype.bookDelete = function (book, onlySource) {
        if (!onlySource) {
            window.Store.del("p_".concat(book.id));
        }
        window.Store.del("c_".concat(book.id));
        window.Store.getByHead("a_".concat(book.id)).forEach(function (v) { return window.Store.del(v); });
    };
    BookShelf.prototype.compareBookList = function (newV, oldV) {
        var _this = this;
        var oldMap = this.bookMap;
        this.bookMap = {};
        newV.forEach(function (book) {
            _this.bookMap[book.id] = book;
            if (oldMap[book.id]) {
                if (book.source !== oldMap[book.id].source) {
                    _this.bookDelete(oldMap[book.id], true);
                }
                delete oldMap[book.id];
            }
        });
        Object.keys(oldMap).forEach(function (id) {
            _this.bookDelete(oldMap[id]);
        });
    };
    BookShelf.prototype.getBookShelf = function () {
        var _this = this;
        if (this.loading === true) {
            window.Message.add({ content: '正在加载书架数据' });
            return;
        }
        this.loading = true;
        window.Api.getBookshelf({
            success: function (res) {
                _this.loading = false;
                var bookList = res.data.map(function (book) {
                    var id = window.Store.compress("".concat(book.name, "_").concat(book.author));
                    var keys = ['name', 'author', 'coverUrl', 'customCoverUrl', 'latestChapterTime', 'latestChapterTitle'];
                    var pobj = (0, common_1.getObject)(book, [], {
                        index: book.durChapterIndex,
                        pos: book.durChapterPos,
                        time: new Date(book.durChapterTime).getTime(),
                        title: book.durChapterTitle
                    });
                    var old = window.Store.getObj("p_".concat(id));
                    if (!old || old.time < pobj.time) {
                        window.Store.setObj("p_".concat(id), pobj);
                    }
                    return (0, common_1.getObject)(book, keys, {
                        id: id,
                        source: book.bookUrl
                    });
                });
                _this.bookList = [].concat(bookList);
                window.Store.setObj('bookshelf', _this.bookList);
            },
            error: function (err) {
                _this.loading = false;
            }
        });
    };
    BookShelf.prototype.clickItem = function (event) {
        var item = (0, common_1.getSpecialParent)((event.target || event.srcElement), function (ele) {
            return ele.classList.contains('book-item');
        });
        var id = item.getAttribute('key');
        window.Store.set('current', id);
        window.Router.go('article');
    };
    return BookShelf;
}());
;
exports.default = BookShelf;

},{"../common/bar/bar":6,"../common/common":8,"../common/pagination/pagination":13}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bar_1 = require("../common/bar/bar");
var common_1 = require("../common/common");
var pagination_1 = require("../common/pagination/pagination");
var Catalogue = /** @class */ (function () {
    function Catalogue() {
        var _this = this;
        this.list = [];
        this.pageList = [];
        this.oo = 10;
        this.loading = false;
        this.cacheFlag = false;
        this.element = document.querySelector('.page.catalogue');
        this.pagination = new pagination_1.default({
            root: this.element.querySelector('.content'),
            fake: true,
            pageChange: function (index) {
                var start = index * _this.linePerPage;
                _this.pageList = _this.list.slice(start, start + _this.linePerPage);
            }
        });
        this.bar = new bar_1.default({
            element: this.element.querySelector('.bar'),
            pagination: this.pagination
        });
        var current = this.element.querySelector('.current-info');
        window.Bind.bind(this, 'list', function (list) {
            if (!_this.linePerPage) {
                return;
            }
            _this.pagination.checkPage(Math.ceil(list.length / _this.linePerPage));
            _this.pagination.setPage(Math.floor(_this.progress.index / _this.linePerPage));
        });
        window.Bind.bindView(this.element.querySelector('.article-list'), this, 'pageList', function (list) {
            var html = "\n                <style>\n                    .article-item {line-height: 80px;}\n                </style>\n            ";
            list.forEach(function (article) {
                var current = article.index === _this.progress.index ? 'current' : '';
                var cached = window.Store.has("a_".concat(_this.currentBook.id, "_").concat(article.index)) ? 'cached' : '';
                html += "\n                    <div class=\"article-item ".concat(current, " ").concat(cached, "\" key=\"").concat(article.index, "\">").concat(article.title, "</div>\n                ");
            });
            return html;
        });
        window.Bind.bindView(current, this, 'currentBook', function () {
            var _a, _b;
            return "".concat((_a = _this.currentBook) === null || _a === void 0 ? void 0 : _a.name, " - ").concat((_b = _this.currentBook) === null || _b === void 0 ? void 0 : _b.author);
        });
        window.Bind.bind(this, 'progress', function (newV, oldV) {
            window.Store.setObj("p_".concat(_this.currentBook.id), newV);
        });
        var func = function () {
            _this.currentBook = window.BookShelf.bookMap[window.Store.get('current')];
            if (!_this.currentBook) {
                if (window.Router.current === 'catalogue') {
                    window.Router.go('bookshelf');
                }
                return;
            }
            _this.checkHeight();
            _this.progress = window.Store.getObj("p_".concat(_this.currentBook.id));
            _this.list = window.Store.getObj("c_".concat(_this.currentBook.id)) || [];
            if (_this.list.length === 0) {
                _this.getCatalogue();
            }
        };
        window.Router.cbMap.catalogue = func;
        func();
    }
    Catalogue.prototype.checkHeight = function () {
        var height = this.element.offsetHeight - 230 - 20;
        var oo = height % 80;
        if (oo < 10) {
            oo += 80;
        }
        this.oo = oo;
        this.linePerPage = Math.round((height - oo) / 80) * 2;
        var current = this.element.querySelector('.current-info');
        var content = this.element.querySelector('.content');
        current.style.height = "".concat(oo, "px");
        current.style.lineHeight = "".concat(oo, "px");
        content.style.height = "".concat(height - oo + 20, "px");
    };
    Catalogue.prototype.getCatalogue = function () {
        var _this = this;
        if (this.loading === true) {
            window.Message.add({ content: '正在加载目录数据' });
            return;
        }
        this.loading = true;
        window.Api.getCatalogue(this.currentBook.source, {
            success: function (res) {
                _this.loading = false;
                _this.list = res.data.map(function (v) {
                    return {
                        index: v.index,
                        title: v.title
                    };
                });
                window.Store.setObj("c_".concat(_this.currentBook.id), _this.list);
            },
            error: function (err) {
                _this.loading = false;
            }
        });
    };
    Catalogue.prototype.clickItem = function (event) {
        var item = (0, common_1.getSpecialParent)((event.target || event.srcElement), function (ele) {
            return ele.classList.contains('article-item');
        });
        var index = parseInt(item.getAttribute('key'));
        this.progress = (0, common_1.changeValueWithNewObj)(this.progress, { index: index, title: this.list[index].title, time: new Date().getTime(), pos: 0 });
        window.setTimeout(function () {
            window.Router.go('article');
        });
    };
    Catalogue.prototype.makeCache = function (start, end) {
        var _this = this;
        if (start > end) {
            this.cacheFlag = false;
            window.Message.add({
                content: '缓存任务完成'
            });
            return;
        }
        if (window.Store.has("a_".concat(this.currentBook.id, "_").concat(start))) {
            this.makeCache(start + 1, end);
            return;
        }
        window.Api.getArticle(this.currentBook.source, start, {
            success: function (res) {
                var _a;
                window.Store.set("a_".concat(_this.currentBook.id, "_").concat(start), res.data);
                (_a = _this.element.querySelector(".article-item[key=\"".concat(start, "\"]"))) === null || _a === void 0 ? void 0 : _a.classList.add('cached');
                _this.makeCache(start + 1, end);
            },
            error: function (err) {
                window.Message.add({
                    content: "\u7F13\u5B58\u7AE0\u8282\u300A".concat(_this.list[start].title, "\u300B\u5931\u8D25")
                });
                _this.makeCache(start + 1, end);
            }
        });
    };
    Catalogue.prototype.doCache = function (val) {
        var _a;
        if (this.cacheFlag) {
            window.Message.add({
                content: '正在缓存，请勿重复操作'
            });
            return;
        }
        window.Modal.add({
            content: '5'
        });
        this.cacheFlag = true;
        var start = ((_a = this.progress) === null || _a === void 0 ? void 0 : _a.index) || 0;
        var last = this.list[this.list.length - 1].index;
        if (val === 'all') {
            start = 0;
        }
        if (typeof val === 'number') {
            last = Math.min(last, start + val);
        }
        window.Modal.add({
            content: '1'
        });
        this.makeCache(start, last);
    };
    Catalogue.prototype.deleteCache = function (type) {
        var _this = this;
        if (this.cacheFlag) {
            window.Message.add({
                content: '正在缓存，禁用删除操作'
            });
            return;
        }
        window.Store.getByHead("a_".concat(this.currentBook.id, "_")).filter(function (v) { return !(type === 'readed' && parseInt(v.split('_')[2]) >= _this.progress.index); }).forEach(function (v) {
            var _a;
            window.Store.del(v);
            (_a = _this.element.querySelector(".article-item[key=\"".concat(v.split('_')[2], "\"]"))) === null || _a === void 0 ? void 0 : _a.classList.remove('cached');
        });
        window.Message.add({
            content: '删除指定缓存完成'
        });
    };
    Catalogue.prototype.cache = function () {
        window.Modal.add({
            content: "\n                <style>\n                    .modal-content .button {\n                        line-height: 60px;\n                        padding: 20px;\n                        width: 40%;\n                        float: left;\n                        margin: 10px;\n                    }\n                </style>\n                <div class=\"button\" onclick=\"Catalogue.doCache(20)\">\u7F13\u5B5820\u7AE0</div>\n                <div class=\"button\" onclick=\"Catalogue.doCache(50)\">\u7F13\u5B5850\u7AE0</div>\n                <div class=\"button\" onclick=\"Catalogue.doCache(100)\">\u7F13\u5B58100\u7AE0</div>\n                <div class=\"button\" onclick=\"Catalogue.doCache(200)\">\u7F13\u5B58200\u7AE0</div>\n                <div class=\"button\" onclick=\"Catalogue.doCache('end')\">\u7F13\u5B58\u672A\u8BFB</div>\n                <div class=\"button\" onclick=\"Catalogue.doCache('all')\">\u7F13\u5B58\u5168\u6587</div>\n                <div class=\"button\" onclick=\"Catalogue.deleteCache('readed')\">\u5220\u9664\u5DF2\u8BFB</div>\n                <div class=\"button\" onclick=\"Catalogue.deleteCache('all')\">\u5220\u9664\u5168\u90E8</div>\n            ",
        });
    };
    return Catalogue;
}());
;
exports.default = Catalogue;

},{"../common/bar/bar":6,"../common/common":8,"../common/pagination/pagination":13}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Api = /** @class */ (function () {
    function Api() {
        this.apiMap = {
            bookshelf: '/getBookshelf',
            catalogue: '/getChapterList',
            article: '/getBookContent',
            save: '/saveBookProgress'
        };
        if (window.Api) {
            throw Error('api has been inited');
        }
        window.Api = this;
        this.url = window.Store.get('url') || '';
    }
    Api.prototype.saveProgress = function (book, progress, cb) {
        this.post(this.url + this.apiMap.save, {
            author: book.author,
            durChapterIndex: progress.index,
            durChapterPos: progress.pos,
            durChapterTime: progress.time,
            durChapterTitle: progress.title,
            name: book.name
        }, {
            success: function (data) {
                cb && cb.success && cb.success(data);
            },
            error: function (err) {
                console.log(err);
                cb && cb.error && cb.error(err);
                window.Message.add({ content: '保存阅读进度到服务端失败' });
            }
        });
    };
    Api.prototype.getArticle = function (url, index, cb) {
        this.get(this.url + this.apiMap.article, { url: url, index: index }, {
            success: function (data) {
                cb && cb.success && cb.success(data);
            },
            error: function (err) {
                console.log(err);
                cb && cb.error && cb.error(err);
                window.Message.add({ content: '获取章节内容失败' });
            }
        });
    };
    Api.prototype.getCatalogue = function (url, cb) {
        this.get(this.url + this.apiMap.catalogue, { url: url }, {
            success: function (data) {
                cb && cb.success && cb.success(data);
            },
            error: function (err) {
                console.log(err);
                cb && cb.error && cb.error(err);
                window.Message.add({ content: '获取目录内容失败' });
            }
        });
    };
    Api.prototype.getBookshelf = function (cb) {
        this.get(this.url + this.apiMap.bookshelf, {}, {
            success: function (data) {
                cb && cb.success && cb.success(data);
            },
            error: function (err) {
                console.log(err);
                cb && cb.error && cb.error(err);
                window.Message.add({ content: '获取书架内容失败' });
            }
        });
    };
    Api.prototype.post = function (url, data, cb) {
        return this.http('POST', url, data, cb);
    };
    Api.prototype.get = function (url, data, cb) {
        return this.http('GET', url, data, cb);
    };
    // get(url: string, data: { [key: string]: any }, cb?: {success?: Function, error?: Function, check?: boolean}) {
    //     if (!this.url && !(cb && cb.check)) {
    //         window.Message.add({content: '当前未配置服务器地址'});
    //         cb && cb.error && cb.error(null);
    //         return;
    //     }
    //     // 创建 XMLHttpRequest，相当于打开浏览器
    //     const xhr = new XMLHttpRequest()
    //     // 打开一个与网址之间的连接   相当于输入网址
    //     // 利用open（）方法，第一个参数是对数据的操作，第二个是接口
    //     xhr.open("GET", `${url}?${Object.keys(data).map(v => `${v}=${data[v]}`).join('&')}`);
    //     // 通过连接发送请求  相当于点击回车或者链接
    //     xhr.send(null);
    //     // 指定 xhr 状态变化事件处理函数   相当于处理网页呈现后的操作
    //     // 全小写
    //     xhr.onreadystatechange = function () {
    //         // 通过readyState的值来判断获取数据的情况
    //         if (this.readyState === 4) {
    //             // 响应体的文本 responseText
    //             let response;
    //             try {
    //                 response = JSON.parse(this.responseText);
    //             } catch(e) {
    //                 response = this.responseText;
    //             }
    //             if (this.status === 200 && response.isSuccess) {
    //                 cb && cb.success && cb.success(response);
    //             } else {
    //                 cb && cb.error && cb.error(response);
    //             }
    //         }
    //     }
    //     return xhr;
    // }
    Api.prototype.http = function (method, url, data, cb) {
        if (!this.url && !(cb && cb.check)) {
            window.Message.add({ content: '当前未配置服务器地址' });
            cb && cb.error && cb.error(null);
            return;
        }
        // 创建 XMLHttpRequest，相当于打开浏览器
        var xhr = new XMLHttpRequest();
        // 打开一个与网址之间的连接   相当于输入网址
        // 利用open（）方法，第一个参数是对数据的操作，第二个是接口
        // xhr.open(method, `${url}?${Object.keys(data).map(v => `${v}=${data[v]}`).join('&')}`);
        var param = Object.keys(data).map(function (v) { return "".concat(v, "=").concat(data[v]); }).join('&');
        xhr.open(method, method === 'GET' ? "".concat(url, "?").concat(param) : url);
        if (method === 'POST') {
            xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
        }
        // 通过连接发送请求  相当于点击回车或者链接
        xhr.send(method === 'GET' ? null : JSON.stringify(data));
        // 指定 xhr 状态变化事件处理函数   相当于处理网页呈现后的操作
        // 全小写
        xhr.onreadystatechange = function () {
            // 通过readyState的值来判断获取数据的情况
            if (this.readyState === 4) {
                // 响应体的文本 responseText
                var response = void 0;
                try {
                    response = JSON.parse(this.responseText);
                }
                catch (e) {
                    response = this.responseText;
                }
                if (this.status === 200 && response.isSuccess) {
                    cb && cb.success && cb.success(response);
                }
                else {
                    cb && cb.error && cb.error(response);
                }
            }
        };
        return xhr;
    };
    Api.prototype.setUrl = function (url) {
        this.url = url;
        window.Store.set('url', url);
    };
    Api.prototype.checkUrl = function (url) {
        var _this = this;
        if (this._checkXHR) {
            this._checkXHR.abort();
        }
        this._checkXHR = this.get(url + this.apiMap.bookshelf, {}, {
            success: function (data) {
                window.Message.add({ content: '服务器地址测试成功' });
                _this.setUrl(url);
            },
            error: function (err) {
                console.log(err);
                window.Message.add({ content: '服务器地址测试失败' });
            },
            check: true
        });
    };
    return Api;
}());
;
exports.default = Api;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Bar = /** @class */ (function () {
    function Bar(config) {
        var _this = this;
        this.element = config.element;
        this.pagination = config.pagination;
        this.percent = 0;
        this.element.innerHTML = "\n                <div class=\"bar-progress\"></div>\n                <div class=\"bar-text\"><span class=\"bar-current\"></span>/<span class=\"bar-total\"></span></div>\n            ";
        var index = this.element.querySelector('.bar-current');
        var total = this.element.querySelector('.bar-total');
        var progress = this.element.querySelector('.bar-progress');
        window.Bind.bindView(index, this.pagination, 'pageIndex', function (value) {
            var v = value + 1;
            _this.percent = v / _this.pagination.pageLimit;
            return v;
        });
        window.Bind.bindView(total, this.pagination, 'pageLimit', function (value) {
            _this.percent = (_this.pagination.pageIndex + 1) / value;
            return value;
        });
        window.Bind.bindStyle(progress, this, 'percent', 'width', function (v) { return "".concat(v * 100, "%"); });
        this.element.onclick = function (event) {
            var width = _this.element.offsetWidth;
            var x = event.pageX;
            var index = Math.floor(_this.pagination.pageLimit * x / width);
            _this.pagination.setPage(index);
        };
    }
    return Bar;
}());
;
exports.default = Bar;

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Bind = /** @class */ (function () {
    function Bind() {
        this.cbMap = {};
        this.objIndex = 0;
        this.objMap = {};
        if (window.Bind) {
            throw Error('bind has been inited');
        }
        window.Bind = this;
    }
    Bind.prototype.handleObj = function (obj, prop) {
        var _this = this;
        if (!obj.hasOwnProperty('_bindId')) {
            obj._bindId = this.objIndex++;
        }
        if (this.cbMap[obj._bindId + prop]) {
            return;
        }
        var index = '_' + prop;
        obj[index] = obj[prop];
        this.cbMap[obj._bindId + prop] = [];
        Object.defineProperty(obj, prop, {
            get: function () {
                return obj[index];
            },
            set: function (value) {
                var temp = obj[index];
                obj[index] = value;
                _this.run(obj, prop, value, temp);
            }
        });
    };
    Bind.prototype.bindInput = function (element, obj, prop) {
        if (!element) {
            throw new Error('element is null');
        }
        this.bind(obj, prop, function (newV, oldV) {
            element.value = newV;
        }, true);
        element.onchange = function (event) {
            obj[prop] = event.target.value;
        };
    };
    Bind.prototype.bindStyle = function (element, obj, prop, target, handle) {
        if (!element) {
            throw new Error('element is null');
        }
        this.bind(obj, prop, function (newV, oldV) {
            element.style[target] = handle ? handle(newV, oldV) : newV;
        }, true);
    };
    Bind.prototype.bindView = function (element, obj, prop, formatter) {
        if (!element) {
            throw new Error('element is null');
        }
        this.bind(obj, prop, function (newV, oldV) {
            element.innerHTML = formatter ? formatter(newV, oldV) : newV;
        }, true);
    };
    Bind.prototype.bind = function (obj, prop, callback, immediately) {
        this.handleObj(obj, prop);
        this.cbMap[obj._bindId + prop].push(callback);
        immediately && callback(obj[prop], undefined);
    };
    Bind.prototype.run = function (obj, prop, newV, oldV) {
        this.cbMap[obj._bindId + prop].forEach(function (callback) {
            try {
                callback(newV, oldV);
            }
            catch (error) {
                throw error;
            }
        });
    };
    return Bind;
}());
;
exports.default = Bind;

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeValueWithNewObj = exports.getObject = exports.getSpecialParent = exports.makeDisplayText = exports.strToDom = void 0;
function strToDom(str) {
    var div = document.createElement('div');
    div.innerHTML = str;
    return div.children;
}
exports.strToDom = strToDom;
function makeDisplayText(time) {
    var text = '测试文本';
    var result = new Array(time + 1).join(text);
    return result;
}
exports.makeDisplayText = makeDisplayText;
function getSpecialParent(ele, checkFun) {
    if (ele && ele !== document && checkFun(ele)) {
        return ele;
    }
    var parent = ele.parentElement || ele.parentNode;
    return parent ? getSpecialParent(parent, checkFun) : null;
}
exports.getSpecialParent = getSpecialParent;
function getObject(source, keys, others) {
    var obj = {};
    keys.forEach(function (key) {
        obj[key] = source[key];
    });
    others && Object.keys(others).forEach(function (key) {
        obj[key] = others[key];
    });
    return obj;
}
exports.getObject = getObject;
function changeValueWithNewObj(obj, target) {
    var result = JSON.parse(JSON.stringify(obj));
    Object.keys(target).forEach(function (v) {
        result[v] = target[v];
    });
    return result;
}
exports.changeValueWithNewObj = changeValueWithNewObj;

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Debugger = /** @class */ (function () {
    function Debugger() {
        window.onerror = function (error) {
            console.error(error);
            window.Modal && window.Modal.add({
                content: error.toString()
            });
        };
    }
    return Debugger;
}());
;
exports.default = Debugger;

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
;
var Layout = /** @class */ (function () {
    function Layout() {
        this.limit = {
            fontSize: 20,
            lineHeight: 24
        };
        this.base = {
            fontSize: 30,
            lineHeight: 40
        };
        if (window.Layout) {
            throw Error('layout has been inited');
        }
        window.Layout = this;
        this.fontSize = parseInt(window.Store.get('fontSize') || this.base.fontSize.toString());
        this.lineHeight = parseInt(window.Store.get('lineHeight') || this.base.lineHeight.toString());
    }
    Layout.prototype.set = function (target, value) {
        this[target] = value || this.base[target];
        window.Store.set(target, this[target].toString());
    };
    Layout.prototype.add = function (target, num) {
        var current = this[target];
        current += num;
        if (current < this.limit[target]) {
            current = this.limit[target];
        }
        this.set(target, current);
    };
    Layout.prototype.reset = function (target) {
        if (target) {
            this.set(target);
            return;
        }
        this.set('fontSize');
        this.set('lineHeight');
    };
    return Layout;
}());
;
exports.default = Layout;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("../common");
;
var MessageItem = /** @class */ (function () {
    function MessageItem(option) {
        var _this = this;
        var str = "\n            <div class=\"message\">\n                <div class=\"message-content\">\n                </div>\n            </div>\n        ";
        var message = (0, common_1.strToDom)(str)[0];
        this.body = message;
        var content = message.querySelector('.message-content');
        content.innerHTML = option.content;
        content.onclick = function () {
            option.onOk && option.onOk();
            _this.remove();
        };
        if (option.banAutoRemove) {
            return;
        }
        window.setTimeout(function () {
            option.onCancle && option.onCancle();
            _this.remove();
        }, 2000);
    }
    MessageItem.prototype.remove = function () {
        var parent = this.body.parentElement;
        parent && parent.removeChild(this.body);
    };
    return MessageItem;
}());
;
var Message = /** @class */ (function () {
    function Message() {
        if (window.Message) {
            throw Error('modal has been inited');
        }
        this.list = [];
        window.Message = this;
        this.element = document.querySelector('.message-box');
    }
    Message.prototype.add = function (option) {
        var item = new MessageItem(option);
        this.list.push(item);
        this.element.appendChild(item.body);
        return item;
    };
    Message.prototype.remove = function (item) {
        item.remove();
        var index = this.list.indexOf(item);
        this.list.splice(index, 1);
    };
    Message.prototype.clear = function () {
        this.list = [];
        this.element.innerHTML = '';
    };
    return Message;
}());
;
exports.default = Message;

},{"../common":8}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("../common");
;
var ModalItem = /** @class */ (function () {
    function ModalItem(option) {
        var _this = this;
        this.zIndex = option.zIndex;
        var str = "\n            <div class=\"modal\" style=\"z-index: ".concat(this.zIndex, ";\">\n                <div class=\"modal-content\">\n                </div>\n                <div class=\"modal-footer\">\n                    <div class=\"button modal-confirm\">\u786E\u5B9A</div>\n                    <div class=\"button modal-cancel\">\u53D6\u6D88</div>\n                </div>\n            </div>\n        ");
        var modal = (0, common_1.strToDom)(str)[0];
        this.body = modal;
        var content = modal.querySelector('.modal-content');
        var btnConfirm = modal.querySelector('.modal-confirm');
        var btnCancel = modal.querySelector('.modal-cancel');
        if (typeof option.content === 'string') {
            content.innerHTML = option.content;
        }
        else {
            content.appendChild(option.content);
        }
        btnCancel.onclick = function () {
            option.onCancel && option.onCancel();
            _this.remove();
        };
        btnConfirm.onclick = function () {
            option.onOk && option.onOk();
            _this.remove();
        };
    }
    ModalItem.prototype.remove = function () {
        var parent = this.body.parentElement;
        parent.removeChild(this.body);
    };
    return ModalItem;
}());
;
var Modal = /** @class */ (function () {
    function Modal() {
        this.list = [];
        if (window.Modal) {
            throw Error('modal has been inited');
        }
        window.Modal = this;
        this.element = document.querySelector('.modal-box');
    }
    Modal.prototype.add = function (option) {
        if (!('zIndex' in option)) {
            var length_1 = this.list.length;
            option.zIndex = (length_1 ? this.list[length_1 - 1].zIndex : 100) + 1;
        }
        var item = new ModalItem(option);
        this.list.push(item);
        this.element.appendChild(item.body);
        return item;
    };
    Modal.prototype.remove = function (item) {
        item.remove();
        var index = this.list.indexOf(item);
        this.list.splice(index, 1);
    };
    Modal.prototype.clear = function () {
        this.list = [];
        this.element.innerHTML = '';
    };
    return Modal;
}());
exports.default = Modal;

},{"../common":8}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Pagination = /** @class */ (function () {
    function Pagination(config) {
        var _this = this;
        this.pageIndex = 0;
        this.pageLimit = 1;
        this.pagePadding = 0;
        this.fakePage = false;
        this.root = config.root;
        this.handleHtml(config.root);
        this.fakePage = config.fake || false;
        this.pageStep = this.box.offsetHeight;
        this.checkPage();
        window.Bind.bindStyle(this.padding, this, 'pagePadding', 'height', function (v) { return "".concat(v, "px"); });
        window.Bind.bind(this, 'pageIndex', function (value) {
            if (_this.fakePage) {
                config === null || config === void 0 ? void 0 : config.pageChange(value);
                return;
            }
            _this.box.scrollTop = _this.pageStep * value;
        });
    }
    Pagination.prototype.handleHtml = function (root) {
        var inner = root.innerHTML;
        root.innerHTML = "\n            <div class=\"pagination-box\">\n                <div class=\"pagination-body\">\n                    <div class=\"pagination-content\"></div>\n                    <div class=\"pagination-padding\"></div>\n                </div>\n            </div>";
        var content = root.querySelector('.pagination-content');
        content.innerHTML = inner;
        this.box = root.querySelector('.pagination-box');
        this.padding = root.querySelector('.pagination-padding');
    };
    Pagination.prototype.checkPage = function (limit) {
        this.pageStep = this.box.offsetHeight;
        if (this.fakePage) {
            this.pageLimit = limit || 1;
            this.pagePadding = 0;
            return;
        }
        this.pageLimit = Math.ceil(this.box.scrollHeight / this.pageStep) || 1;
        this.pagePadding = this.pageStep * this.pageLimit - this.box.scrollHeight;
    };
    Pagination.prototype.setPage = function (num) {
        var target = num;
        if (num < 0) {
            target = 0;
        }
        if (num >= this.pageLimit) {
            target = this.pageLimit - 1;
        }
        this.pageIndex = target;
    };
    Pagination.prototype.pageChange = function (add) {
        this.setPage(this.pageIndex + add);
    };
    return Pagination;
}());
;
exports.default = Pagination;

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Router = /** @class */ (function () {
    function Router(pages) {
        var _this = this;
        this.pages = [];
        this.cbMap = {};
        if (window.Router) {
            throw Error('router has been inited');
        }
        window.Router = this;
        this.pages = pages;
        var func = function (event) {
            var hash = window.location.hash;
            var index = hash.lastIndexOf('#');
            if (index > -1) {
                hash = hash.slice(index + 1);
            }
            if (_this.pages.length === 0) {
                return;
            }
            if (_this.pages.indexOf(hash) === -1) {
                window.location.hash = _this.pages[0];
                return;
            }
            _this.switchPage(hash);
        };
        window.onhashchange = func;
        func();
    }
    Router.prototype.switchPage = function (str) {
        var _a, _b;
        (_a = document.querySelector('.show')) === null || _a === void 0 ? void 0 : _a.classList.remove('show');
        (_b = document.querySelector(".".concat(str))) === null || _b === void 0 ? void 0 : _b.classList.add('show');
        this.current = str;
        this.cbMap[str] && this.cbMap[str]();
    };
    Router.prototype.go = function (target) {
        window.location.hash = target;
    };
    return Router;
}());
exports.default = Router;

},{}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import * as LzString from 'lz-string';
var lz_string_1 = require("lz-string");
// prefix map
// a article
// b book
// c catalogue
// p progress
var Store = /** @class */ (function () {
    function Store() {
        this.limitChecking = false;
        this.limit = 0;
        this.usage = 0;
        this.percent = 0;
        this.compress = lz_string_1.compress;
        this.decompress = lz_string_1.decompress;
        if (window.Store) {
            throw Error('store has been inited');
        }
        window.Store = this;
        this.limit = parseInt(this.get('limit') || '0');
        this.checkUsage();
        if (this.limit === 0) {
            // this.checkLimit();
            window.Message.add({ content: '缓存未初始化请手动检测' });
        }
    }
    Store.prototype.bookDelete = function (book, onlySource) {
        var _this = this;
        if (!onlySource) {
            this.del("p_".concat(book.id));
        }
        this.del("c_".concat(book.id));
        this.getByHead("a_".concat(book.id)).forEach(function (v) { return _this.del(v); });
    };
    Store.prototype.del = function (key) {
        localStorage.removeItem(key);
        this.checkUsage();
    };
    Store.prototype.has = function (key) {
        return localStorage.hasOwnProperty(key);
    };
    Store.prototype.getObj = function (key) {
        return JSON.parse(this.get(key));
    };
    Store.prototype.setObj = function (key, value, cb) {
        this.set(key, JSON.stringify(value), cb);
    };
    Store.prototype.set = function (key, value, cb) {
        try {
            // let ckey = compress(key);
            var cvalue = (0, lz_string_1.compress)(value);
            // localStorage.setItem(ckey, cvalue);
            localStorage.setItem(key, cvalue);
            this.checkUsage();
            cb && cb.success && cb.success();
        }
        catch (e) {
            window.Message.add({ content: '缓存失败，空间不足' });
            cb && cb.fail && cb.fail();
        }
    };
    Store.prototype.get = function (key) {
        // let store = localStorage.getItem(compress(key));
        var store = localStorage.getItem(key);
        if (store) {
            return (0, lz_string_1.decompress)(store);
        }
        return null;
    };
    Store.prototype.getByHead = function (head) {
        return Object.keys(localStorage).filter(function (v) { return v.indexOf(head) === 0; });
    };
    Store.prototype.checkUsage = function () {
        var _this = this;
        if (this.checkFlag) {
            window.clearTimeout(this.checkFlag);
        }
        this.checkFlag = window.setTimeout(function () {
            _this.usage = Object.keys(localStorage).map(function (v) { return v + localStorage.getItem(v); }).join('').length;
            _this.percent = _this.limit ? Math.round(_this.usage / (_this.limit) * 100) : 0;
            if (_this.percent > 95) {
                window.Message.add({
                    content: "\u7F13\u5B58\u5DF2\u4F7F\u7528".concat(_this.percent, "%\uFF0C\u8BF7\u6CE8\u610F")
                });
            }
        }, 500);
    };
    Store.prototype.checkLimit = function () {
        var _this = this;
        window.Message.add({ content: '正在检测缓存容量' });
        if (this.limitChecking) {
            return;
        }
        this.limitChecking = true;
        window.setTimeout(function () {
            var base = _this.usage;
            var addLength = 1000000;
            var index = 0;
            while (addLength > 2) {
                try {
                    var key = "_test".concat(index++);
                    if (addLength < key.length) {
                        break;
                    }
                    localStorage.setItem(key, new Array(addLength - key.length + 1).join('a'));
                    base += addLength;
                }
                catch (e) {
                    console.log(e);
                    index--;
                    addLength = Math.round(addLength / 2);
                }
            }
            _this.limit = base;
            _this.getByHead('_test').forEach(function (v) {
                _this.del(v);
            });
            _this.set('limit', _this.limit.toString());
            _this.limitChecking = false;
            window.Message.add({ content: '检测完成' });
        }, 1000);
    };
    return Store;
}());
;
exports.default = Store;

},{"lz-string":1}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("../common/common");
var Config = /** @class */ (function () {
    function Config() {
        this.element = document.querySelector('.page.config');
        this.url = window.Api.url;
        this.displayText = (0, common_1.makeDisplayText)(200);
        window.Bind.bindInput(this.element.querySelector('.url input'), this, 'url');
        window.Bind.bindView(this.element.querySelector('.store-usage'), window.Store, 'usage');
        window.Bind.bindView(this.element.querySelector('.store-total'), window.Store, 'limit');
        window.Bind.bindView(this.element.querySelector('.store-percent'), window.Store, 'percent', function (v) { return "  ( ".concat(v, "% )"); });
        window.Bind.bindView(this.element.querySelector('.font-size'), window.Layout, 'fontSize');
        window.Bind.bindView(this.element.querySelector('.line-height'), window.Layout, 'lineHeight');
        var display = this.element.querySelector('.display .text p');
        window.Bind.bindView(display, this, 'displayText');
        window.Bind.bindStyle(display, window.Layout, 'fontSize', 'fontSize', function (v) { return "".concat(v, "px"); });
        window.Bind.bindStyle(display, window.Layout, 'lineHeight', 'lineHeight', function (v) { return "".concat(v, "px"); });
        if (!this.url) {
            window.Message.add({ content: '当前未配置服务器地址' });
        }
        else {
            this.checkUrl();
        }
    }
    Config.prototype.checkUrl = function () {
        window.Api.checkUrl(this.url);
    };
    return Config;
}());
;
exports.default = Config;

},{"../common/common":8}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bookshelf_1 = require("./bookshelf/bookshelf");
var config_1 = require("./config/config");
var router_1 = require("./common/router/router");
var debugger_1 = require("./common/debugger/debugger");
var modal_1 = require("./common/modal/modal");
var message_1 = require("./common/message/message");
var store_1 = require("./common/store/store");
var bind_1 = require("./common/bind/bind");
var layout_1 = require("./common/layout/layout");
var api_1 = require("./common/api/api");
var article_1 = require("./article/article");
var catalogue_1 = require("./catalogue/catalogue");
var pages = ['config', 'bookshelf', 'article', 'catalogue'];
function init() {
    new debugger_1.default();
    new bind_1.default();
    new modal_1.default();
    new message_1.default();
    new router_1.default(pages);
    new store_1.default();
    new layout_1.default();
    new api_1.default();
    document.querySelector('.global-style').innerHTML = "\n        <style>\n            .page .content {\n                height: ".concat(document.body.offsetHeight - 230, "px;\n            }\n        </style>\n    ");
    window.Config = new config_1.default();
    window.BookShelf = new bookshelf_1.default();
    window.Catalogue = new catalogue_1.default();
    window.Article = new article_1.default();
}
window.init = init;
window.ondblclick = function (event) {
    event.preventDefault();
};

},{"./article/article":2,"./bookshelf/bookshelf":3,"./catalogue/catalogue":4,"./common/api/api":5,"./common/bind/bind":7,"./common/debugger/debugger":9,"./common/layout/layout":10,"./common/message/message":11,"./common/modal/modal":12,"./common/router/router":14,"./common/store/store":15,"./config/config":16}]},{},[17])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy8ucG5wbS9yZWdpc3RyeS5ucG1taXJyb3IuY29tK2Jyb3dzZXItcGFja0A2LjEuMC9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3JlZ2lzdHJ5Lm5wbW1pcnJvci5jb20rbHotc3RyaW5nQDEuNS4wL25vZGVfbW9kdWxlcy9sei1zdHJpbmcvbGlicy9sei1zdHJpbmcuanMiLCJzcmMvYXJ0aWNsZS9hcnRpY2xlLnRzIiwic3JjL2Jvb2tzaGVsZi9ib29rc2hlbGYudHMiLCJzcmMvY2F0YWxvZ3VlL2NhdGFsb2d1ZS50cyIsInNyYy9jb21tb24vYXBpL2FwaS50cyIsInNyYy9jb21tb24vYmFyL2Jhci50cyIsInNyYy9jb21tb24vYmluZC9iaW5kLnRzIiwic3JjL2NvbW1vbi9jb21tb24udHMiLCJzcmMvY29tbW9uL2RlYnVnZ2VyL2RlYnVnZ2VyLnRzIiwic3JjL2NvbW1vbi9sYXlvdXQvbGF5b3V0LnRzIiwic3JjL2NvbW1vbi9tZXNzYWdlL21lc3NhZ2UudHMiLCJzcmMvY29tbW9uL21vZGFsL21vZGFsLnRzIiwic3JjL2NvbW1vbi9wYWdpbmF0aW9uL3BhZ2luYXRpb24udHMiLCJzcmMvY29tbW9uL3JvdXRlci9yb3V0ZXIudHMiLCJzcmMvY29tbW9uL3N0b3JlL3N0b3JlLnRzIiwic3JjL2NvbmZpZy9jb25maWcudHMiLCJzcmMvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUM7SUFFYixJQUFJLGFBQUcsRUFBRSxDQUFDO0lBRVYsUUFBUSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxTQUFTLEdBQUcsbUZBRzlCLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsK0NBR3JELENBQUM7SUFFRixNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksZ0JBQU0sRUFBRSxDQUFDO0lBRTdCLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxtQkFBUyxFQUFFLENBQUM7SUFFbkMsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLG1CQUFTLEVBQUUsQ0FBQztJQUVuQyxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksaUJBQU8sRUFBRSxDQUFDO0FBRW5DLENBQUM7QUFFRCxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUluQixNQUFNLENBQUMsVUFBVSxHQUFHLFVBQVMsS0FBWTtJQUNyQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7QUFDM0IsQ0FBQyxDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLy8gQ29weXJpZ2h0IChjKSAyMDEzIFBpZXJveHkgPHBpZXJveHlAcGllcm94eS5uZXQ+XG4vLyBUaGlzIHdvcmsgaXMgZnJlZS4gWW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdFxuLy8gdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBXVEZQTCwgVmVyc2lvbiAyXG4vLyBGb3IgbW9yZSBpbmZvcm1hdGlvbiBzZWUgTElDRU5TRS50eHQgb3IgaHR0cDovL3d3dy53dGZwbC5uZXQvXG4vL1xuLy8gRm9yIG1vcmUgaW5mb3JtYXRpb24sIHRoZSBob21lIHBhZ2U6XG4vLyBodHRwOi8vcGllcm94eS5uZXQvYmxvZy9wYWdlcy9sei1zdHJpbmcvdGVzdGluZy5odG1sXG4vL1xuLy8gTFotYmFzZWQgY29tcHJlc3Npb24gYWxnb3JpdGhtLCB2ZXJzaW9uIDEuNC41XG52YXIgTFpTdHJpbmcgPSAoZnVuY3Rpb24oKSB7XG5cbi8vIHByaXZhdGUgcHJvcGVydHlcbnZhciBmID0gU3RyaW5nLmZyb21DaGFyQ29kZTtcbnZhciBrZXlTdHJCYXNlNjQgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89XCI7XG52YXIga2V5U3RyVXJpU2FmZSA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLSRcIjtcbnZhciBiYXNlUmV2ZXJzZURpYyA9IHt9O1xuXG5mdW5jdGlvbiBnZXRCYXNlVmFsdWUoYWxwaGFiZXQsIGNoYXJhY3Rlcikge1xuICBpZiAoIWJhc2VSZXZlcnNlRGljW2FscGhhYmV0XSkge1xuICAgIGJhc2VSZXZlcnNlRGljW2FscGhhYmV0XSA9IHt9O1xuICAgIGZvciAodmFyIGk9MCA7IGk8YWxwaGFiZXQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICBiYXNlUmV2ZXJzZURpY1thbHBoYWJldF1bYWxwaGFiZXQuY2hhckF0KGkpXSA9IGk7XG4gICAgfVxuICB9XG4gIHJldHVybiBiYXNlUmV2ZXJzZURpY1thbHBoYWJldF1bY2hhcmFjdGVyXTtcbn1cblxudmFyIExaU3RyaW5nID0ge1xuICBjb21wcmVzc1RvQmFzZTY0IDogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIHZhciByZXMgPSBMWlN0cmluZy5fY29tcHJlc3MoaW5wdXQsIDYsIGZ1bmN0aW9uKGEpe3JldHVybiBrZXlTdHJCYXNlNjQuY2hhckF0KGEpO30pO1xuICAgIHN3aXRjaCAocmVzLmxlbmd0aCAlIDQpIHsgLy8gVG8gcHJvZHVjZSB2YWxpZCBCYXNlNjRcbiAgICBkZWZhdWx0OiAvLyBXaGVuIGNvdWxkIHRoaXMgaGFwcGVuID9cbiAgICBjYXNlIDAgOiByZXR1cm4gcmVzO1xuICAgIGNhc2UgMSA6IHJldHVybiByZXMrXCI9PT1cIjtcbiAgICBjYXNlIDIgOiByZXR1cm4gcmVzK1wiPT1cIjtcbiAgICBjYXNlIDMgOiByZXR1cm4gcmVzK1wiPVwiO1xuICAgIH1cbiAgfSxcblxuICBkZWNvbXByZXNzRnJvbUJhc2U2NCA6IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gXCJcIjtcbiAgICBpZiAoaW5wdXQgPT0gXCJcIikgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIExaU3RyaW5nLl9kZWNvbXByZXNzKGlucHV0Lmxlbmd0aCwgMzIsIGZ1bmN0aW9uKGluZGV4KSB7IHJldHVybiBnZXRCYXNlVmFsdWUoa2V5U3RyQmFzZTY0LCBpbnB1dC5jaGFyQXQoaW5kZXgpKTsgfSk7XG4gIH0sXG5cbiAgY29tcHJlc3NUb1VURjE2IDogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIHJldHVybiBMWlN0cmluZy5fY29tcHJlc3MoaW5wdXQsIDE1LCBmdW5jdGlvbihhKXtyZXR1cm4gZihhKzMyKTt9KSArIFwiIFwiO1xuICB9LFxuXG4gIGRlY29tcHJlc3NGcm9tVVRGMTY6IGZ1bmN0aW9uIChjb21wcmVzc2VkKSB7XG4gICAgaWYgKGNvbXByZXNzZWQgPT0gbnVsbCkgcmV0dXJuIFwiXCI7XG4gICAgaWYgKGNvbXByZXNzZWQgPT0gXCJcIikgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIExaU3RyaW5nLl9kZWNvbXByZXNzKGNvbXByZXNzZWQubGVuZ3RoLCAxNjM4NCwgZnVuY3Rpb24oaW5kZXgpIHsgcmV0dXJuIGNvbXByZXNzZWQuY2hhckNvZGVBdChpbmRleCkgLSAzMjsgfSk7XG4gIH0sXG5cbiAgLy9jb21wcmVzcyBpbnRvIHVpbnQ4YXJyYXkgKFVDUy0yIGJpZyBlbmRpYW4gZm9ybWF0KVxuICBjb21wcmVzc1RvVWludDhBcnJheTogZnVuY3Rpb24gKHVuY29tcHJlc3NlZCkge1xuICAgIHZhciBjb21wcmVzc2VkID0gTFpTdHJpbmcuY29tcHJlc3ModW5jb21wcmVzc2VkKTtcbiAgICB2YXIgYnVmPW5ldyBVaW50OEFycmF5KGNvbXByZXNzZWQubGVuZ3RoKjIpOyAvLyAyIGJ5dGVzIHBlciBjaGFyYWN0ZXJcblxuICAgIGZvciAodmFyIGk9MCwgVG90YWxMZW49Y29tcHJlc3NlZC5sZW5ndGg7IGk8VG90YWxMZW47IGkrKykge1xuICAgICAgdmFyIGN1cnJlbnRfdmFsdWUgPSBjb21wcmVzc2VkLmNoYXJDb2RlQXQoaSk7XG4gICAgICBidWZbaSoyXSA9IGN1cnJlbnRfdmFsdWUgPj4+IDg7XG4gICAgICBidWZbaSoyKzFdID0gY3VycmVudF92YWx1ZSAlIDI1NjtcbiAgICB9XG4gICAgcmV0dXJuIGJ1ZjtcbiAgfSxcblxuICAvL2RlY29tcHJlc3MgZnJvbSB1aW50OGFycmF5IChVQ1MtMiBiaWcgZW5kaWFuIGZvcm1hdClcbiAgZGVjb21wcmVzc0Zyb21VaW50OEFycmF5OmZ1bmN0aW9uIChjb21wcmVzc2VkKSB7XG4gICAgaWYgKGNvbXByZXNzZWQ9PT1udWxsIHx8IGNvbXByZXNzZWQ9PT11bmRlZmluZWQpe1xuICAgICAgICByZXR1cm4gTFpTdHJpbmcuZGVjb21wcmVzcyhjb21wcmVzc2VkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYnVmPW5ldyBBcnJheShjb21wcmVzc2VkLmxlbmd0aC8yKTsgLy8gMiBieXRlcyBwZXIgY2hhcmFjdGVyXG4gICAgICAgIGZvciAodmFyIGk9MCwgVG90YWxMZW49YnVmLmxlbmd0aDsgaTxUb3RhbExlbjsgaSsrKSB7XG4gICAgICAgICAgYnVmW2ldPWNvbXByZXNzZWRbaSoyXSoyNTYrY29tcHJlc3NlZFtpKjIrMV07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIGJ1Zi5mb3JFYWNoKGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goZihjKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gTFpTdHJpbmcuZGVjb21wcmVzcyhyZXN1bHQuam9pbignJykpO1xuXG4gICAgfVxuXG4gIH0sXG5cblxuICAvL2NvbXByZXNzIGludG8gYSBzdHJpbmcgdGhhdCBpcyBhbHJlYWR5IFVSSSBlbmNvZGVkXG4gIGNvbXByZXNzVG9FbmNvZGVkVVJJQ29tcG9uZW50OiBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIFwiXCI7XG4gICAgcmV0dXJuIExaU3RyaW5nLl9jb21wcmVzcyhpbnB1dCwgNiwgZnVuY3Rpb24oYSl7cmV0dXJuIGtleVN0clVyaVNhZmUuY2hhckF0KGEpO30pO1xuICB9LFxuXG4gIC8vZGVjb21wcmVzcyBmcm9tIGFuIG91dHB1dCBvZiBjb21wcmVzc1RvRW5jb2RlZFVSSUNvbXBvbmVudFxuICBkZWNvbXByZXNzRnJvbUVuY29kZWRVUklDb21wb25lbnQ6ZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIGlmIChpbnB1dCA9PSBcIlwiKSByZXR1cm4gbnVsbDtcbiAgICBpbnB1dCA9IGlucHV0LnJlcGxhY2UoLyAvZywgXCIrXCIpO1xuICAgIHJldHVybiBMWlN0cmluZy5fZGVjb21wcmVzcyhpbnB1dC5sZW5ndGgsIDMyLCBmdW5jdGlvbihpbmRleCkgeyByZXR1cm4gZ2V0QmFzZVZhbHVlKGtleVN0clVyaVNhZmUsIGlucHV0LmNoYXJBdChpbmRleCkpOyB9KTtcbiAgfSxcblxuICBjb21wcmVzczogZnVuY3Rpb24gKHVuY29tcHJlc3NlZCkge1xuICAgIHJldHVybiBMWlN0cmluZy5fY29tcHJlc3ModW5jb21wcmVzc2VkLCAxNiwgZnVuY3Rpb24oYSl7cmV0dXJuIGYoYSk7fSk7XG4gIH0sXG4gIF9jb21wcmVzczogZnVuY3Rpb24gKHVuY29tcHJlc3NlZCwgYml0c1BlckNoYXIsIGdldENoYXJGcm9tSW50KSB7XG4gICAgaWYgKHVuY29tcHJlc3NlZCA9PSBudWxsKSByZXR1cm4gXCJcIjtcbiAgICB2YXIgaSwgdmFsdWUsXG4gICAgICAgIGNvbnRleHRfZGljdGlvbmFyeT0ge30sXG4gICAgICAgIGNvbnRleHRfZGljdGlvbmFyeVRvQ3JlYXRlPSB7fSxcbiAgICAgICAgY29udGV4dF9jPVwiXCIsXG4gICAgICAgIGNvbnRleHRfd2M9XCJcIixcbiAgICAgICAgY29udGV4dF93PVwiXCIsXG4gICAgICAgIGNvbnRleHRfZW5sYXJnZUluPSAyLCAvLyBDb21wZW5zYXRlIGZvciB0aGUgZmlyc3QgZW50cnkgd2hpY2ggc2hvdWxkIG5vdCBjb3VudFxuICAgICAgICBjb250ZXh0X2RpY3RTaXplPSAzLFxuICAgICAgICBjb250ZXh0X251bUJpdHM9IDIsXG4gICAgICAgIGNvbnRleHRfZGF0YT1bXSxcbiAgICAgICAgY29udGV4dF9kYXRhX3ZhbD0wLFxuICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb249MCxcbiAgICAgICAgaWk7XG5cbiAgICBmb3IgKGlpID0gMDsgaWkgPCB1bmNvbXByZXNzZWQubGVuZ3RoOyBpaSArPSAxKSB7XG4gICAgICBjb250ZXh0X2MgPSB1bmNvbXByZXNzZWQuY2hhckF0KGlpKTtcbiAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbnRleHRfZGljdGlvbmFyeSxjb250ZXh0X2MpKSB7XG4gICAgICAgIGNvbnRleHRfZGljdGlvbmFyeVtjb250ZXh0X2NdID0gY29udGV4dF9kaWN0U2l6ZSsrO1xuICAgICAgICBjb250ZXh0X2RpY3Rpb25hcnlUb0NyZWF0ZVtjb250ZXh0X2NdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY29udGV4dF93YyA9IGNvbnRleHRfdyArIGNvbnRleHRfYztcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29udGV4dF9kaWN0aW9uYXJ5LGNvbnRleHRfd2MpKSB7XG4gICAgICAgIGNvbnRleHRfdyA9IGNvbnRleHRfd2M7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbnRleHRfZGljdGlvbmFyeVRvQ3JlYXRlLGNvbnRleHRfdykpIHtcbiAgICAgICAgICBpZiAoY29udGV4dF93LmNoYXJDb2RlQXQoMCk8MjU2KSB7XG4gICAgICAgICAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAoY29udGV4dF9kYXRhX3ZhbCA8PCAxKTtcbiAgICAgICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0gY29udGV4dF93LmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgICBmb3IgKGk9MCA7IGk8OCA7IGkrKykge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgPj4gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFsdWUgPSAxO1xuICAgICAgICAgICAgZm9yIChpPTAgOyBpPGNvbnRleHRfbnVtQml0cyA7IGkrKykge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCB2YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PWJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGNvbnRleHRfdy5jaGFyQ29kZUF0KDApO1xuICAgICAgICAgICAgZm9yIChpPTAgOyBpPDE2IDsgaSsrKSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAoY29udGV4dF9kYXRhX3ZhbCA8PCAxKSB8ICh2YWx1ZSYxKTtcbiAgICAgICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250ZXh0X2VubGFyZ2VJbi0tO1xuICAgICAgICAgIGlmIChjb250ZXh0X2VubGFyZ2VJbiA9PSAwKSB7XG4gICAgICAgICAgICBjb250ZXh0X2VubGFyZ2VJbiA9IE1hdGgucG93KDIsIGNvbnRleHRfbnVtQml0cyk7XG4gICAgICAgICAgICBjb250ZXh0X251bUJpdHMrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVsZXRlIGNvbnRleHRfZGljdGlvbmFyeVRvQ3JlYXRlW2NvbnRleHRfd107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSBjb250ZXh0X2RpY3Rpb25hcnlbY29udGV4dF93XTtcbiAgICAgICAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgICAgICAgIH1cblxuXG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dF9lbmxhcmdlSW4tLTtcbiAgICAgICAgaWYgKGNvbnRleHRfZW5sYXJnZUluID09IDApIHtcbiAgICAgICAgICBjb250ZXh0X2VubGFyZ2VJbiA9IE1hdGgucG93KDIsIGNvbnRleHRfbnVtQml0cyk7XG4gICAgICAgICAgY29udGV4dF9udW1CaXRzKys7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWRkIHdjIHRvIHRoZSBkaWN0aW9uYXJ5LlxuICAgICAgICBjb250ZXh0X2RpY3Rpb25hcnlbY29udGV4dF93Y10gPSBjb250ZXh0X2RpY3RTaXplKys7XG4gICAgICAgIGNvbnRleHRfdyA9IFN0cmluZyhjb250ZXh0X2MpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE91dHB1dCB0aGUgY29kZSBmb3Igdy5cbiAgICBpZiAoY29udGV4dF93ICE9PSBcIlwiKSB7XG4gICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbnRleHRfZGljdGlvbmFyeVRvQ3JlYXRlLGNvbnRleHRfdykpIHtcbiAgICAgICAgaWYgKGNvbnRleHRfdy5jaGFyQ29kZUF0KDApPDI1Nikge1xuICAgICAgICAgIGZvciAoaT0wIDsgaTxjb250ZXh0X251bUJpdHMgOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAoY29udGV4dF9kYXRhX3ZhbCA8PCAxKTtcbiAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhbHVlID0gY29udGV4dF93LmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgZm9yIChpPTAgOyBpPDggOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAoY29udGV4dF9kYXRhX3ZhbCA8PCAxKSB8ICh2YWx1ZSYxKTtcbiAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlID4+IDE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gMTtcbiAgICAgICAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCB2YWx1ZTtcbiAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhbHVlID0gY29udGV4dF93LmNoYXJDb2RlQXQoMCk7XG4gICAgICAgICAgZm9yIChpPTAgOyBpPDE2IDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb250ZXh0X2VubGFyZ2VJbi0tO1xuICAgICAgICBpZiAoY29udGV4dF9lbmxhcmdlSW4gPT0gMCkge1xuICAgICAgICAgIGNvbnRleHRfZW5sYXJnZUluID0gTWF0aC5wb3coMiwgY29udGV4dF9udW1CaXRzKTtcbiAgICAgICAgICBjb250ZXh0X251bUJpdHMrKztcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgY29udGV4dF9kaWN0aW9uYXJ5VG9DcmVhdGVbY29udGV4dF93XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gY29udGV4dF9kaWN0aW9uYXJ5W2NvbnRleHRfd107XG4gICAgICAgIGZvciAoaT0wIDsgaTxjb250ZXh0X251bUJpdHMgOyBpKyspIHtcbiAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YWx1ZSA9IHZhbHVlID4+IDE7XG4gICAgICAgIH1cblxuXG4gICAgICB9XG4gICAgICBjb250ZXh0X2VubGFyZ2VJbi0tO1xuICAgICAgaWYgKGNvbnRleHRfZW5sYXJnZUluID09IDApIHtcbiAgICAgICAgY29udGV4dF9lbmxhcmdlSW4gPSBNYXRoLnBvdygyLCBjb250ZXh0X251bUJpdHMpO1xuICAgICAgICBjb250ZXh0X251bUJpdHMrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXJrIHRoZSBlbmQgb2YgdGhlIHN0cmVhbVxuICAgIHZhbHVlID0gMjtcbiAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgfVxuICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgIH1cblxuICAgIC8vIEZsdXNoIHRoZSBsYXN0IGNoYXJcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpO1xuICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBlbHNlIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgIH1cbiAgICByZXR1cm4gY29udGV4dF9kYXRhLmpvaW4oJycpO1xuICB9LFxuXG4gIGRlY29tcHJlc3M6IGZ1bmN0aW9uIChjb21wcmVzc2VkKSB7XG4gICAgaWYgKGNvbXByZXNzZWQgPT0gbnVsbCkgcmV0dXJuIFwiXCI7XG4gICAgaWYgKGNvbXByZXNzZWQgPT0gXCJcIikgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIExaU3RyaW5nLl9kZWNvbXByZXNzKGNvbXByZXNzZWQubGVuZ3RoLCAzMjc2OCwgZnVuY3Rpb24oaW5kZXgpIHsgcmV0dXJuIGNvbXByZXNzZWQuY2hhckNvZGVBdChpbmRleCk7IH0pO1xuICB9LFxuXG4gIF9kZWNvbXByZXNzOiBmdW5jdGlvbiAobGVuZ3RoLCByZXNldFZhbHVlLCBnZXROZXh0VmFsdWUpIHtcbiAgICB2YXIgZGljdGlvbmFyeSA9IFtdLFxuICAgICAgICBuZXh0LFxuICAgICAgICBlbmxhcmdlSW4gPSA0LFxuICAgICAgICBkaWN0U2l6ZSA9IDQsXG4gICAgICAgIG51bUJpdHMgPSAzLFxuICAgICAgICBlbnRyeSA9IFwiXCIsXG4gICAgICAgIHJlc3VsdCA9IFtdLFxuICAgICAgICBpLFxuICAgICAgICB3LFxuICAgICAgICBiaXRzLCByZXNiLCBtYXhwb3dlciwgcG93ZXIsXG4gICAgICAgIGMsXG4gICAgICAgIGRhdGEgPSB7dmFsOmdldE5leHRWYWx1ZSgwKSwgcG9zaXRpb246cmVzZXRWYWx1ZSwgaW5kZXg6MX07XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSArPSAxKSB7XG4gICAgICBkaWN0aW9uYXJ5W2ldID0gaTtcbiAgICB9XG5cbiAgICBiaXRzID0gMDtcbiAgICBtYXhwb3dlciA9IE1hdGgucG93KDIsMik7XG4gICAgcG93ZXI9MTtcbiAgICB3aGlsZSAocG93ZXIhPW1heHBvd2VyKSB7XG4gICAgICByZXNiID0gZGF0YS52YWwgJiBkYXRhLnBvc2l0aW9uO1xuICAgICAgZGF0YS5wb3NpdGlvbiA+Pj0gMTtcbiAgICAgIGlmIChkYXRhLnBvc2l0aW9uID09IDApIHtcbiAgICAgICAgZGF0YS5wb3NpdGlvbiA9IHJlc2V0VmFsdWU7XG4gICAgICAgIGRhdGEudmFsID0gZ2V0TmV4dFZhbHVlKGRhdGEuaW5kZXgrKyk7XG4gICAgICB9XG4gICAgICBiaXRzIHw9IChyZXNiPjAgPyAxIDogMCkgKiBwb3dlcjtcbiAgICAgIHBvd2VyIDw8PSAxO1xuICAgIH1cblxuICAgIHN3aXRjaCAobmV4dCA9IGJpdHMpIHtcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICBtYXhwb3dlciA9IE1hdGgucG93KDIsOCk7XG4gICAgICAgICAgcG93ZXI9MTtcbiAgICAgICAgICB3aGlsZSAocG93ZXIhPW1heHBvd2VyKSB7XG4gICAgICAgICAgICByZXNiID0gZGF0YS52YWwgJiBkYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA+Pj0gMTtcbiAgICAgICAgICAgIGlmIChkYXRhLnBvc2l0aW9uID09IDApIHtcbiAgICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA9IHJlc2V0VmFsdWU7XG4gICAgICAgICAgICAgIGRhdGEudmFsID0gZ2V0TmV4dFZhbHVlKGRhdGEuaW5kZXgrKyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiaXRzIHw9IChyZXNiPjAgPyAxIDogMCkgKiBwb3dlcjtcbiAgICAgICAgICAgIHBvd2VyIDw8PSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgYyA9IGYoYml0cyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxOlxuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIG1heHBvd2VyID0gTWF0aC5wb3coMiwxNik7XG4gICAgICAgICAgcG93ZXI9MTtcbiAgICAgICAgICB3aGlsZSAocG93ZXIhPW1heHBvd2VyKSB7XG4gICAgICAgICAgICByZXNiID0gZGF0YS52YWwgJiBkYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA+Pj0gMTtcbiAgICAgICAgICAgIGlmIChkYXRhLnBvc2l0aW9uID09IDApIHtcbiAgICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA9IHJlc2V0VmFsdWU7XG4gICAgICAgICAgICAgIGRhdGEudmFsID0gZ2V0TmV4dFZhbHVlKGRhdGEuaW5kZXgrKyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiaXRzIHw9IChyZXNiPjAgPyAxIDogMCkgKiBwb3dlcjtcbiAgICAgICAgICAgIHBvd2VyIDw8PSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgYyA9IGYoYml0cyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG4gICAgZGljdGlvbmFyeVszXSA9IGM7XG4gICAgdyA9IGM7XG4gICAgcmVzdWx0LnB1c2goYyk7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChkYXRhLmluZGV4ID4gbGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgfVxuXG4gICAgICBiaXRzID0gMDtcbiAgICAgIG1heHBvd2VyID0gTWF0aC5wb3coMixudW1CaXRzKTtcbiAgICAgIHBvd2VyPTE7XG4gICAgICB3aGlsZSAocG93ZXIhPW1heHBvd2VyKSB7XG4gICAgICAgIHJlc2IgPSBkYXRhLnZhbCAmIGRhdGEucG9zaXRpb247XG4gICAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICAgIGlmIChkYXRhLnBvc2l0aW9uID09IDApIHtcbiAgICAgICAgICBkYXRhLnBvc2l0aW9uID0gcmVzZXRWYWx1ZTtcbiAgICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgICB9XG4gICAgICAgIGJpdHMgfD0gKHJlc2I+MCA/IDEgOiAwKSAqIHBvd2VyO1xuICAgICAgICBwb3dlciA8PD0gMTtcbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChjID0gYml0cykge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgbWF4cG93ZXIgPSBNYXRoLnBvdygyLDgpO1xuICAgICAgICAgIHBvd2VyPTE7XG4gICAgICAgICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgICAgICAgcmVzYiA9IGRhdGEudmFsICYgZGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICAgICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPSByZXNldFZhbHVlO1xuICAgICAgICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYml0cyB8PSAocmVzYj4wID8gMSA6IDApICogcG93ZXI7XG4gICAgICAgICAgICBwb3dlciA8PD0gMTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBkaWN0aW9uYXJ5W2RpY3RTaXplKytdID0gZihiaXRzKTtcbiAgICAgICAgICBjID0gZGljdFNpemUtMTtcbiAgICAgICAgICBlbmxhcmdlSW4tLTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIG1heHBvd2VyID0gTWF0aC5wb3coMiwxNik7XG4gICAgICAgICAgcG93ZXI9MTtcbiAgICAgICAgICB3aGlsZSAocG93ZXIhPW1heHBvd2VyKSB7XG4gICAgICAgICAgICByZXNiID0gZGF0YS52YWwgJiBkYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA+Pj0gMTtcbiAgICAgICAgICAgIGlmIChkYXRhLnBvc2l0aW9uID09IDApIHtcbiAgICAgICAgICAgICAgZGF0YS5wb3NpdGlvbiA9IHJlc2V0VmFsdWU7XG4gICAgICAgICAgICAgIGRhdGEudmFsID0gZ2V0TmV4dFZhbHVlKGRhdGEuaW5kZXgrKyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiaXRzIHw9IChyZXNiPjAgPyAxIDogMCkgKiBwb3dlcjtcbiAgICAgICAgICAgIHBvd2VyIDw8PSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkaWN0aW9uYXJ5W2RpY3RTaXplKytdID0gZihiaXRzKTtcbiAgICAgICAgICBjID0gZGljdFNpemUtMTtcbiAgICAgICAgICBlbmxhcmdlSW4tLTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHJldHVybiByZXN1bHQuam9pbignJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbmxhcmdlSW4gPT0gMCkge1xuICAgICAgICBlbmxhcmdlSW4gPSBNYXRoLnBvdygyLCBudW1CaXRzKTtcbiAgICAgICAgbnVtQml0cysrO1xuICAgICAgfVxuXG4gICAgICBpZiAoZGljdGlvbmFyeVtjXSkge1xuICAgICAgICBlbnRyeSA9IGRpY3Rpb25hcnlbY107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYyA9PT0gZGljdFNpemUpIHtcbiAgICAgICAgICBlbnRyeSA9IHcgKyB3LmNoYXJBdCgwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVzdWx0LnB1c2goZW50cnkpO1xuXG4gICAgICAvLyBBZGQgdytlbnRyeVswXSB0byB0aGUgZGljdGlvbmFyeS5cbiAgICAgIGRpY3Rpb25hcnlbZGljdFNpemUrK10gPSB3ICsgZW50cnkuY2hhckF0KDApO1xuICAgICAgZW5sYXJnZUluLS07XG5cbiAgICAgIHcgPSBlbnRyeTtcblxuICAgICAgaWYgKGVubGFyZ2VJbiA9PSAwKSB7XG4gICAgICAgIGVubGFyZ2VJbiA9IE1hdGgucG93KDIsIG51bUJpdHMpO1xuICAgICAgICBudW1CaXRzKys7XG4gICAgICB9XG5cbiAgICB9XG4gIH1cbn07XG4gIHJldHVybiBMWlN0cmluZztcbn0pKCk7XG5cbmlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIExaU3RyaW5nOyB9KTtcbn0gZWxzZSBpZiggdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlICE9IG51bGwgKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gTFpTdHJpbmdcbn0gZWxzZSBpZiggdHlwZW9mIGFuZ3VsYXIgIT09ICd1bmRlZmluZWQnICYmIGFuZ3VsYXIgIT0gbnVsbCApIHtcbiAgYW5ndWxhci5tb2R1bGUoJ0xaU3RyaW5nJywgW10pXG4gIC5mYWN0b3J5KCdMWlN0cmluZycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTFpTdHJpbmc7XG4gIH0pO1xufVxuIiwiaW1wb3J0IENhdGFsb2d1ZSBmcm9tIFwiLi4vY2F0YWxvZ3VlL2NhdGFsb2d1ZVwiO1xyXG5pbXBvcnQgQmFyIGZyb20gXCIuLi9jb21tb24vYmFyL2JhclwiO1xyXG5pbXBvcnQgeyBCb29rLCBDYXRhbG9ndWVJdGVtLCBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmosIFByb2dyZXNzIH0gZnJvbSBcIi4uL2NvbW1vbi9jb21tb25cIjtcclxuaW1wb3J0IFBhZ2luYXRpb24gZnJvbSBcIi4uL2NvbW1vbi9wYWdpbmF0aW9uL3BhZ2luYXRpb25cIjtcclxuXHJcbmNsYXNzIEFydGljbGUge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcbiAgICBiYXI6IEJhcjtcclxuICAgIHBhZ2luYXRpb246IFBhZ2luYXRpb247XHJcblxyXG4gICAgY3VycmVudEJvb2s6IEJvb2s7XHJcblxyXG4gICAgcHJvZ3Jlc3M6IFByb2dyZXNzO1xyXG5cclxuICAgIGNhdGFsb2d1ZTogQ2F0YWxvZ3VlSXRlbVtdID0gW107XHJcblxyXG4gICAgY29udGVudDogc3RyaW5nO1xyXG5cclxuICAgIGxvYWRpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZS5hcnRpY2xlJyk7XHJcblxyXG4gICAgICAgIHRoaXMucGFnaW5hdGlvbiA9IG5ldyBQYWdpbmF0aW9uKHtcclxuICAgICAgICAgICAgcm9vdDogdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50JylcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmJhciA9IG5ldyBCYXIoe1xyXG4gICAgICAgICAgICBlbGVtZW50OiB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJhcicpLFxyXG4gICAgICAgICAgICBwYWdpbmF0aW9uOiB0aGlzLnBhZ2luYXRpb25cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFZpZXcodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50LWlubmVyJyksIHRoaXMsICdjb250ZW50JywgKGNvbnRlbnQ6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgICAgICAgICA8c3R5bGU+XHJcbiAgICAgICAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICBjb250ZW50LnNwbGl0KCdcXG4nKS5tYXAodiA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdi50cmltKClcclxuICAgICAgICAgICAgfSkuZmlsdGVyKHYgPT4gISF2KS5mb3JFYWNoKHYgPT4ge1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgPHA+JHt2fTwvcD5cclxuICAgICAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhZ2luYXRpb24uY2hlY2tQYWdlKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldFBhZ2VCeVByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZCh0aGlzLCAncHJvZ3Jlc3MnLCAobmV3VjogYW55LCBvbGRWOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFvbGRWKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgd2luZG93LlN0b3JlLnNldE9iaihgcF8ke3RoaXMuY3VycmVudEJvb2suaWR9YCwgbmV3Vik7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb2dyZXNzLnBvcyA+IHRoaXMuY29udGVudC5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB3aW5kb3cuQXBpLnNhdmVQcm9ncmVzcyh0aGlzLmN1cnJlbnRCb29rLCB0aGlzLnByb2dyZXNzKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgY3VycmVudDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbnQtaW5mbycpO1xyXG4gICAgICAgIGNvbnN0IGNoYW5nZUluZm8gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBgJHt0aGlzLmN1cnJlbnRCb29rPy5uYW1lfSAtICR7dGhpcy5jdXJyZW50Qm9vaz8uYXV0aG9yfSAtICR7dGhpcy5wcm9ncmVzcz8udGl0bGV9YDtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KGN1cnJlbnQsIHRoaXMsICdjdXJyZW50Qm9vaycsIGNoYW5nZUluZm8pO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KGN1cnJlbnQsIHRoaXMsICdwcm9ncmVzcycsIGNoYW5nZUluZm8pO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KGN1cnJlbnQsIHRoaXMsICdjYXRhbG9ndWUnLCBjaGFuZ2VJbmZvKTtcclxuICAgICAgICBcclxuICAgICAgICBsZXQgY29udGVudDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRlbnQnKTtcclxuICAgICAgICBsZXQgY29udGVudElubmVyOiBIVE1MRWxlbWVudCA9IGNvbnRlbnQucXVlcnlTZWxlY3RvcignLmNvbnRlbnQtaW5uZXInKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUoY29udGVudElubmVyLCB3aW5kb3cuTGF5b3V0LCAnZm9udFNpemUnLCAnZm9udFNpemUnLCAodjogYW55KSA9PiBgJHt2fXB4YCk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFN0eWxlKGNvbnRlbnRJbm5lciwgd2luZG93LkxheW91dCwgJ2xpbmVIZWlnaHQnLCAnbGluZUhlaWdodCcsICh2OiBhbnkpID0+IGAke3Z9cHhgKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUoY29udGVudCwgd2luZG93LkxheW91dCwgJ2xpbmVIZWlnaHQnLCAnaGVpZ2h0JywgKHY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsZXQgYmFzZSA9IHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQgLSAyMzAgLSAyMDtcclxuICAgICAgICAgICAgbGV0IG9vID0gYmFzZSAlIHdpbmRvdy5MYXlvdXQubGluZUhlaWdodDtcclxuICAgICAgICAgICAgaWYgKG9vIDwgMTApIHtcclxuICAgICAgICAgICAgICAgIG9vICs9IHdpbmRvdy5MYXlvdXQubGluZUhlaWdodDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsZXQgaGVpZ2h0ID0gYmFzZSAtIG9vICsgMjA7XHJcbiAgICAgICAgICAgIGN1cnJlbnQuc3R5bGUuaGVpZ2h0ID0gYCR7b299cHhgO1xyXG4gICAgICAgICAgICBjdXJyZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtvb31weGA7XHJcbiAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMucGFnaW5hdGlvbi5jaGVja1BhZ2UoKSk7XHJcbiAgICAgICAgICAgIHJldHVybiBgJHtoZWlnaHR9cHhgO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBsZXQgZnVuYyA9ICgpID0+IHtcclxuICAgICAgICAgICAgbGV0IGN1cnJlbnQgPSB3aW5kb3cuU3RvcmUuZ2V0KCdjdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEJvb2sgPSB3aW5kb3cuQm9va1NoZWxmLmJvb2tNYXBbY3VycmVudF07XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Qm9vaykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5Sb3V0ZXIuY3VycmVudCA9PT0gJ2FydGljbGUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LlJvdXRlci5nbygnYm9va3NoZWxmJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHdpbmRvdy5MYXlvdXQubGluZUhlaWdodCA9IHdpbmRvdy5MYXlvdXQubGluZUhlaWdodDtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuY2F0YWxvZ3VlID0gd2luZG93LlN0b3JlLmdldE9iaihgY18ke2N1cnJlbnR9YCkgfHwgW107XHJcblxyXG4gICAgICAgICAgICB0aGlzLnByb2dyZXNzID0gd2luZG93LlN0b3JlLmdldE9iaihgcF8ke3RoaXMuY3VycmVudEJvb2suaWR9YCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldENvbnRlbnQoKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB3aW5kb3cuUm91dGVyLmNiTWFwLmFydGljbGUgPSBmdW5jO1xyXG4gICAgICAgIGZ1bmMoKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRDb250ZW50KCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuY29udGVudCA9IHdpbmRvdy5TdG9yZS5nZXQoYGFfJHt0aGlzLmN1cnJlbnRCb29rLmlkfV8ke3RoaXMucHJvZ3Jlc3MuaW5kZXh9YCkgfHwgJyc7XHJcbiAgICAgICAgbGV0IGNiID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuQ2F0YWxvZ3VlPy5kb0NhY2hlKDUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGlmICghdGhpcy5jb250ZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZ2V0QXJ0aWNsZShjYik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY2IoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcGFnZUNoYW5nZShudW06IDEgfCAtMSk6IHZvaWQgIHtcclxuICAgICAgICBsZXQgdGFyZ2V0ID0gdGhpcy5wYWdpbmF0aW9uLnBhZ2VJbmRleCArIG51bTtcclxuICAgICAgICBpZiAodGFyZ2V0IDwgMCB8fCB0YXJnZXQgPj0gdGhpcy5wYWdpbmF0aW9uLnBhZ2VMaW1pdCkge1xyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLnByb2dyZXNzLmluZGV4ICsgbnVtO1xyXG4gICAgICAgICAgICBsZXQgcG9zID0gbnVtID09PSAtMT85OTk5OTk5OTk5OTk6MDsvLyB0byB0aGUgZW5kXHJcbiAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmoodGhpcy5wcm9ncmVzcywge2luZGV4OiBpbmRleCwgdGl0bGU6IHRoaXMuY2F0YWxvZ3VlW2luZGV4XS50aXRsZSwgdGltZTogbmV3IERhdGUoKS5nZXRUaW1lKCksIHBvczogcG9zfSk7XHJcbiAgICAgICAgICAgIHRoaXMuZ2V0Q29udGVudCgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMucGFnaW5hdGlvbi5zZXRQYWdlKHRhcmdldCk7XHJcbiAgICAgICAgICAgIHRoaXMuZ2V0UGFnZVBvcyh0YXJnZXQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBnZXRQYWdlUG9zKHRhcmdldDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IHRvcCA9IHRhcmdldCAqIHRoaXMucGFnaW5hdGlvbi5wYWdlU3RlcDtcclxuICAgICAgICBsZXQgcHMgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNvbnRlbnQtaW5uZXIgcCcpO1xyXG4gICAgICAgIGxldCBzdHIgPSAnJztcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICgocHNbaV0gYXMgSFRNTEVsZW1lbnQpLm9mZnNldFRvcCA+PSB0b3ApIHtcclxuICAgICAgICAgICAgICAgIHN0ciA9IHBzW2ldLmlubmVySFRNTDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBwb3MgPSB0aGlzLmNvbnRlbnQuaW5kZXhPZihzdHIpO1xyXG4gICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmoodGhpcy5wcm9ncmVzcywge3RpbWU6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLCBwb3M6IHBvc30pO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFBhZ2VCeVByb2dyZXNzKCk6IHZvaWQge1xyXG4gICAgICAgIGxldCB0YXJnZXQgPSB0aGlzLmNvbnRlbnQuc2xpY2UoMCwgdGhpcy5wcm9ncmVzcy5wb3MpLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xyXG4gICAgICAgIGxldCBlbGU6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb250ZW50LWlubmVyIHAnKVt0YXJnZXRdIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGxldCB0b3AgPSBlbGUub2Zmc2V0VG9wO1xyXG4gICAgICAgIGxldCBpbmRleCA9IE1hdGguZmxvb3IodG9wIC8gdGhpcy5wYWdpbmF0aW9uLnBhZ2VTdGVwKTtcclxuICAgICAgICB0aGlzLnBhZ2luYXRpb24uc2V0UGFnZShpbmRleCk7XHJcbiAgICAgICAgaWYgKHRoaXMucHJvZ3Jlc3MucG9zID4gdGhpcy5jb250ZW50Lmxlbmd0aCkgey8vcmVzZXQgdG8gcmlnaHRcclxuICAgICAgICAgICAgdGhpcy5nZXRQYWdlUG9zKGluZGV4KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QXJ0aWNsZShjYj86IEZ1bmN0aW9uKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubG9hZGluZyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmraPlnKjliqDovb3nq6DoioLlhoXlrrknfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nID0gdHJ1ZTtcclxuICAgICAgICB3aW5kb3cuQXBpLmdldEFydGljbGUodGhpcy5jdXJyZW50Qm9vay5zb3VyY2UsIHRoaXMucHJvZ3Jlc3MuaW5kZXgsIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudCA9IHJlcy5kYXRhO1xyXG4gICAgICAgICAgICAgICAgd2luZG93LlN0b3JlLnNldChgYV8ke3RoaXMuY3VycmVudEJvb2suaWR9XyR7dGhpcy5wcm9ncmVzcy5pbmRleH1gLCB0aGlzLmNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEFydGljbGU7IiwiaW1wb3J0IEJhciBmcm9tICcuLi9jb21tb24vYmFyL2Jhcic7XHJcbmltcG9ydCB7IEJvb2ssIGdldE9iamVjdCwgZ2V0U3BlY2lhbFBhcmVudCwgUHJvZ3Jlc3MgfSBmcm9tICcuLi9jb21tb24vY29tbW9uJztcclxuaW1wb3J0IFBhZ2luYXRpb24gZnJvbSAnLi4vY29tbW9uL3BhZ2luYXRpb24vcGFnaW5hdGlvbic7XHJcblxyXG5jbGFzcyBCb29rU2hlbGYge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcbiAgICBiYXI6IEJhcjtcclxuICAgIHBhZ2luYXRpb246IFBhZ2luYXRpb247XHJcblxyXG4gICAgYm9va01hcDoge1trZXk6IHN0cmluZ106IEJvb2t9ID0ge307XHJcbiAgICBib29rTGlzdDogQm9va1tdID0gW107XHJcblxyXG5cclxuICAgIGxvYWRpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBwYWdlSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnBhZ2UuYm9va3NoZWxmJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5wYWdpbmF0aW9uID0gbmV3IFBhZ2luYXRpb24oe1xyXG4gICAgICAgICAgICByb290OiB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRlbnQnKVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYmFyID0gbmV3IEJhcih7XHJcbiAgICAgICAgICAgIGVsZW1lbnQ6IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYmFyJyksXHJcbiAgICAgICAgICAgIHBhZ2luYXRpb246IHRoaXMucGFnaW5hdGlvblxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmJvb2tMaXN0ID0gd2luZG93LlN0b3JlLmdldE9iaignYm9va3NoZWxmJykgfHwgW107XHJcbiAgICAgICAgLy8gdGhpcy5ib29rTGlzdCA9IHdpbmRvdy5TdG9yZS5nZXRCeUhlYWQoJ2JfJykubWFwKHYgPT4gSlNPTi5wYXJzZSh3aW5kb3cuU3RvcmUuZ2V0KHYpIHx8ICcnKSk7Ly93YWl0XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYm9vay1saXN0JyksIHRoaXMsICdib29rTGlzdCcsIChib29rTGlzdDogQm9va1tdLCBvbGRWOiBCb29rW10gPSBbXSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNvbXBhcmVCb29rTGlzdChib29rTGlzdCwgb2xkVik7XHJcbiAgICAgICAgICAgIGxldCBoZWlnaHQgPSAodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wYWdpbmF0aW9uLWJveCcpIGFzIEhUTUxFbGVtZW50KS5vZmZzZXRIZWlnaHQgLyA0O1xyXG4gICAgICAgICAgICBsZXQgaW1nV2lkdGggPSBoZWlnaHQgKiAzIC8gNDtcclxuICAgICAgICAgICAgbGV0IHdpZHRoID0gTWF0aC5mbG9vcigodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5ib29rLWxpc3QnKSBhcyBIVE1MRWxlbWVudCkub2Zmc2V0V2lkdGggLyAyKTtcclxuICAgICAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgICAgICAgICA8c3R5bGU+XHJcbiAgICAgICAgICAgICAgICAgICAgLmJvb2staXRlbSB7aGVpZ2h0OiAke2hlaWdodH1weDt9XHJcbiAgICAgICAgICAgICAgICAgICAgLmJvb2staXRlbSAuYm9vay1jb3ZlciB7d2lkdGg6ICR7aW1nV2lkdGh9cHg7fVxyXG4gICAgICAgICAgICAgICAgICAgIC5ib29rLWl0ZW0gLmJvb2staW5mbyB7d2lkdGg6ICR7d2lkdGggLSBpbWdXaWR0aCAtIDMwfXB4O31cclxuICAgICAgICAgICAgICAgIDwvc3R5bGU+XHJcbiAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIGJvb2tMaXN0LmZvckVhY2goYm9vayA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZGF0ZSA9IG5ldyBEYXRlKGJvb2subGF0ZXN0Q2hhcHRlclRpbWUpO1xyXG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzOiBQcm9ncmVzcyA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYHBfJHtib29rLmlkfWApO1xyXG4gICAgICAgICAgICAgICAgaHRtbCArPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvb2staXRlbVwiIGtleT1cIiR7Ym9vay5pZH1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvb2stY292ZXJcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6IHVybCgke2Jvb2suY3VzdG9tQ292ZXJVcmx9KTtcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPVwiJHtib29rLmNvdmVyVXJsfVwiIGFsdD1cIiR7Ym9vay5uYW1lfVwiLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWluZm9cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLW5hbWVcIj4ke2Jvb2submFtZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWF1dGhvclwiPiR7Ym9vay5hdXRob3J9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9vay1kdXJcIj4ke3Byb2dyZXNzLnRpdGxlfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvb2stbGF0ZXN0XCI+JHtib29rLmxhdGVzdENoYXB0ZXJUaXRsZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWxhdGVzdC10aW1lXCI+5pu05paw5pe26Ze077yaJHtkYXRlLmdldEZ1bGxZZWFyKCl9LSR7ZGF0ZS5nZXRNb250aCgpICsgMX0tJHtkYXRlLmdldERheSgpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhZ2luYXRpb24uY2hlY2tQYWdlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LlJvdXRlci5jYk1hcC5ib29rc2hlbGYgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuYm9va0xpc3QgPSBbXS5jb25jYXQodGhpcy5ib29rTGlzdCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgYm9va0RlbGV0ZShib29rOiBCb29rLCBvbmx5U291cmNlPzogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIGlmICghb25seVNvdXJjZSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuU3RvcmUuZGVsKGBwXyR7Ym9vay5pZH1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93LlN0b3JlLmRlbChgY18ke2Jvb2suaWR9YCk7XHJcbiAgICAgICAgd2luZG93LlN0b3JlLmdldEJ5SGVhZChgYV8ke2Jvb2suaWR9YCkuZm9yRWFjaCh2ID0+IHdpbmRvdy5TdG9yZS5kZWwodikpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbXBhcmVCb29rTGlzdChuZXdWOiBCb29rW10sIG9sZFY6IEJvb2tbXSk6IHZvaWQge1xyXG4gICAgICAgIGxldCBvbGRNYXAgPSB0aGlzLmJvb2tNYXA7XHJcbiAgICAgICAgdGhpcy5ib29rTWFwID0ge307XHJcbiAgICAgICAgbmV3Vi5mb3JFYWNoKGJvb2sgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmJvb2tNYXBbYm9vay5pZF0gPSBib29rO1xyXG4gICAgICAgICAgICBpZiAob2xkTWFwW2Jvb2suaWRdKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYm9vay5zb3VyY2UgIT09IG9sZE1hcFtib29rLmlkXS5zb3VyY2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJvb2tEZWxldGUob2xkTWFwW2Jvb2suaWRdLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGRlbGV0ZSBvbGRNYXBbYm9vay5pZF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBPYmplY3Qua2V5cyhvbGRNYXApLmZvckVhY2goKGlkOiBzdHJpbmcpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5ib29rRGVsZXRlKG9sZE1hcFtpZF0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGdldEJvb2tTaGVsZigpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5sb2FkaW5nID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+ato+WcqOWKoOi9veS5puaetuaVsOaNrid9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRpbmcgPSB0cnVlO1xyXG4gICAgICAgIHdpbmRvdy5BcGkuZ2V0Qm9va3NoZWxmKHtcclxuICAgICAgICAgICAgc3VjY2VzczogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGxldCBib29rTGlzdDogQm9va1tdID0gcmVzLmRhdGEubWFwKChib29rOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgaWQgPSB3aW5kb3cuU3RvcmUuY29tcHJlc3MoYCR7Ym9vay5uYW1lfV8ke2Jvb2suYXV0aG9yfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBrZXlzOiBzdHJpbmdbXSA9IFsnbmFtZScsICdhdXRob3InLCAnY292ZXJVcmwnLCAnY3VzdG9tQ292ZXJVcmwnLCAnbGF0ZXN0Q2hhcHRlclRpbWUnLCAnbGF0ZXN0Q2hhcHRlclRpdGxlJ107XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBvYmo6IFByb2dyZXNzID0gZ2V0T2JqZWN0KGJvb2ssIFtdLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBib29rLmR1ckNoYXB0ZXJJbmRleCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zOiBib29rLmR1ckNoYXB0ZXJQb3MsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKGJvb2suZHVyQ2hhcHRlclRpbWUpLmdldFRpbWUoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IGJvb2suZHVyQ2hhcHRlclRpdGxlXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IG9sZCA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYHBfJHtpZH1gKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIW9sZCB8fCBvbGQudGltZSA8IHBvYmoudGltZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuU3RvcmUuc2V0T2JqKGBwXyR7aWR9YCwgcG9iaik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPYmplY3QoYm9vaywga2V5cywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZTogYm9vay5ib29rVXJsXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYm9va0xpc3QgPSBbXS5jb25jYXQoYm9va0xpc3QpO1xyXG4gICAgICAgICAgICAgICAgd2luZG93LlN0b3JlLnNldE9iaignYm9va3NoZWxmJywgdGhpcy5ib29rTGlzdCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xpY2tJdGVtKGV2ZW50OiBFdmVudCk6IHZvaWQge1xyXG4gICAgICAgIGxldCBpdGVtID0gZ2V0U3BlY2lhbFBhcmVudCgoZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQpIGFzIEhUTUxFbGVtZW50LCAoZWxlOiBIVE1MRWxlbWVudCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gZWxlLmNsYXNzTGlzdC5jb250YWlucygnYm9vay1pdGVtJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbGV0IGlkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2tleScpO1xyXG4gICAgICAgIHdpbmRvdy5TdG9yZS5zZXQoJ2N1cnJlbnQnLCBpZCk7XHJcbiAgICAgICAgd2luZG93LlJvdXRlci5nbygnYXJ0aWNsZScpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgQm9va1NoZWxmOyIsImltcG9ydCBCYXIgZnJvbSBcIi4uL2NvbW1vbi9iYXIvYmFyXCI7XHJcbmltcG9ydCB7IEJvb2ssIENhdGFsb2d1ZUl0ZW0sIGNoYW5nZVZhbHVlV2l0aE5ld09iaiwgZ2V0U3BlY2lhbFBhcmVudCwgUHJvZ3Jlc3MgfSBmcm9tIFwiLi4vY29tbW9uL2NvbW1vblwiO1xyXG5pbXBvcnQgUGFnaW5hdGlvbiBmcm9tIFwiLi4vY29tbW9uL3BhZ2luYXRpb24vcGFnaW5hdGlvblwiO1xyXG5cclxuY2xhc3MgQ2F0YWxvZ3VlIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG4gICAgYmFyOiBCYXI7XHJcbiAgICBwYWdpbmF0aW9uOiBQYWdpbmF0aW9uO1xyXG5cclxuICAgIGN1cnJlbnRCb29rOiBCb29rO1xyXG4gICAgcHJvZ3Jlc3M6IFByb2dyZXNzO1xyXG5cclxuICAgIGxpbmVQZXJQYWdlOiBudW1iZXI7XHJcblxyXG4gICAgbGlzdDogQ2F0YWxvZ3VlSXRlbVtdID0gW107XHJcbiAgICBwYWdlTGlzdDogQ2F0YWxvZ3VlSXRlbVtdID0gW107XHJcblxyXG4gICAgb286IG51bWJlciA9IDEwO1xyXG5cclxuICAgIGxvYWRpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjYWNoZUZsYWc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZS5jYXRhbG9ndWUnKTtcclxuXHJcbiAgICAgICAgdGhpcy5wYWdpbmF0aW9uID0gbmV3IFBhZ2luYXRpb24oe1xyXG4gICAgICAgICAgICByb290OiB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnRlbnQnKSxcclxuICAgICAgICAgICAgZmFrZTogdHJ1ZSxcclxuICAgICAgICAgICAgcGFnZUNoYW5nZTogKGluZGV4OiBudW1iZXIpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBzdGFydCA9IGluZGV4ICogdGhpcy5saW5lUGVyUGFnZTtcclxuICAgICAgICAgICAgICAgIHRoaXMucGFnZUxpc3QgPSB0aGlzLmxpc3Quc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgdGhpcy5saW5lUGVyUGFnZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmJhciA9IG5ldyBCYXIoe1xyXG4gICAgICAgICAgICBlbGVtZW50OiB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJhcicpLFxyXG4gICAgICAgICAgICBwYWdpbmF0aW9uOiB0aGlzLnBhZ2luYXRpb25cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgY3VycmVudDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbnQtaW5mbycpO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmQodGhpcywgJ2xpc3QnLCAobGlzdDogQ2F0YWxvZ3VlSXRlbVtdKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5saW5lUGVyUGFnZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMucGFnaW5hdGlvbi5jaGVja1BhZ2UoTWF0aC5jZWlsKGxpc3QubGVuZ3RoIC8gdGhpcy5saW5lUGVyUGFnZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnBhZ2luYXRpb24uc2V0UGFnZShNYXRoLmZsb29yKHRoaXMucHJvZ3Jlc3MuaW5kZXggLyB0aGlzLmxpbmVQZXJQYWdlKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFZpZXcodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5hcnRpY2xlLWxpc3QnKSwgdGhpcywgJ3BhZ2VMaXN0JywgKGxpc3Q6IENhdGFsb2d1ZUl0ZW1bXSkgPT4ge1xyXG4gICAgICAgICAgICBsZXQgaHRtbCA9IGBcclxuICAgICAgICAgICAgICAgIDxzdHlsZT5cclxuICAgICAgICAgICAgICAgICAgICAuYXJ0aWNsZS1pdGVtIHtsaW5lLWhlaWdodDogODBweDt9XHJcbiAgICAgICAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICBsaXN0LmZvckVhY2goKGFydGljbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGxldCBjdXJyZW50ID0gYXJ0aWNsZS5pbmRleCA9PT0gdGhpcy5wcm9ncmVzcy5pbmRleD8nY3VycmVudCc6Jyc7XHJcbiAgICAgICAgICAgICAgICBsZXQgY2FjaGVkID0gd2luZG93LlN0b3JlLmhhcyhgYV8ke3RoaXMuY3VycmVudEJvb2suaWR9XyR7YXJ0aWNsZS5pbmRleH1gKT8nY2FjaGVkJzonJztcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhcnRpY2xlLWl0ZW0gJHtjdXJyZW50fSAke2NhY2hlZH1cIiBrZXk9XCIke2FydGljbGUuaW5kZXh9XCI+JHthcnRpY2xlLnRpdGxlfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBodG1sO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhjdXJyZW50LCB0aGlzLCAnY3VycmVudEJvb2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBgJHt0aGlzLmN1cnJlbnRCb29rPy5uYW1lfSAtICR7dGhpcy5jdXJyZW50Qm9vaz8uYXV0aG9yfWA7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmQodGhpcywgJ3Byb2dyZXNzJywgKG5ld1Y6IGFueSwgb2xkVjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXRPYmooYHBfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWAsIG5ld1YpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuXHJcbiAgICAgICAgbGV0IGZ1bmMgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEJvb2sgPSB3aW5kb3cuQm9va1NoZWxmLmJvb2tNYXBbd2luZG93LlN0b3JlLmdldCgnY3VycmVudCcpXTtcclxuXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Qm9vaykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHdpbmRvdy5Sb3V0ZXIuY3VycmVudCA9PT0gJ2NhdGFsb2d1ZScpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuUm91dGVyLmdvKCdib29rc2hlbGYnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5jaGVja0hlaWdodCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5wcm9ncmVzcyA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYHBfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWApO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5saXN0ID0gd2luZG93LlN0b3JlLmdldE9iaihgY18ke3RoaXMuY3VycmVudEJvb2suaWR9YCkgfHwgW107XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5saXN0Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRDYXRhbG9ndWUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIuY2JNYXAuY2F0YWxvZ3VlID0gZnVuYztcclxuICAgICAgICBmdW5jKCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tIZWlnaHQoKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IGhlaWdodCA9IHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHQgLSAyMzAgLSAyMDtcclxuICAgICAgICBsZXQgb28gPSBoZWlnaHQgJSA4MDtcclxuICAgICAgICBpZiAob28gPCAxMCkge1xyXG4gICAgICAgICAgICBvbyArPSA4MDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5vbyA9IG9vO1xyXG4gICAgICAgIHRoaXMubGluZVBlclBhZ2UgPSBNYXRoLnJvdW5kKChoZWlnaHQgLSBvbykgLyA4MCkgKiAyO1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnQ6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW50LWluZm8nKTtcclxuICAgICAgICBjb25zdCBjb250ZW50OiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuY29udGVudCcpO1xyXG4gICAgICAgIGN1cnJlbnQuc3R5bGUuaGVpZ2h0ID0gYCR7b299cHhgO1xyXG4gICAgICAgIGN1cnJlbnQuc3R5bGUubGluZUhlaWdodCA9IGAke29vfXB4YDtcclxuICAgICAgICBjb250ZW50LnN0eWxlLmhlaWdodCA9IGAke2hlaWdodCAtIG9vICsgMjB9cHhgO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBnZXRDYXRhbG9ndWUoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubG9hZGluZyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmraPlnKjliqDovb3nm67lvZXmlbDmja4nfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nID0gdHJ1ZTtcclxuICAgICAgICB3aW5kb3cuQXBpLmdldENhdGFsb2d1ZSh0aGlzLmN1cnJlbnRCb29rLnNvdXJjZSwge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiAocmVzOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5saXN0ID0gcmVzLmRhdGEubWFwKCh2OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogdi5pbmRleCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IHYudGl0bGUgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXRPYmooYGNfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWAsIHRoaXMubGlzdCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xpY2tJdGVtKGV2ZW50OiBFdmVudCk6IHZvaWQge1xyXG4gICAgICAgIGxldCBpdGVtID0gZ2V0U3BlY2lhbFBhcmVudCgoZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQpIGFzIEhUTUxFbGVtZW50LCAoZWxlOiBIVE1MRWxlbWVudCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gZWxlLmNsYXNzTGlzdC5jb250YWlucygnYXJ0aWNsZS1pdGVtJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gcGFyc2VJbnQoaXRlbS5nZXRBdHRyaWJ1dGUoJ2tleScpKTtcclxuICAgICAgICB0aGlzLnByb2dyZXNzID0gY2hhbmdlVmFsdWVXaXRoTmV3T2JqKHRoaXMucHJvZ3Jlc3MsIHtpbmRleDogaW5kZXgsIHRpdGxlOiB0aGlzLmxpc3RbaW5kZXhdLnRpdGxlLCB0aW1lOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSwgcG9zOiAwfSk7XHJcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB3aW5kb3cuUm91dGVyLmdvKCdhcnRpY2xlJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgbWFrZUNhY2hlKHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHN0YXJ0ID4gZW5kKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2FjaGVGbGFnID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiAn57yT5a2Y5Lu75Yqh5a6M5oiQJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAod2luZG93LlN0b3JlLmhhcyhgYV8ke3RoaXMuY3VycmVudEJvb2suaWR9XyR7c3RhcnR9YCkpIHtcclxuICAgICAgICAgICAgdGhpcy5tYWtlQ2FjaGUoc3RhcnQgKyAxLCBlbmQpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5BcGkuZ2V0QXJ0aWNsZSh0aGlzLmN1cnJlbnRCb29rLnNvdXJjZSwgc3RhcnQsIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuU3RvcmUuc2V0KGBhXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1fJHtzdGFydH1gLCByZXMuZGF0YSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcihgLmFydGljbGUtaXRlbVtrZXk9XCIke3N0YXJ0fVwiXWApPy5jbGFzc0xpc3QuYWRkKCdjYWNoZWQnKTtcclxuICAgICAgICAgICAgICAgIHRoaXMubWFrZUNhY2hlKHN0YXJ0ICsgMSwgZW5kKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBg57yT5a2Y56ug6IqC44CKJHt0aGlzLmxpc3Rbc3RhcnRdLnRpdGxlfeOAi+Wksei0pWBcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWtlQ2FjaGUoc3RhcnQgKyAxLCBlbmQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZG9DYWNoZSh2YWw6IG51bWJlciB8ICdlbmQnIHwgJ2FsbCcpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5jYWNoZUZsYWcpIHtcclxuICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICfmraPlnKjnvJPlrZjvvIzor7fli7/ph43lpI3mk43kvZwnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5Nb2RhbC5hZGQoe1xyXG4gICAgICAgICAgICBjb250ZW50OiAnNSdcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmNhY2hlRmxhZyA9IHRydWU7XHJcbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wcm9ncmVzcz8uaW5kZXggfHwgMDtcclxuICAgICAgICBsZXQgbGFzdCA9IHRoaXMubGlzdFt0aGlzLmxpc3QubGVuZ3RoIC0gMV0uaW5kZXg7XHJcbiAgICAgICAgaWYgKHZhbCA9PT0gJ2FsbCcpIHtcclxuICAgICAgICAgICAgc3RhcnQgPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgbGFzdCA9IE1hdGgubWluKGxhc3QsIHN0YXJ0ICsgdmFsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93Lk1vZGFsLmFkZCh7XHJcbiAgICAgICAgICAgIGNvbnRlbnQ6ICcxJ1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMubWFrZUNhY2hlKHN0YXJ0LCBsYXN0KTtcclxuICAgIH1cclxuXHJcbiAgICBkZWxldGVDYWNoZSh0eXBlOiAncmVhZGVkJyB8ICdhbGwnKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVGbGFnKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiAn5q2j5Zyo57yT5a2Y77yM56aB55So5Yig6Zmk5pON5L2cJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuU3RvcmUuZ2V0QnlIZWFkKGBhXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1fYCkuZmlsdGVyKHYgPT4gISh0eXBlID09PSAncmVhZGVkJyAmJiBwYXJzZUludCh2LnNwbGl0KCdfJylbMl0pID49IHRoaXMucHJvZ3Jlc3MuaW5kZXgpKS5mb3JFYWNoKHYgPT4ge1xyXG4gICAgICAgICAgICB3aW5kb3cuU3RvcmUuZGVsKHYpO1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcihgLmFydGljbGUtaXRlbVtrZXk9XCIke3Yuc3BsaXQoJ18nKVsyXX1cIl1gKT8uY2xhc3NMaXN0LnJlbW92ZSgnY2FjaGVkJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtcclxuICAgICAgICAgICAgY29udGVudDogJ+WIoOmZpOaMh+Wumue8k+WtmOWujOaIkCdcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjYWNoZSgpOiB2b2lkIHtcclxuICAgICAgICB3aW5kb3cuTW9kYWwuYWRkKHtcclxuICAgICAgICAgICAgY29udGVudDogYFxyXG4gICAgICAgICAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAgICAgICAgIC5tb2RhbC1jb250ZW50IC5idXR0b24ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lLWhlaWdodDogNjBweDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogMjBweDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDQwJTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQ6IGxlZnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMTBweDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSgyMClcIj7nvJPlrZgyMOeroDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSg1MClcIj7nvJPlrZg1MOeroDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSgxMDApXCI+57yT5a2YMTAw56ugPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kb0NhY2hlKDIwMClcIj7nvJPlrZgyMDDnq6A8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJidXR0b25cIiBvbmNsaWNrPVwiQ2F0YWxvZ3VlLmRvQ2FjaGUoJ2VuZCcpXCI+57yT5a2Y5pyq6K+7PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kb0NhY2hlKCdhbGwnKVwiPue8k+WtmOWFqOaWhzwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZGVsZXRlQ2FjaGUoJ3JlYWRlZCcpXCI+5Yig6Zmk5bey6K+7PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kZWxldGVDYWNoZSgnYWxsJylcIj7liKDpmaTlhajpg6g8L2Rpdj5cclxuICAgICAgICAgICAgYCxcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgQ2F0YWxvZ3VlOyIsImltcG9ydCB7IEJvb2ssIFByb2dyZXNzIH0gZnJvbSBcIi4uL2NvbW1vblwiO1xyXG5cclxuY2xhc3MgQXBpIHtcclxuICAgIHVybDogc3RyaW5nO1xyXG5cclxuICAgIGFwaU1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7XHJcbiAgICAgICAgICAgIGJvb2tzaGVsZjogJy9nZXRCb29rc2hlbGYnLFxyXG4gICAgICAgICAgICBjYXRhbG9ndWU6ICcvZ2V0Q2hhcHRlckxpc3QnLFxyXG4gICAgICAgICAgICBhcnRpY2xlOiAnL2dldEJvb2tDb250ZW50JyxcclxuICAgICAgICAgICAgc2F2ZTogJy9zYXZlQm9va1Byb2dyZXNzJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBfY2hlY2tYSFI6IFhNTEh0dHBSZXF1ZXN0O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuQXBpKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdhcGkgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5BcGkgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLnVybCA9IHdpbmRvdy5TdG9yZS5nZXQoJ3VybCcpIHx8ICcnO1xyXG4gICAgfVxyXG5cclxuICAgIHNhdmVQcm9ncmVzcyhib29rOiBCb29rLCBwcm9ncmVzczogUHJvZ3Jlc3MsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLnBvc3QodGhpcy51cmwgKyB0aGlzLmFwaU1hcC5zYXZlLCB7XHJcbiAgICAgICAgICAgIGF1dGhvcjogYm9vay5hdXRob3IsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJJbmRleDogcHJvZ3Jlc3MuaW5kZXgsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJQb3M6IHByb2dyZXNzLnBvcyxcclxuICAgICAgICAgICAgZHVyQ2hhcHRlclRpbWU6IHByb2dyZXNzLnRpbWUsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJUaXRsZTogcHJvZ3Jlc3MudGl0bGUsXHJcbiAgICAgICAgICAgIG5hbWU6IGJvb2submFtZVxyXG4gICAgICAgIH0sIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKGRhdGEpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IoZXJyKTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+S/neWtmOmYheivu+i/m+W6puWIsOacjeWKoeerr+Wksei0pSd9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QXJ0aWNsZSh1cmw6IHN0cmluZywgaW5kZXg6IG51bWJlciwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9ufSk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZ2V0KHRoaXMudXJsICsgdGhpcy5hcGlNYXAuYXJ0aWNsZSwge3VybDogdXJsLCBpbmRleDogaW5kZXh9LCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNiICYmIGNiLnN1Y2Nlc3MgJiYgY2Iuc3VjY2VzcyhkYXRhKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgICAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfojrflj5bnq6DoioLlhoXlrrnlpLHotKUnfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRDYXRhbG9ndWUodXJsOiBzdHJpbmcsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmdldCh0aGlzLnVybCArIHRoaXMuYXBpTWFwLmNhdGFsb2d1ZSwge3VybDogdXJsfSwge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiAoZGF0YTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYi5zdWNjZXNzICYmIGNiLnN1Y2Nlc3MoZGF0YSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYi5lcnJvciAmJiBjYi5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtjb250ZW50OiAn6I635Y+W55uu5b2V5YaF5a655aSx6LSlJ30pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Qm9va3NoZWxmKGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmdldCh0aGlzLnVybCArIHRoaXMuYXBpTWFwLmJvb2tzaGVsZiwge30sIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKGRhdGEpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IoZXJyKTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+iOt+WPluS5puaetuWGheWuueWksei0pSd9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHBvc3QodXJsOiBzdHJpbmcsIGRhdGE6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbiwgY2hlY2s/OiBib29sZWFufSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmh0dHAoJ1BPU1QnLCB1cmwsIGRhdGEsIGNiKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXQodXJsOiBzdHJpbmcsIGRhdGE6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbiwgY2hlY2s/OiBib29sZWFufSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmh0dHAoJ0dFVCcsIHVybCwgZGF0YSwgY2IpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGdldCh1cmw6IHN0cmluZywgZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9uLCBjaGVjaz86IGJvb2xlYW59KSB7XHJcbiAgICAvLyAgICAgaWYgKCF0aGlzLnVybCAmJiAhKGNiICYmIGNiLmNoZWNrKSkge1xyXG4gICAgLy8gICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICflvZPliY3mnKrphY3nva7mnI3liqHlmajlnLDlnYAnfSk7XHJcbiAgICAvLyAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKG51bGwpO1xyXG4gICAgLy8gICAgICAgICByZXR1cm47XHJcbiAgICAvLyAgICAgfVxyXG5cclxuICAgIC8vICAgICAvLyDliJvlu7ogWE1MSHR0cFJlcXVlc3TvvIznm7jlvZPkuo7miZPlvIDmtY/op4jlmahcclxuICAgIC8vICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxyXG5cclxuICAgIC8vICAgICAvLyDmiZPlvIDkuIDkuKrkuI7nvZHlnYDkuYvpl7TnmoTov57mjqUgICDnm7jlvZPkuo7ovpPlhaXnvZHlnYBcclxuICAgIC8vICAgICAvLyDliKnnlKhvcGVu77yI77yJ5pa55rOV77yM56ys5LiA5Liq5Y+C5pWw5piv5a+55pWw5o2u55qE5pON5L2c77yM56ys5LqM5Liq5piv5o6l5Y+jXHJcbiAgICAvLyAgICAgeGhyLm9wZW4oXCJHRVRcIiwgYCR7dXJsfT8ke09iamVjdC5rZXlzKGRhdGEpLm1hcCh2ID0+IGAke3Z9PSR7ZGF0YVt2XX1gKS5qb2luKCcmJyl9YCk7XHJcblxyXG4gICAgLy8gICAgIC8vIOmAmui/h+i/nuaOpeWPkemAgeivt+axgiAg55u45b2T5LqO54K55Ye75Zue6L2m5oiW6ICF6ZO+5o6lXHJcbiAgICAvLyAgICAgeGhyLnNlbmQobnVsbCk7XHJcblxyXG4gICAgLy8gICAgIC8vIOaMh+WumiB4aHIg54q25oCB5Y+Y5YyW5LqL5Lu25aSE55CG5Ye95pWwICAg55u45b2T5LqO5aSE55CG572R6aG15ZGI546w5ZCO55qE5pON5L2cXHJcbiAgICAvLyAgICAgLy8g5YWo5bCP5YaZXHJcbiAgICAvLyAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIC8vICAgICAgICAgLy8g6YCa6L+HcmVhZHlTdGF0ZeeahOWAvOadpeWIpOaWreiOt+WPluaVsOaNrueahOaDheWGtVxyXG4gICAgLy8gICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAvLyAgICAgICAgICAgICAvLyDlk43lupTkvZPnmoTmlofmnKwgcmVzcG9uc2VUZXh0XHJcbiAgICAvLyAgICAgICAgICAgICBsZXQgcmVzcG9uc2U7XHJcbiAgICAvLyAgICAgICAgICAgICB0cnkge1xyXG4gICAgLy8gICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAvLyAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgIC8vICAgICAgICAgICAgICAgICByZXNwb25zZSA9IHRoaXMucmVzcG9uc2VUZXh0O1xyXG4gICAgLy8gICAgICAgICAgICAgfVxyXG4gICAgLy8gICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDAgJiYgcmVzcG9uc2UuaXNTdWNjZXNzKSB7XHJcbiAgICAvLyAgICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKHJlc3BvbnNlKTtcclxuICAgIC8vICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAvLyAgICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IocmVzcG9uc2UpO1xyXG4gICAgLy8gICAgICAgICAgICAgfVxyXG4gICAgLy8gICAgICAgICB9XHJcbiAgICAvLyAgICAgfVxyXG5cclxuICAgIC8vICAgICByZXR1cm4geGhyO1xyXG4gICAgLy8gfVxyXG5cclxuICAgIGh0dHAobWV0aG9kOiAnR0VUJyB8ICdQT1NUJyx1cmw6IHN0cmluZywgZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9uLCBjaGVjaz86IGJvb2xlYW59KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnVybCAmJiAhKGNiICYmIGNiLmNoZWNrKSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICflvZPliY3mnKrphY3nva7mnI3liqHlmajlnLDlnYAnfSk7XHJcbiAgICAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKG51bGwpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDliJvlu7ogWE1MSHR0cFJlcXVlc3TvvIznm7jlvZPkuo7miZPlvIDmtY/op4jlmahcclxuICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHJcbiAgICAgICAgLy8g5omT5byA5LiA5Liq5LiO572R5Z2A5LmL6Ze055qE6L+e5o6lICAg55u45b2T5LqO6L6T5YWl572R5Z2AXHJcbiAgICAgICAgLy8g5Yip55Sob3Blbu+8iO+8ieaWueazle+8jOesrOS4gOS4quWPguaVsOaYr+WvueaVsOaNrueahOaTjeS9nO+8jOesrOS6jOS4quaYr+aOpeWPo1xyXG4gICAgICAgIC8vIHhoci5vcGVuKG1ldGhvZCwgYCR7dXJsfT8ke09iamVjdC5rZXlzKGRhdGEpLm1hcCh2ID0+IGAke3Z9PSR7ZGF0YVt2XX1gKS5qb2luKCcmJyl9YCk7XHJcbiAgICAgICAgbGV0IHBhcmFtOiBzdHJpbmcgPSBPYmplY3Qua2V5cyhkYXRhKS5tYXAodiA9PiBgJHt2fT0ke2RhdGFbdl19YCkuam9pbignJicpO1xyXG4gICAgICAgIHhoci5vcGVuKG1ldGhvZCwgbWV0aG9kID09PSAnR0VUJz9gJHt1cmx9PyR7cGFyYW19YDp1cmwpO1xyXG5cclxuICAgICAgICBpZiAobWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04Jyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDpgJrov4fov57mjqXlj5HpgIHor7fmsYIgIOebuOW9k+S6jueCueWHu+Wbnui9puaIluiAhemTvuaOpVxyXG4gICAgICAgIHhoci5zZW5kKG1ldGhvZCA9PT0gJ0dFVCc/bnVsbDpKU09OLnN0cmluZ2lmeShkYXRhKSk7XHJcblxyXG4gICAgICAgIC8vIOaMh+WumiB4aHIg54q25oCB5Y+Y5YyW5LqL5Lu25aSE55CG5Ye95pWwICAg55u45b2T5LqO5aSE55CG572R6aG15ZGI546w5ZCO55qE5pON5L2cXHJcbiAgICAgICAgLy8g5YWo5bCP5YaZXHJcbiAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8g6YCa6L+HcmVhZHlTdGF0ZeeahOWAvOadpeWIpOaWreiOt+WPluaVsOaNrueahOaDheWGtVxyXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAvLyDlk43lupTkvZPnmoTmlofmnKwgcmVzcG9uc2VUZXh0XHJcbiAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2U7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IHRoaXMucmVzcG9uc2VUZXh0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDAgJiYgcmVzcG9uc2UuaXNTdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4geGhyO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFVybCh1cmw6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMudXJsID0gdXJsO1xyXG4gICAgICAgIHdpbmRvdy5TdG9yZS5zZXQoJ3VybCcsIHVybCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tVcmwodXJsOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2hlY2tYSFIpIHtcclxuICAgICAgICAgICAgdGhpcy5fY2hlY2tYSFIuYWJvcnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY2hlY2tYSFIgPSB0aGlzLmdldCh1cmwgKyB0aGlzLmFwaU1hcC5ib29rc2hlbGYsIHt9LCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+acjeWKoeWZqOWcsOWdgOa1i+ivleaIkOWKnyd9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0VXJsKHVybCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmnI3liqHlmajlnLDlnYDmtYvor5XlpLHotKUnfSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNoZWNrOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBBcGk7IiwiaW1wb3J0IFBhZ2luYXRpb24gZnJvbSBcIi4uL3BhZ2luYXRpb24vcGFnaW5hdGlvblwiO1xyXG5cclxuY2xhc3MgQmFyIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG4gICAgcGFnaW5hdGlvbjogUGFnaW5hdGlvbjtcclxuICAgIHBlcmNlbnQ6IG51bWJlcjtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IHtcclxuICAgICAgICBlbGVtZW50OiBIVE1MRWxlbWVudCxcclxuICAgICAgICBwYWdpbmF0aW9uOiBQYWdpbmF0aW9uXHJcbiAgICB9KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gY29uZmlnLmVsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5wYWdpbmF0aW9uID0gY29uZmlnLnBhZ2luYXRpb247XHJcbiAgICAgICAgdGhpcy5wZXJjZW50ID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiYXItcHJvZ3Jlc3NcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiYXItdGV4dFwiPjxzcGFuIGNsYXNzPVwiYmFyLWN1cnJlbnRcIj48L3NwYW4+LzxzcGFuIGNsYXNzPVwiYmFyLXRvdGFsXCI+PC9zcGFuPjwvZGl2PlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBpbmRleDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJhci1jdXJyZW50Jyk7XHJcbiAgICAgICAgbGV0IHRvdGFsOiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYmFyLXRvdGFsJyk7XHJcbiAgICAgICAgbGV0IHByb2dyZXNzOiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYmFyLXByb2dyZXNzJyk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KGluZGV4LCB0aGlzLnBhZ2luYXRpb24sICdwYWdlSW5kZXgnLCAodmFsdWU6IG51bWJlcikgPT4ge1xyXG4gICAgICAgICAgICBsZXQgdiA9IHZhbHVlICsgMTtcclxuICAgICAgICAgICAgdGhpcy5wZXJjZW50ID0gdiAvIHRoaXMucGFnaW5hdGlvbi5wYWdlTGltaXQ7XHJcbiAgICAgICAgICAgIHJldHVybiB2O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRvdGFsLCB0aGlzLnBhZ2luYXRpb24sICdwYWdlTGltaXQnLCAodmFsdWU6IG51bWJlcikgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBlcmNlbnQgPSAodGhpcy5wYWdpbmF0aW9uLnBhZ2VJbmRleCArIDEpIC8gdmFsdWU7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFN0eWxlKHByb2dyZXNzLCB0aGlzLCAncGVyY2VudCcsICd3aWR0aCcsICh2OiBhbnkpID0+IGAke3YgKiAxMDB9JWApO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQub25jbGljayA9KGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IHRoaXMuZWxlbWVudC5vZmZzZXRXaWR0aDtcclxuICAgICAgICAgICAgbGV0IHggPSBldmVudC5wYWdlWDtcclxuICAgICAgICAgICAgbGV0IGluZGV4ID0gTWF0aC5mbG9vcih0aGlzLnBhZ2luYXRpb24ucGFnZUxpbWl0ICogeCAvIHdpZHRoKTtcclxuICAgICAgICAgICAgdGhpcy5wYWdpbmF0aW9uLnNldFBhZ2UoaW5kZXgpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBCYXI7IiwiY2xhc3MgQmluZCB7XHJcbiAgICBjYk1hcDogYW55ID0ge307XHJcbiAgICBvYmpJbmRleDogbnVtYmVyID0gMDtcclxuICAgIG9iak1hcDogYW55ID0ge307XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgaWYgKHdpbmRvdy5CaW5kKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdiaW5kIGhhcyBiZWVuIGluaXRlZCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuQmluZCA9IHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBoYW5kbGVPYmoob2JqOiBhbnksIHByb3A6IHN0cmluZykge1xyXG4gICAgICAgIGlmICghb2JqLmhhc093blByb3BlcnR5KCdfYmluZElkJykpIHtcclxuICAgICAgICAgICAgb2JqLl9iaW5kSWQgPSB0aGlzLm9iakluZGV4Kys7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmNiTWFwW29iai5fYmluZElkICsgcHJvcF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgaW5kZXggPSAnXycgKyBwcm9wO1xyXG4gICAgICAgIG9ialtpbmRleF0gPSBvYmpbcHJvcF07XHJcbiAgICAgICAgdGhpcy5jYk1hcFtvYmouX2JpbmRJZCArIHByb3BdID0gW107XHJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcCwge1xyXG4gICAgICAgICAgICBnZXQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvYmpbaW5kZXhdO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzZXQ6ICh2YWx1ZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGVtcCA9IG9ialtpbmRleF07XHJcbiAgICAgICAgICAgICAgICBvYmpbaW5kZXhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJ1bihvYmosIHByb3AsIHZhbHVlLCB0ZW1wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgYmluZElucHV0KGVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQsIG9iajogYW55LCBwcm9wOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAoIWVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdlbGVtZW50IGlzIG51bGwnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5iaW5kKG9iaiwgcHJvcCwgKG5ld1Y6IGFueSwgb2xkVjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQudmFsdWUgPSBuZXdWO1xyXG4gICAgICAgIH0sIHRydWUpO1xyXG4gICAgICAgIGVsZW1lbnQub25jaGFuZ2UgPSAoZXZlbnQ6IElucHV0RXZlbnQpID0+IHtcclxuICAgICAgICAgICAgb2JqW3Byb3BdID0gKGV2ZW50LnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZTtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGJpbmRTdHlsZShlbGVtZW50OiBIVE1MRWxlbWVudCwgb2JqOiBhbnksIHByb3A6IHN0cmluZywgdGFyZ2V0OiBhbnksIGhhbmRsZT86IEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgaWYgKCFlbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZWxlbWVudCBpcyBudWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYmluZChvYmosIHByb3AsIChuZXdWOiBhbnksIG9sZFY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlW3RhcmdldF0gPSBoYW5kbGU/aGFuZGxlKG5ld1YsIG9sZFYpOm5ld1Y7XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYmluZFZpZXcoZWxlbWVudDogSFRNTEVsZW1lbnQsIG9iajogYW55LCBwcm9wOiBzdHJpbmcsIGZvcm1hdHRlcj86IEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgaWYgKCFlbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZWxlbWVudCBpcyBudWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYmluZChvYmosIHByb3AsIChuZXdWOiBhbnksIG9sZFY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9IGZvcm1hdHRlcj9mb3JtYXR0ZXIobmV3Viwgb2xkVik6bmV3VjtcclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBiaW5kKG9iajogYW55LCBwcm9wOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbiwgaW1tZWRpYXRlbHk/OiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVPYmoob2JqLCBwcm9wKTtcclxuICAgICAgICB0aGlzLmNiTWFwW29iai5fYmluZElkICsgcHJvcF0ucHVzaChjYWxsYmFjayk7XHJcbiAgICAgICAgaW1tZWRpYXRlbHkgJiYgY2FsbGJhY2sob2JqW3Byb3BdLCB1bmRlZmluZWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJ1bihvYmo6IGFueSwgcHJvcDogc3RyaW5nLCBuZXdWPzogYW55LCBvbGRWPzogYW55KSB7XHJcbiAgICAgICAgdGhpcy5jYk1hcFtvYmouX2JpbmRJZCArIHByb3BdLmZvckVhY2goKGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3Viwgb2xkVik7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgQmluZDsiLCJmdW5jdGlvbiBzdHJUb0RvbShzdHI6IHN0cmluZyk6IEhUTUxDb2xsZWN0aW9uIHtcclxuICAgIGxldCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGRpdi5pbm5lckhUTUwgPSBzdHI7XHJcbiAgICByZXR1cm4gZGl2LmNoaWxkcmVuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWtlRGlzcGxheVRleHQodGltZTogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgIGxldCB0ZXh0ID0gJ+a1i+ivleaWh+acrCc7XHJcblxyXG4gICAgbGV0IHJlc3VsdCA9IG5ldyBBcnJheSh0aW1lICsgMSkuam9pbih0ZXh0KTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTcGVjaWFsUGFyZW50KGVsZTogSFRNTEVsZW1lbnQsY2hlY2tGdW46IEZ1bmN0aW9uKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICAgIGlmIChlbGUgJiYgZWxlICE9PSBkb2N1bWVudCBhcyB1bmtub3duICYmIGNoZWNrRnVuKGVsZSkpIHtcclxuICAgICAgICByZXR1cm4gZWxlO1xyXG4gICAgfVxyXG4gICAgbGV0IHBhcmVudCA9IGVsZS5wYXJlbnRFbGVtZW50IHx8IGVsZS5wYXJlbnROb2RlO1xyXG4gICAgcmV0dXJuIHBhcmVudD9nZXRTcGVjaWFsUGFyZW50KHBhcmVudCBhcyBIVE1MRWxlbWVudCwgY2hlY2tGdW4pOm51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldE9iamVjdChzb3VyY2U6IGFueSwga2V5czogc3RyaW5nW10sIG90aGVycz86IHtba2V5OiBzdHJpbmddOiBhbnl9KTogYW55IHtcclxuICAgIGxldCBvYmo6IGFueSA9IHt9O1xyXG4gICAga2V5cy5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgb2JqW2tleV0gPSBzb3VyY2Vba2V5XTtcclxuICAgIH0pO1xyXG4gICAgb3RoZXJzICYmIE9iamVjdC5rZXlzKG90aGVycykuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgIG9ialtrZXldID0gb3RoZXJzW2tleV07XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNoYW5nZVZhbHVlV2l0aE5ld09iaihvYmo6IGFueSwgdGFyZ2V0OiB7W2tleTogc3RyaW5nXTogYW55fSk6IGFueSB7XHJcbiAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcclxuICAgIE9iamVjdC5rZXlzKHRhcmdldCkuZm9yRWFjaCh2ID0+IHtcclxuICAgICAgICByZXN1bHRbdl0gPSB0YXJnZXRbdl07XHJcbiAgICB9KTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmludGVyZmFjZSBCb29rIHtcclxuICAgIGlkOiBzdHJpbmc7XHJcbiAgICBzb3VyY2U6IHN0cmluZztcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF1dGhvcjogc3RyaW5nO1xyXG4gICAgYm9va1VybDogc3RyaW5nO1xyXG4gICAgY292ZXJVcmw6IHN0cmluZztcclxuICAgIGN1c3RvbUNvdmVyVXJsOiBzdHJpbmc7XHJcbiAgICBkdXJDaGFwdGVyVGl0bGU6IHN0cmluZztcclxuICAgIGxhdGVzdENoYXB0ZXJUaW1lOiBzdHJpbmc7XHJcbiAgICBsYXRlc3RDaGFwdGVyVGl0bGU6IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIENhdGFsb2d1ZUl0ZW0ge1xyXG4gICAgaW5kZXg6IG51bWJlcjtcclxuICAgIHRpdGxlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBQcm9ncmVzcyB7XHJcbiAgICBpbmRleDogbnVtYmVyO1xyXG4gICAgcG9zOiBudW1iZXI7XHJcbiAgICB0aW1lOiBudW1iZXI7XHJcbiAgICB0aXRsZTogc3RyaW5nO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IHsgc3RyVG9Eb20sIG1ha2VEaXNwbGF5VGV4dCwgZ2V0U3BlY2lhbFBhcmVudCwgZ2V0T2JqZWN0LCBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmosIEJvb2ssIENhdGFsb2d1ZUl0ZW0sIFByb2dyZXNzIH07IiwiY2xhc3MgRGVidWdnZXIge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgd2luZG93Lm9uZXJyb3IgPSBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcblxyXG4gICAgICAgICAgICB3aW5kb3cuTW9kYWwgJiYgd2luZG93Lk1vZGFsLmFkZCh7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBlcnJvci50b1N0cmluZygpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IERlYnVnZ2VyOyIsImludGVyZmFjZSBMYXlvdXRJbnRlcmZhY2Uge1xyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuICAgIGxpbmVIZWlnaHQ6IG51bWJlcjtcclxufTtcclxuXHJcbmNsYXNzIExheW91dCB7XHJcblxyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuXHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbGltaXQ6IExheW91dEludGVyZmFjZSA9IHtcclxuICAgICAgICAgICAgZm9udFNpemU6IDIwLFxyXG4gICAgICAgICAgICBsaW5lSGVpZ2h0OiAyNFxyXG4gICAgICAgIH07XHJcbiAgICBiYXNlOiBMYXlvdXRJbnRlcmZhY2UgPSB7XHJcbiAgICAgICAgICAgIGZvbnRTaXplOiAzMCxcclxuICAgICAgICAgICAgbGluZUhlaWdodDogNDBcclxuICAgICAgICB9O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuTGF5b3V0KSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdsYXlvdXQgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5MYXlvdXQgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQod2luZG93LlN0b3JlLmdldCgnZm9udFNpemUnKSB8fCB0aGlzLmJhc2UuZm9udFNpemUudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgdGhpcy5saW5lSGVpZ2h0ID0gcGFyc2VJbnQod2luZG93LlN0b3JlLmdldCgnbGluZUhlaWdodCcpIHx8IHRoaXMuYmFzZS5saW5lSGVpZ2h0LnRvU3RyaW5nKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldCh0YXJnZXQ6ICdmb250U2l6ZScgfCAnbGluZUhlaWdodCcsIHZhbHVlPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgdGhpc1t0YXJnZXRdID0gdmFsdWUgfHwgdGhpcy5iYXNlW3RhcmdldF07XHJcbiAgICAgICAgd2luZG93LlN0b3JlLnNldCh0YXJnZXQsIHRoaXNbdGFyZ2V0XS50b1N0cmluZygpKTtcclxuICAgIH1cclxuXHJcbiAgICBhZGQodGFyZ2V0OiAnZm9udFNpemUnIHwgJ2xpbmVIZWlnaHQnLCBudW06IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIGxldCBjdXJyZW50ID0gdGhpc1t0YXJnZXRdO1xyXG4gICAgICAgIGN1cnJlbnQgKz0gbnVtO1xyXG5cclxuICAgICAgICBpZiAoY3VycmVudCA8IHRoaXMubGltaXRbdGFyZ2V0XSkge1xyXG4gICAgICAgICAgICBjdXJyZW50ID0gdGhpcy5saW1pdFt0YXJnZXRdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zZXQodGFyZ2V0LCBjdXJyZW50KTtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCh0YXJnZXQ/OiAnZm9udFNpemUnIHwgJ2xpbmVIZWlnaHQnKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRhcmdldCkge1xyXG4gICAgICAgICAgICB0aGlzLnNldCh0YXJnZXQpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc2V0KCdmb250U2l6ZScpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdsaW5lSGVpZ2h0Jyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBMYXlvdXQ7IiwiaW1wb3J0IHsgc3RyVG9Eb20gfSBmcm9tICcuLi9jb21tb24nO1xyXG5cclxuaW50ZXJmYWNlIE1lc3NhZ2VPcHRpb24ge1xyXG4gICAgY29udGVudDogc3RyaW5nO1xyXG4gICAgb25Paz86IEZ1bmN0aW9uO1xyXG4gICAgb25DYW5jbGU/OiBGdW5jdGlvbjtcclxuICAgIGJhbkF1dG9SZW1vdmU/OiBib29sZWFuO1xyXG59O1xyXG5cclxuY2xhc3MgTWVzc2FnZUl0ZW0ge1xyXG4gICAgYm9keTogRWxlbWVudDtcclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbjogTWVzc2FnZU9wdGlvbikge1xyXG4gICAgICAgIGxldCBzdHIgPSBgXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZS1jb250ZW50XCI+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgYDtcclxuICAgICAgICBsZXQgbWVzc2FnZTogRWxlbWVudCA9IHN0clRvRG9tKHN0cilbMF07XHJcbiAgICAgICAgdGhpcy5ib2R5ID0gbWVzc2FnZTtcclxuICAgICAgICBsZXQgY29udGVudDogSFRNTERpdkVsZW1lbnQgPSBtZXNzYWdlLnF1ZXJ5U2VsZWN0b3IoJy5tZXNzYWdlLWNvbnRlbnQnKTtcclxuICAgICAgICBjb250ZW50LmlubmVySFRNTCA9IG9wdGlvbi5jb250ZW50O1xyXG5cclxuICAgICAgICBjb250ZW50Lm9uY2xpY2sgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIG9wdGlvbi5vbk9rICYmIG9wdGlvbi5vbk9rKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbi5iYW5BdXRvUmVtb3ZlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgb3B0aW9uLm9uQ2FuY2xlICYmIG9wdGlvbi5vbkNhbmNsZSgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xyXG4gICAgICAgIH0sIDIwMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZSgpIHtcclxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5ib2R5LnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgcGFyZW50ICYmIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmJvZHkpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgTWVzc2FnZSB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuICAgIGxpc3Q6IGFueVtdO1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgaWYgKHdpbmRvdy5NZXNzYWdlKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdtb2RhbCBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5saXN0ID0gW107XHJcbiAgICAgICAgd2luZG93Lk1lc3NhZ2UgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tZXNzYWdlLWJveCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZChvcHRpb246IE1lc3NhZ2VPcHRpb24pIHtcclxuICAgICAgICBsZXQgaXRlbSA9IG5ldyBNZXNzYWdlSXRlbShvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtLmJvZHkpO1xyXG4gICAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZShpdGVtOiBNZXNzYWdlSXRlbSk6IHZvaWQge1xyXG4gICAgICAgIGl0ZW0ucmVtb3ZlKCk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5saXN0LmluZGV4T2YoaXRlbSk7XHJcbiAgICAgICAgdGhpcy5saXN0LnNwbGljZShpbmRleCwgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xlYXIoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5saXN0ID0gW107XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9ICcnO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgTWVzc2FnZTsiLCJpbXBvcnQgeyBzdHJUb0RvbSB9IGZyb20gJy4uL2NvbW1vbic7XHJcblxyXG5cclxuaW50ZXJmYWNlIE1vZGFsT3B0aW9uIHtcclxuICAgIGNvbnRlbnQ6IHN0cmluZyB8IEhUTUxFbGVtZW50O1xyXG4gICAgb25Paz86IEZ1bmN0aW9uO1xyXG4gICAgb25DYW5jZWw/OiBGdW5jdGlvbjtcclxuICAgIHpJbmRleD86IG51bWJlcjtcclxufTtcclxuXHJcbmNsYXNzIE1vZGFsSXRlbSB7XHJcbiAgICBib2R5OiBFbGVtZW50O1xyXG4gICAgekluZGV4OiBudW1iZXI7XHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb246IE1vZGFsT3B0aW9uKSB7XHJcbiAgICAgICAgdGhpcy56SW5kZXggPSBvcHRpb24uekluZGV4O1xyXG4gICAgICAgIGxldCBzdHIgPSBgXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbFwiIHN0eWxlPVwiei1pbmRleDogJHt0aGlzLnpJbmRleH07XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtY29udGVudFwiPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZm9vdGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvbiBtb2RhbC1jb25maXJtXCI+56Gu5a6aPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvbiBtb2RhbC1jYW5jZWxcIj7lj5bmtog8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICBgO1xyXG4gICAgICAgIGxldCBtb2RhbDogRWxlbWVudCA9IHN0clRvRG9tKHN0cilbMF07XHJcbiAgICAgICAgdGhpcy5ib2R5ID0gbW9kYWw7XHJcbiAgICAgICAgbGV0IGNvbnRlbnQ6IEhUTUxEaXZFbGVtZW50ID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLWNvbnRlbnQnKTtcclxuICAgICAgICBsZXQgYnRuQ29uZmlybTogSFRNTEJ1dHRvbkVsZW1lbnQgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtY29uZmlybScpO1xyXG4gICAgICAgIGxldCBidG5DYW5jZWw6IEhUTUxCdXR0b25FbGVtZW50ID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLWNhbmNlbCcpO1xyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uLmNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQuaW5uZXJIVE1MID0gb3B0aW9uLmNvbnRlbnQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29udGVudC5hcHBlbmRDaGlsZChvcHRpb24uY29udGVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ0bkNhbmNlbC5vbmNsaWNrID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb24ub25DYW5jZWwgJiYgb3B0aW9uLm9uQ2FuY2VsKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgYnRuQ29uZmlybS5vbmNsaWNrID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb24ub25PayAmJiBvcHRpb24ub25PaygpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlKCkge1xyXG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLmJvZHkucGFyZW50RWxlbWVudDtcclxuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5ib2R5KTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5jbGFzcyBNb2RhbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuICAgIGxpc3Q6IE1vZGFsSXRlbVtdID0gW107XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBpZiAod2luZG93Lk1vZGFsKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdtb2RhbCBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93Lk1vZGFsID0gdGhpcztcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm94Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkKG9wdGlvbjogTW9kYWxPcHRpb24pOiBNb2RhbEl0ZW0ge1xyXG4gICAgICAgIGlmICghKCd6SW5kZXgnIGluIG9wdGlvbikpIHtcclxuICAgICAgICAgICAgbGV0IGxlbmd0aCA9IHRoaXMubGlzdC5sZW5ndGg7XHJcbiAgICAgICAgICAgIG9wdGlvbi56SW5kZXggPSAobGVuZ3RoP3RoaXMubGlzdFtsZW5ndGggLSAxXS56SW5kZXg6MTAwKSArIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBpdGVtID0gbmV3IE1vZGFsSXRlbShvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtLmJvZHkpO1xyXG4gICAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZShpdGVtOiBNb2RhbEl0ZW0pOiB2b2lkIHtcclxuICAgICAgICBpdGVtLnJlbW92ZSgpO1xyXG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMubGlzdC5pbmRleE9mKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMubGlzdCA9IFtdO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lckhUTUwgPSAnJztcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgTW9kYWw7IiwiY2xhc3MgUGFnaW5hdGlvbiB7XHJcbiAgICByb290OiBIVE1MRWxlbWVudDtcclxuICAgIGJveDogSFRNTEVsZW1lbnQ7XHJcbiAgICBwYWRkaW5nOiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBwYWdlU3RlcDogbnVtYmVyO1xyXG5cclxuICAgIHBhZ2VJbmRleDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwYWdlTGltaXQ6IG51bWJlciA9IDE7XHJcblxyXG4gICAgcGFnZVBhZGRpbmc6IG51bWJlciA9IDA7XHJcblxyXG4gICAgZmFrZVBhZ2U6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IHtcclxuICAgICAgICByb290OiBIVE1MRWxlbWVudCxcclxuICAgICAgICBmYWtlPzogYm9vbGVhbiAgICAgXHJcbiAgICAgICAgcGFnZUNoYW5nZT86IEZ1bmN0aW9uICAgIFxyXG4gICAgfSkge1xyXG4gICAgICAgIHRoaXMucm9vdCA9IGNvbmZpZy5yb290O1xyXG4gICAgICAgIHRoaXMuaGFuZGxlSHRtbChjb25maWcucm9vdCk7XHJcblxyXG4gICAgICAgIHRoaXMuZmFrZVBhZ2UgPSBjb25maWcuZmFrZSB8fCBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5wYWdlU3RlcCA9IHRoaXMuYm94Lm9mZnNldEhlaWdodDtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVja1BhZ2UoKTtcclxuICAgICAgICBcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUodGhpcy5wYWRkaW5nLCB0aGlzLCAncGFnZVBhZGRpbmcnLCAnaGVpZ2h0JywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmQodGhpcywgJ3BhZ2VJbmRleCcsICh2YWx1ZTogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmZha2VQYWdlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25maWc/LnBhZ2VDaGFuZ2UodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuYm94LnNjcm9sbFRvcCA9IHRoaXMucGFnZVN0ZXAgKiB2YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0gIFxyXG4gICAgXHJcbiAgICBwcml2YXRlIGhhbmRsZUh0bWwocm9vdDogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICBsZXQgaW5uZXIgPSByb290LmlubmVySFRNTDtcclxuICAgICAgICByb290LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhZ2luYXRpb24tYm94XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicGFnaW5hdGlvbi1ib2R5XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhZ2luYXRpb24tY29udGVudFwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwYWdpbmF0aW9uLXBhZGRpbmdcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgIGxldCBjb250ZW50OiBIVE1MRWxlbWVudCA9IHJvb3QucXVlcnlTZWxlY3RvcignLnBhZ2luYXRpb24tY29udGVudCcpO1xyXG4gICAgICAgIGNvbnRlbnQuaW5uZXJIVE1MID0gaW5uZXI7XHJcbiAgICAgICAgdGhpcy5ib3ggPSByb290LnF1ZXJ5U2VsZWN0b3IoJy5wYWdpbmF0aW9uLWJveCcpO1xyXG4gICAgICAgIHRoaXMucGFkZGluZyA9IHJvb3QucXVlcnlTZWxlY3RvcignLnBhZ2luYXRpb24tcGFkZGluZycpO1xyXG4gICAgfVxyXG5cclxuICAgIGNoZWNrUGFnZShsaW1pdD86IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIHRoaXMucGFnZVN0ZXAgPSB0aGlzLmJveC5vZmZzZXRIZWlnaHQ7XHJcbiAgICAgICAgaWYgKHRoaXMuZmFrZVBhZ2UpIHtcclxuICAgICAgICAgICAgdGhpcy5wYWdlTGltaXQgPSBsaW1pdCB8fCAxO1xyXG4gICAgICAgICAgICB0aGlzLnBhZ2VQYWRkaW5nID0gMDtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnBhZ2VMaW1pdCA9IE1hdGguY2VpbCh0aGlzLmJveC5zY3JvbGxIZWlnaHQgLyB0aGlzLnBhZ2VTdGVwKSB8fCAxO1xyXG4gICAgICAgIHRoaXMucGFnZVBhZGRpbmcgPSB0aGlzLnBhZ2VTdGVwICogdGhpcy5wYWdlTGltaXQgLSB0aGlzLmJveC5zY3JvbGxIZWlnaHQ7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0UGFnZShudW06IG51bWJlcikge1xyXG4gICAgICAgIGxldCB0YXJnZXQgPSBudW07XHJcbiAgICAgICAgaWYgKG51bSA8IDApIHtcclxuICAgICAgICAgICAgdGFyZ2V0ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG51bSA+PSB0aGlzLnBhZ2VMaW1pdCkge1xyXG4gICAgICAgICAgICB0YXJnZXQgPSB0aGlzLnBhZ2VMaW1pdCAtIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucGFnZUluZGV4ID0gdGFyZ2V0O1xyXG4gICAgfVxyXG5cclxuICAgIHBhZ2VDaGFuZ2UoYWRkOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnNldFBhZ2UodGhpcy5wYWdlSW5kZXggKyBhZGQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUGFnaW5hdGlvbjsiLCJjbGFzcyBSb3V0ZXIge1xyXG5cclxuICAgIGN1cnJlbnQ6IHN0cmluZztcclxuXHJcbiAgICBwYWdlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBjYk1hcDoge1trZXk6IHN0cmluZ106IEZ1bmN0aW9ufSA9IHt9O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHBhZ2VzOiBzdHJpbmdbXSkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuUm91dGVyKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdyb3V0ZXIgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLnBhZ2VzID0gcGFnZXM7XHJcblxyXG4gICAgICAgIGxldCBmdW5jID0gKGV2ZW50PzogSGFzaENoYW5nZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBoYXNoID0gd2luZG93LmxvY2F0aW9uLmhhc2g7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IGhhc2gubGFzdEluZGV4T2YoJyMnKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcclxuICAgICAgICAgICAgICAgIGhhc2ggPSBoYXNoLnNsaWNlKGluZGV4ICsgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMucGFnZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMucGFnZXMuaW5kZXhPZihoYXNoKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gdGhpcy5wYWdlc1swXTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5zd2l0Y2hQYWdlKGhhc2gpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgd2luZG93Lm9uaGFzaGNoYW5nZSA9IGZ1bmM7XHJcbiAgICAgICAgZnVuYygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc3dpdGNoUGFnZShzdHI6IHN0cmluZykge1xyXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaG93Jyk/LmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTtcclxuICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAuJHtzdHJ9YCk/LmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTtcclxuICAgICAgICB0aGlzLmN1cnJlbnQgPSBzdHI7XHJcbiAgICAgICAgdGhpcy5jYk1hcFtzdHJdICYmIHRoaXMuY2JNYXBbc3RyXSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGdvKHRhcmdldDogc3RyaW5nKTogdm9pZCAge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gdGFyZ2V0O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBSb3V0ZXI7IiwiLy8gaW1wb3J0ICogYXMgTHpTdHJpbmcgZnJvbSAnbHotc3RyaW5nJztcclxuaW1wb3J0IHsgY29tcHJlc3MsIGRlY29tcHJlc3MgfSBmcm9tICdsei1zdHJpbmcnO1xyXG5pbXBvcnQgeyBCb29rIH0gZnJvbSAnLi4vY29tbW9uJztcclxuXHJcbi8vIHByZWZpeCBtYXBcclxuLy8gYSBhcnRpY2xlXHJcbi8vIGIgYm9va1xyXG4vLyBjIGNhdGFsb2d1ZVxyXG4vLyBwIHByb2dyZXNzXHJcblxyXG5jbGFzcyBTdG9yZSB7XHJcbiAgICBkYXRhOiBhbnk7XHJcblxyXG4gICAgbGltaXRDaGVja2luZzogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgbGltaXQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgdXNhZ2U6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcGVyY2VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBjb21wcmVzczogRnVuY3Rpb24gPSBjb21wcmVzcztcclxuICAgIGRlY29tcHJlc3M6IEZ1bmN0aW9uID0gZGVjb21wcmVzcztcclxuXHJcbiAgICBjaGVja0ZsYWc6IG51bWJlcjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBpZiAod2luZG93LlN0b3JlKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdzdG9yZSBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93LlN0b3JlID0gdGhpcztcclxuICAgICAgICB0aGlzLmxpbWl0ID0gcGFyc2VJbnQodGhpcy5nZXQoJ2xpbWl0JykgfHwgJzAnKTtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVja1VzYWdlKCk7XHJcbiAgICAgICAgaWYgKHRoaXMubGltaXQgPT09IDApIHtcclxuICAgICAgICAgICAgLy8gdGhpcy5jaGVja0xpbWl0KCk7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+e8k+WtmOacquWIneWni+WMluivt+aJi+WKqOajgOa1iyd9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYm9va0RlbGV0ZShib29rOiBCb29rLCBvbmx5U291cmNlPzogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIGlmICghb25seVNvdXJjZSkge1xyXG4gICAgICAgICAgICB0aGlzLmRlbChgcF8ke2Jvb2suaWR9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZGVsKGBjXyR7Ym9vay5pZH1gKTtcclxuICAgICAgICB0aGlzLmdldEJ5SGVhZChgYV8ke2Jvb2suaWR9YCkuZm9yRWFjaCh2ID0+IHRoaXMuZGVsKHYpKTtcclxuICAgIH1cclxuXHJcbiAgICBkZWwoa2V5OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xyXG4gICAgICAgIHRoaXMuY2hlY2tVc2FnZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuaGFzT3duUHJvcGVydHkoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRPYmooa2V5OiBzdHJpbmcpOiBhbnkgfCBudWxsIHtcclxuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLmdldChrZXkpKTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHNldE9iaihrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBmYWlsPzogRnVuY3Rpb259KTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5zZXQoa2V5LCBKU09OLnN0cmluZ2lmeSh2YWx1ZSksIGNiKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmFpbD86IEZ1bmN0aW9ufSk6IHZvaWQge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIGxldCBja2V5ID0gY29tcHJlc3Moa2V5KTtcclxuICAgICAgICAgICAgbGV0IGN2YWx1ZSA9IGNvbXByZXNzKHZhbHVlKTtcclxuICAgICAgICAgICAgLy8gbG9jYWxTdG9yYWdlLnNldEl0ZW0oY2tleSwgY3ZhbHVlKTtcclxuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBjdmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrVXNhZ2UoKTtcclxuICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKCk7XHJcbiAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+e8k+WtmOWksei0pe+8jOepuumXtOS4jei2syd9KTtcclxuICAgICAgICAgICAgY2IgJiYgY2IuZmFpbCAmJiBjYi5mYWlsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGdldChrZXk6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgICAgIC8vIGxldCBzdG9yZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGNvbXByZXNzKGtleSkpO1xyXG4gICAgICAgIGxldCBzdG9yZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XHJcbiAgICAgICAgaWYgKHN0b3JlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkZWNvbXByZXNzKHN0b3JlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QnlIZWFkKGhlYWQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMobG9jYWxTdG9yYWdlKS5maWx0ZXIodiA9PiB2LmluZGV4T2YoaGVhZCkgPT09IDApO1xyXG4gICAgfVxyXG5cclxuICAgIGNoZWNrVXNhZ2UoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2hlY2tGbGFnKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5jaGVja0ZsYWcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNoZWNrRmxhZyA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy51c2FnZSA9IE9iamVjdC5rZXlzKGxvY2FsU3RvcmFnZSkubWFwKHYgPT4gdiArIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHYpKS5qb2luKCcnKS5sZW5ndGg7XHJcbiAgICAgICAgICAgIHRoaXMucGVyY2VudCA9IHRoaXMubGltaXQ/TWF0aC5yb3VuZCh0aGlzLnVzYWdlIC8gKHRoaXMubGltaXQpICogMTAwKTowO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wZXJjZW50ID4gOTUpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogYOe8k+WtmOW3suS9v+eUqCR7dGhpcy5wZXJjZW50fSXvvIzor7fms6jmhI9gXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tMaW1pdCgpOiB2b2lkIHtcclxuICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmraPlnKjmo4DmtYvnvJPlrZjlrrnph48nfSk7XHJcbiAgICAgICAgaWYgKHRoaXMubGltaXRDaGVja2luZykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubGltaXRDaGVja2luZyA9IHRydWU7XHJcblxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGxldCBiYXNlID0gdGhpcy51c2FnZTtcclxuICAgICAgICAgICAgbGV0IGFkZExlbmd0aCA9IDEwMDAwMDA7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IDA7XHJcblxyXG4gICAgICAgICAgICB3aGlsZSAoYWRkTGVuZ3RoID4gMikge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQga2V5ID0gYF90ZXN0JHtpbmRleCsrfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFkZExlbmd0aCA8IGtleS5sZW5ndGgpIHticmVhazt9XHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBuZXcgQXJyYXkoYWRkTGVuZ3RoIC0ga2V5Lmxlbmd0aCArIDEpLmpvaW4oJ2EnKSk7ICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGJhc2UgKz0gYWRkTGVuZ3RoOyAgICAgXHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcclxuICAgICAgICAgICAgICAgICAgICBpbmRleC0tO1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZExlbmd0aCA9IE1hdGgucm91bmQoYWRkTGVuZ3RoIC8gMik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5saW1pdCA9IGJhc2U7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldEJ5SGVhZCgnX3Rlc3QnKS5mb3JFYWNoKHYgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kZWwodilcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnNldCgnbGltaXQnLCB0aGlzLmxpbWl0LnRvU3RyaW5nKCkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5saW1pdENoZWNraW5nID0gZmFsc2U7XHJcblxyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmo4DmtYvlrozmiJAnfSk7XHJcbiAgICAgICAgfSwgMTAwMCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBTdG9yZTsiLCJpbXBvcnQge21ha2VEaXNwbGF5VGV4dH0gZnJvbSAnLi4vY29tbW9uL2NvbW1vbic7XHJcblxyXG5jbGFzcyBDb25maWcge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgZGlzcGxheVRleHQ6IHN0cmluZztcclxuXHJcbiAgICB1cmw6IHN0cmluZztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZS5jb25maWcnKTtcclxuXHJcbiAgICAgICAgdGhpcy51cmwgPSB3aW5kb3cuQXBpLnVybDtcclxuXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5VGV4dCA9IG1ha2VEaXNwbGF5VGV4dCgyMDApO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kSW5wdXQodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy51cmwgaW5wdXQnKSwgdGhpcywgJ3VybCcpO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyh0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnN0b3JlLXVzYWdlJyksIHdpbmRvdy5TdG9yZSwgJ3VzYWdlJyk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFZpZXcodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zdG9yZS10b3RhbCcpLCB3aW5kb3cuU3RvcmUsICdsaW1pdCcpO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc3RvcmUtcGVyY2VudCcpLCB3aW5kb3cuU3RvcmUsICdwZXJjZW50JywgKHY6IG51bWJlcikgPT4gYCAgKCAke3Z9JSApYCk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuZm9udC1zaXplJyksIHdpbmRvdy5MYXlvdXQsICdmb250U2l6ZScpO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubGluZS1oZWlnaHQnKSwgd2luZG93LkxheW91dCwgJ2xpbmVIZWlnaHQnKTtcclxuXHJcbiAgICAgICAgbGV0IGRpc3BsYXk6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kaXNwbGF5IC50ZXh0IHAnKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhkaXNwbGF5LCB0aGlzLCAnZGlzcGxheVRleHQnKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUoZGlzcGxheSwgd2luZG93LkxheW91dCwgJ2ZvbnRTaXplJywgJ2ZvbnRTaXplJywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRTdHlsZShkaXNwbGF5LCB3aW5kb3cuTGF5b3V0LCAnbGluZUhlaWdodCcsICdsaW5lSGVpZ2h0JywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMudXJsKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+W9k+WJjeacqumFjee9ruacjeWKoeWZqOWcsOWdgCd9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrVXJsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjaGVja1VybCgpIHtcclxuICAgICAgICB3aW5kb3cuQXBpLmNoZWNrVXJsKHRoaXMudXJsKTtcclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IENvbmZpZzsiLCJpbXBvcnQgQm9va1NoZWxmIGZyb20gJy4vYm9va3NoZWxmL2Jvb2tzaGVsZic7XHJcbmltcG9ydCBDb25maWcgZnJvbSAnLi9jb25maWcvY29uZmlnJztcclxuaW1wb3J0IFJvdXRlciBmcm9tICcuL2NvbW1vbi9yb3V0ZXIvcm91dGVyJztcclxuaW1wb3J0IERlYnVnZ2VyIGZyb20gJy4vY29tbW9uL2RlYnVnZ2VyL2RlYnVnZ2VyJztcclxuaW1wb3J0IE1vZGFsIGZyb20gJy4vY29tbW9uL21vZGFsL21vZGFsJztcclxuaW1wb3J0IE1lc3NhZ2UgZnJvbSAnLi9jb21tb24vbWVzc2FnZS9tZXNzYWdlJztcclxuaW1wb3J0IFN0b3JlIGZyb20gJy4vY29tbW9uL3N0b3JlL3N0b3JlJztcclxuaW1wb3J0IEJpbmQgZnJvbSAnLi9jb21tb24vYmluZC9iaW5kJztcclxuaW1wb3J0IExheW91dCBmcm9tICcuL2NvbW1vbi9sYXlvdXQvbGF5b3V0JztcclxuaW1wb3J0IEFwaSBmcm9tICcuL2NvbW1vbi9hcGkvYXBpJztcclxuaW1wb3J0IEFydGljbGUgZnJvbSAnLi9hcnRpY2xlL2FydGljbGUnO1xyXG5pbXBvcnQgQ2F0YWxvZ3VlIGZyb20gJy4vY2F0YWxvZ3VlL2NhdGFsb2d1ZSc7XHJcblxyXG5jb25zdCBwYWdlczogc3RyaW5nW10gPSBbJ2NvbmZpZycsICdib29rc2hlbGYnLCAnYXJ0aWNsZScsICdjYXRhbG9ndWUnXTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICBuZXcgRGVidWdnZXIoKTtcclxuXHJcbiAgICBuZXcgQmluZCgpO1xyXG5cclxuICAgIG5ldyBNb2RhbCgpO1xyXG4gICAgbmV3IE1lc3NhZ2UoKTtcclxuXHJcbiAgICBuZXcgUm91dGVyKHBhZ2VzKTtcclxuXHJcbiAgICBuZXcgU3RvcmUoKTtcclxuXHJcbiAgICBuZXcgTGF5b3V0KCk7XHJcblxyXG4gICAgbmV3IEFwaSgpO1xyXG5cclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5nbG9iYWwtc3R5bGUnKS5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAucGFnZSAuY29udGVudCB7XHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6ICR7ZG9jdW1lbnQuYm9keS5vZmZzZXRIZWlnaHQgLSAyMzB9cHg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICA8L3N0eWxlPlxyXG4gICAgYDtcclxuXHJcbiAgICB3aW5kb3cuQ29uZmlnID0gbmV3IENvbmZpZygpO1xyXG5cclxuICAgIHdpbmRvdy5Cb29rU2hlbGYgPSBuZXcgQm9va1NoZWxmKCk7XHJcbiAgICBcclxuICAgIHdpbmRvdy5DYXRhbG9ndWUgPSBuZXcgQ2F0YWxvZ3VlKCk7XHJcblxyXG4gICAgd2luZG93LkFydGljbGUgPSBuZXcgQXJ0aWNsZSgpO1xyXG5cclxufVxyXG5cclxud2luZG93LmluaXQgPSBpbml0O1xyXG5cclxuXHJcblxyXG53aW5kb3cub25kYmxjbGljayA9IGZ1bmN0aW9uKGV2ZW50OiBFdmVudCkge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxufSJdfQ==
