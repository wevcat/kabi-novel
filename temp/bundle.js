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
            _this.checkCurrent();
            _this.checkHeight();
        };
        window.Router.cbMap.catalogue = func;
        func();
    }
    Catalogue.prototype.checkCurrent = function () {
        this.currentBook = window.BookShelf.bookMap[window.Store.get('current')];
        if (!this.currentBook) {
            if (window.Router.current === 'catalogue') {
                window.Router.go('bookshelf');
            }
            return;
        }
        this.progress = window.Store.getObj("p_".concat(this.currentBook.id));
        this.list = window.Store.getObj("c_".concat(this.currentBook.id)) || [];
        if (this.list.length === 0) {
            this.getCatalogue();
        }
    };
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
        var _a, _b;
        if (this.cacheFlag) {
            window.Message.add({
                content: '正在缓存，请勿重复操作'
            });
            return;
        }
        this.checkCurrent();
        this.cacheFlag = true;
        var start = (_a = this.progress) === null || _a === void 0 ? void 0 : _a.index;
        var last = ((_b = this.list[this.list.length - 1]) === null || _b === void 0 ? void 0 : _b.index) || 0;
        if (val === 'all') {
            start = 0;
        }
        if (typeof val === 'number') {
            last = Math.min(last, start + val);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy8ucG5wbS9yZWdpc3RyeS5ucG1taXJyb3IuY29tK2Jyb3dzZXItcGFja0A2LjEuMC9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3JlZ2lzdHJ5Lm5wbW1pcnJvci5jb20rbHotc3RyaW5nQDEuNS4wL25vZGVfbW9kdWxlcy9sei1zdHJpbmcvbGlicy9sei1zdHJpbmcuanMiLCJzcmMvYXJ0aWNsZS9hcnRpY2xlLnRzIiwic3JjL2Jvb2tzaGVsZi9ib29rc2hlbGYudHMiLCJzcmMvY2F0YWxvZ3VlL2NhdGFsb2d1ZS50cyIsInNyYy9jb21tb24vYXBpL2FwaS50cyIsInNyYy9jb21tb24vYmFyL2Jhci50cyIsInNyYy9jb21tb24vYmluZC9iaW5kLnRzIiwic3JjL2NvbW1vbi9jb21tb24udHMiLCJzcmMvY29tbW9uL2RlYnVnZ2VyL2RlYnVnZ2VyLnRzIiwic3JjL2NvbW1vbi9sYXlvdXQvbGF5b3V0LnRzIiwic3JjL2NvbW1vbi9tZXNzYWdlL21lc3NhZ2UudHMiLCJzcmMvY29tbW9uL21vZGFsL21vZGFsLnRzIiwic3JjL2NvbW1vbi9wYWdpbmF0aW9uL3BhZ2luYXRpb24udHMiLCJzcmMvY29tbW9uL3JvdXRlci9yb3V0ZXIudHMiLCJzcmMvY29tbW9uL3N0b3JlL3N0b3JlLnRzIiwic3JjL2NvbmZpZy9jb25maWcudHMiLCJzcmMvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUMsZUFBZSxDQUFDLENBQUMsU0FBUyxHQUFHLG1GQUc5QixRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFHLCtDQUdyRCxDQUFDO0lBRUYsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLGdCQUFNLEVBQUUsQ0FBQztJQUU3QixNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksbUJBQVMsRUFBRSxDQUFDO0lBRW5DLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxtQkFBUyxFQUFFLENBQUM7SUFFbkMsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLGlCQUFPLEVBQUUsQ0FBQztBQUVuQyxDQUFDO0FBRUQsTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFJbkIsTUFBTSxDQUFDLFVBQVUsR0FBRyxVQUFTLEtBQVk7SUFDckMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQzNCLENBQUMsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8vIENvcHlyaWdodCAoYykgMjAxMyBQaWVyb3h5IDxwaWVyb3h5QHBpZXJveHkubmV0PlxuLy8gVGhpcyB3b3JrIGlzIGZyZWUuIFlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnkgaXRcbi8vIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgV1RGUEwsIFZlcnNpb24gMlxuLy8gRm9yIG1vcmUgaW5mb3JtYXRpb24gc2VlIExJQ0VOU0UudHh0IG9yIGh0dHA6Ly93d3cud3RmcGwubmV0L1xuLy9cbi8vIEZvciBtb3JlIGluZm9ybWF0aW9uLCB0aGUgaG9tZSBwYWdlOlxuLy8gaHR0cDovL3BpZXJveHkubmV0L2Jsb2cvcGFnZXMvbHotc3RyaW5nL3Rlc3RpbmcuaHRtbFxuLy9cbi8vIExaLWJhc2VkIGNvbXByZXNzaW9uIGFsZ29yaXRobSwgdmVyc2lvbiAxLjQuNVxudmFyIExaU3RyaW5nID0gKGZ1bmN0aW9uKCkge1xuXG4vLyBwcml2YXRlIHByb3BlcnR5XG52YXIgZiA9IFN0cmluZy5mcm9tQ2hhckNvZGU7XG52YXIga2V5U3RyQmFzZTY0ID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPVwiO1xudmFyIGtleVN0clVyaVNhZmUgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky0kXCI7XG52YXIgYmFzZVJldmVyc2VEaWMgPSB7fTtcblxuZnVuY3Rpb24gZ2V0QmFzZVZhbHVlKGFscGhhYmV0LCBjaGFyYWN0ZXIpIHtcbiAgaWYgKCFiYXNlUmV2ZXJzZURpY1thbHBoYWJldF0pIHtcbiAgICBiYXNlUmV2ZXJzZURpY1thbHBoYWJldF0gPSB7fTtcbiAgICBmb3IgKHZhciBpPTAgOyBpPGFscGhhYmV0Lmxlbmd0aCA7IGkrKykge1xuICAgICAgYmFzZVJldmVyc2VEaWNbYWxwaGFiZXRdW2FscGhhYmV0LmNoYXJBdChpKV0gPSBpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmFzZVJldmVyc2VEaWNbYWxwaGFiZXRdW2NoYXJhY3Rlcl07XG59XG5cbnZhciBMWlN0cmluZyA9IHtcbiAgY29tcHJlc3NUb0Jhc2U2NCA6IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gXCJcIjtcbiAgICB2YXIgcmVzID0gTFpTdHJpbmcuX2NvbXByZXNzKGlucHV0LCA2LCBmdW5jdGlvbihhKXtyZXR1cm4ga2V5U3RyQmFzZTY0LmNoYXJBdChhKTt9KTtcbiAgICBzd2l0Y2ggKHJlcy5sZW5ndGggJSA0KSB7IC8vIFRvIHByb2R1Y2UgdmFsaWQgQmFzZTY0XG4gICAgZGVmYXVsdDogLy8gV2hlbiBjb3VsZCB0aGlzIGhhcHBlbiA/XG4gICAgY2FzZSAwIDogcmV0dXJuIHJlcztcbiAgICBjYXNlIDEgOiByZXR1cm4gcmVzK1wiPT09XCI7XG4gICAgY2FzZSAyIDogcmV0dXJuIHJlcytcIj09XCI7XG4gICAgY2FzZSAzIDogcmV0dXJuIHJlcytcIj1cIjtcbiAgICB9XG4gIH0sXG5cbiAgZGVjb21wcmVzc0Zyb21CYXNlNjQgOiBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICBpZiAoaW5wdXQgPT0gbnVsbCkgcmV0dXJuIFwiXCI7XG4gICAgaWYgKGlucHV0ID09IFwiXCIpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBMWlN0cmluZy5fZGVjb21wcmVzcyhpbnB1dC5sZW5ndGgsIDMyLCBmdW5jdGlvbihpbmRleCkgeyByZXR1cm4gZ2V0QmFzZVZhbHVlKGtleVN0ckJhc2U2NCwgaW5wdXQuY2hhckF0KGluZGV4KSk7IH0pO1xuICB9LFxuXG4gIGNvbXByZXNzVG9VVEYxNiA6IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gXCJcIjtcbiAgICByZXR1cm4gTFpTdHJpbmcuX2NvbXByZXNzKGlucHV0LCAxNSwgZnVuY3Rpb24oYSl7cmV0dXJuIGYoYSszMik7fSkgKyBcIiBcIjtcbiAgfSxcblxuICBkZWNvbXByZXNzRnJvbVVURjE2OiBmdW5jdGlvbiAoY29tcHJlc3NlZCkge1xuICAgIGlmIChjb21wcmVzc2VkID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIGlmIChjb21wcmVzc2VkID09IFwiXCIpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBMWlN0cmluZy5fZGVjb21wcmVzcyhjb21wcmVzc2VkLmxlbmd0aCwgMTYzODQsIGZ1bmN0aW9uKGluZGV4KSB7IHJldHVybiBjb21wcmVzc2VkLmNoYXJDb2RlQXQoaW5kZXgpIC0gMzI7IH0pO1xuICB9LFxuXG4gIC8vY29tcHJlc3MgaW50byB1aW50OGFycmF5IChVQ1MtMiBiaWcgZW5kaWFuIGZvcm1hdClcbiAgY29tcHJlc3NUb1VpbnQ4QXJyYXk6IGZ1bmN0aW9uICh1bmNvbXByZXNzZWQpIHtcbiAgICB2YXIgY29tcHJlc3NlZCA9IExaU3RyaW5nLmNvbXByZXNzKHVuY29tcHJlc3NlZCk7XG4gICAgdmFyIGJ1Zj1uZXcgVWludDhBcnJheShjb21wcmVzc2VkLmxlbmd0aCoyKTsgLy8gMiBieXRlcyBwZXIgY2hhcmFjdGVyXG5cbiAgICBmb3IgKHZhciBpPTAsIFRvdGFsTGVuPWNvbXByZXNzZWQubGVuZ3RoOyBpPFRvdGFsTGVuOyBpKyspIHtcbiAgICAgIHZhciBjdXJyZW50X3ZhbHVlID0gY29tcHJlc3NlZC5jaGFyQ29kZUF0KGkpO1xuICAgICAgYnVmW2kqMl0gPSBjdXJyZW50X3ZhbHVlID4+PiA4O1xuICAgICAgYnVmW2kqMisxXSA9IGN1cnJlbnRfdmFsdWUgJSAyNTY7XG4gICAgfVxuICAgIHJldHVybiBidWY7XG4gIH0sXG5cbiAgLy9kZWNvbXByZXNzIGZyb20gdWludDhhcnJheSAoVUNTLTIgYmlnIGVuZGlhbiBmb3JtYXQpXG4gIGRlY29tcHJlc3NGcm9tVWludDhBcnJheTpmdW5jdGlvbiAoY29tcHJlc3NlZCkge1xuICAgIGlmIChjb21wcmVzc2VkPT09bnVsbCB8fCBjb21wcmVzc2VkPT09dW5kZWZpbmVkKXtcbiAgICAgICAgcmV0dXJuIExaU3RyaW5nLmRlY29tcHJlc3MoY29tcHJlc3NlZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGJ1Zj1uZXcgQXJyYXkoY29tcHJlc3NlZC5sZW5ndGgvMik7IC8vIDIgYnl0ZXMgcGVyIGNoYXJhY3RlclxuICAgICAgICBmb3IgKHZhciBpPTAsIFRvdGFsTGVuPWJ1Zi5sZW5ndGg7IGk8VG90YWxMZW47IGkrKykge1xuICAgICAgICAgIGJ1ZltpXT1jb21wcmVzc2VkW2kqMl0qMjU2K2NvbXByZXNzZWRbaSoyKzFdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICBidWYuZm9yRWFjaChmdW5jdGlvbiAoYykge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGYoYykpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIExaU3RyaW5nLmRlY29tcHJlc3MocmVzdWx0LmpvaW4oJycpKTtcblxuICAgIH1cblxuICB9LFxuXG5cbiAgLy9jb21wcmVzcyBpbnRvIGEgc3RyaW5nIHRoYXQgaXMgYWxyZWFkeSBVUkkgZW5jb2RlZFxuICBjb21wcmVzc1RvRW5jb2RlZFVSSUNvbXBvbmVudDogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgaWYgKGlucHV0ID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIHJldHVybiBMWlN0cmluZy5fY29tcHJlc3MoaW5wdXQsIDYsIGZ1bmN0aW9uKGEpe3JldHVybiBrZXlTdHJVcmlTYWZlLmNoYXJBdChhKTt9KTtcbiAgfSxcblxuICAvL2RlY29tcHJlc3MgZnJvbSBhbiBvdXRwdXQgb2YgY29tcHJlc3NUb0VuY29kZWRVUklDb21wb25lbnRcbiAgZGVjb21wcmVzc0Zyb21FbmNvZGVkVVJJQ29tcG9uZW50OmZ1bmN0aW9uIChpbnB1dCkge1xuICAgIGlmIChpbnB1dCA9PSBudWxsKSByZXR1cm4gXCJcIjtcbiAgICBpZiAoaW5wdXQgPT0gXCJcIikgcmV0dXJuIG51bGw7XG4gICAgaW5wdXQgPSBpbnB1dC5yZXBsYWNlKC8gL2csIFwiK1wiKTtcbiAgICByZXR1cm4gTFpTdHJpbmcuX2RlY29tcHJlc3MoaW5wdXQubGVuZ3RoLCAzMiwgZnVuY3Rpb24oaW5kZXgpIHsgcmV0dXJuIGdldEJhc2VWYWx1ZShrZXlTdHJVcmlTYWZlLCBpbnB1dC5jaGFyQXQoaW5kZXgpKTsgfSk7XG4gIH0sXG5cbiAgY29tcHJlc3M6IGZ1bmN0aW9uICh1bmNvbXByZXNzZWQpIHtcbiAgICByZXR1cm4gTFpTdHJpbmcuX2NvbXByZXNzKHVuY29tcHJlc3NlZCwgMTYsIGZ1bmN0aW9uKGEpe3JldHVybiBmKGEpO30pO1xuICB9LFxuICBfY29tcHJlc3M6IGZ1bmN0aW9uICh1bmNvbXByZXNzZWQsIGJpdHNQZXJDaGFyLCBnZXRDaGFyRnJvbUludCkge1xuICAgIGlmICh1bmNvbXByZXNzZWQgPT0gbnVsbCkgcmV0dXJuIFwiXCI7XG4gICAgdmFyIGksIHZhbHVlLFxuICAgICAgICBjb250ZXh0X2RpY3Rpb25hcnk9IHt9LFxuICAgICAgICBjb250ZXh0X2RpY3Rpb25hcnlUb0NyZWF0ZT0ge30sXG4gICAgICAgIGNvbnRleHRfYz1cIlwiLFxuICAgICAgICBjb250ZXh0X3djPVwiXCIsXG4gICAgICAgIGNvbnRleHRfdz1cIlwiLFxuICAgICAgICBjb250ZXh0X2VubGFyZ2VJbj0gMiwgLy8gQ29tcGVuc2F0ZSBmb3IgdGhlIGZpcnN0IGVudHJ5IHdoaWNoIHNob3VsZCBub3QgY291bnRcbiAgICAgICAgY29udGV4dF9kaWN0U2l6ZT0gMyxcbiAgICAgICAgY29udGV4dF9udW1CaXRzPSAyLFxuICAgICAgICBjb250ZXh0X2RhdGE9W10sXG4gICAgICAgIGNvbnRleHRfZGF0YV92YWw9MCxcbiAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uPTAsXG4gICAgICAgIGlpO1xuXG4gICAgZm9yIChpaSA9IDA7IGlpIDwgdW5jb21wcmVzc2VkLmxlbmd0aDsgaWkgKz0gMSkge1xuICAgICAgY29udGV4dF9jID0gdW5jb21wcmVzc2VkLmNoYXJBdChpaSk7XG4gICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb250ZXh0X2RpY3Rpb25hcnksY29udGV4dF9jKSkge1xuICAgICAgICBjb250ZXh0X2RpY3Rpb25hcnlbY29udGV4dF9jXSA9IGNvbnRleHRfZGljdFNpemUrKztcbiAgICAgICAgY29udGV4dF9kaWN0aW9uYXJ5VG9DcmVhdGVbY29udGV4dF9jXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnRleHRfd2MgPSBjb250ZXh0X3cgKyBjb250ZXh0X2M7XG4gICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbnRleHRfZGljdGlvbmFyeSxjb250ZXh0X3djKSkge1xuICAgICAgICBjb250ZXh0X3cgPSBjb250ZXh0X3djO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb250ZXh0X2RpY3Rpb25hcnlUb0NyZWF0ZSxjb250ZXh0X3cpKSB7XG4gICAgICAgICAgaWYgKGNvbnRleHRfdy5jaGFyQ29kZUF0KDApPDI1Nikge1xuICAgICAgICAgICAgZm9yIChpPTAgOyBpPGNvbnRleHRfbnVtQml0cyA7IGkrKykge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSk7XG4gICAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZSA9IGNvbnRleHRfdy5jaGFyQ29kZUF0KDApO1xuICAgICAgICAgICAgZm9yIChpPTAgOyBpPDggOyBpKyspIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgKHZhbHVlJjEpO1xuICAgICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlID4+IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlID0gMTtcbiAgICAgICAgICAgIGZvciAoaT0wIDsgaTxjb250ZXh0X251bUJpdHMgOyBpKyspIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgdmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT1iaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFsdWUgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSBjb250ZXh0X3cuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgICAgIGZvciAoaT0wIDsgaTwxNiA7IGkrKykge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgPj4gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGV4dF9lbmxhcmdlSW4tLTtcbiAgICAgICAgICBpZiAoY29udGV4dF9lbmxhcmdlSW4gPT0gMCkge1xuICAgICAgICAgICAgY29udGV4dF9lbmxhcmdlSW4gPSBNYXRoLnBvdygyLCBjb250ZXh0X251bUJpdHMpO1xuICAgICAgICAgICAgY29udGV4dF9udW1CaXRzKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZSBjb250ZXh0X2RpY3Rpb25hcnlUb0NyZWF0ZVtjb250ZXh0X3ddO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gY29udGV4dF9kaWN0aW9uYXJ5W2NvbnRleHRfd107XG4gICAgICAgICAgZm9yIChpPTAgOyBpPGNvbnRleHRfbnVtQml0cyA7IGkrKykge1xuICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgKHZhbHVlJjEpO1xuICAgICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgPj4gMTtcbiAgICAgICAgICB9XG5cblxuICAgICAgICB9XG4gICAgICAgIGNvbnRleHRfZW5sYXJnZUluLS07XG4gICAgICAgIGlmIChjb250ZXh0X2VubGFyZ2VJbiA9PSAwKSB7XG4gICAgICAgICAgY29udGV4dF9lbmxhcmdlSW4gPSBNYXRoLnBvdygyLCBjb250ZXh0X251bUJpdHMpO1xuICAgICAgICAgIGNvbnRleHRfbnVtQml0cysrO1xuICAgICAgICB9XG4gICAgICAgIC8vIEFkZCB3YyB0byB0aGUgZGljdGlvbmFyeS5cbiAgICAgICAgY29udGV4dF9kaWN0aW9uYXJ5W2NvbnRleHRfd2NdID0gY29udGV4dF9kaWN0U2l6ZSsrO1xuICAgICAgICBjb250ZXh0X3cgPSBTdHJpbmcoY29udGV4dF9jKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPdXRwdXQgdGhlIGNvZGUgZm9yIHcuXG4gICAgaWYgKGNvbnRleHRfdyAhPT0gXCJcIikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb250ZXh0X2RpY3Rpb25hcnlUb0NyZWF0ZSxjb250ZXh0X3cpKSB7XG4gICAgICAgIGlmIChjb250ZXh0X3cuY2hhckNvZGVBdCgwKTwyNTYpIHtcbiAgICAgICAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSk7XG4gICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHRfdy5jaGFyQ29kZUF0KDApO1xuICAgICAgICAgIGZvciAoaT0wIDsgaTw4IDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gKGNvbnRleHRfZGF0YV92YWwgPDwgMSkgfCAodmFsdWUmMSk7XG4gICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IDE7XG4gICAgICAgICAgZm9yIChpPTAgOyBpPGNvbnRleHRfbnVtQml0cyA7IGkrKykge1xuICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgdmFsdWU7XG4gICAgICAgICAgICBpZiAoY29udGV4dF9kYXRhX3Bvc2l0aW9uID09IGJpdHNQZXJDaGFyLTEpIHtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhLnB1c2goZ2V0Q2hhckZyb21JbnQoY29udGV4dF9kYXRhX3ZhbCkpO1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfdmFsID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbisrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHRfdy5jaGFyQ29kZUF0KDApO1xuICAgICAgICAgIGZvciAoaT0wIDsgaTwxNiA7IGkrKykge1xuICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgKHZhbHVlJjEpO1xuICAgICAgICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgPj4gMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dF9lbmxhcmdlSW4tLTtcbiAgICAgICAgaWYgKGNvbnRleHRfZW5sYXJnZUluID09IDApIHtcbiAgICAgICAgICBjb250ZXh0X2VubGFyZ2VJbiA9IE1hdGgucG93KDIsIGNvbnRleHRfbnVtQml0cyk7XG4gICAgICAgICAgY29udGV4dF9udW1CaXRzKys7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGNvbnRleHRfZGljdGlvbmFyeVRvQ3JlYXRlW2NvbnRleHRfd107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IGNvbnRleHRfZGljdGlvbmFyeVtjb250ZXh0X3ddO1xuICAgICAgICBmb3IgKGk9MCA7IGk8Y29udGV4dF9udW1CaXRzIDsgaSsrKSB7XG4gICAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgKHZhbHVlJjEpO1xuICAgICAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICAgICAgY29udGV4dF9kYXRhX3Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFsdWUgPSB2YWx1ZSA+PiAxO1xuICAgICAgICB9XG5cblxuICAgICAgfVxuICAgICAgY29udGV4dF9lbmxhcmdlSW4tLTtcbiAgICAgIGlmIChjb250ZXh0X2VubGFyZ2VJbiA9PSAwKSB7XG4gICAgICAgIGNvbnRleHRfZW5sYXJnZUluID0gTWF0aC5wb3coMiwgY29udGV4dF9udW1CaXRzKTtcbiAgICAgICAgY29udGV4dF9udW1CaXRzKys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFyayB0aGUgZW5kIG9mIHRoZSBzdHJlYW1cbiAgICB2YWx1ZSA9IDI7XG4gICAgZm9yIChpPTAgOyBpPGNvbnRleHRfbnVtQml0cyA7IGkrKykge1xuICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IChjb250ZXh0X2RhdGFfdmFsIDw8IDEpIHwgKHZhbHVlJjEpO1xuICAgICAgaWYgKGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9PSBiaXRzUGVyQ2hhci0xKSB7XG4gICAgICAgIGNvbnRleHRfZGF0YV9wb3NpdGlvbiA9IDA7XG4gICAgICAgIGNvbnRleHRfZGF0YS5wdXNoKGdldENoYXJGcm9tSW50KGNvbnRleHRfZGF0YV92YWwpKTtcbiAgICAgICAgY29udGV4dF9kYXRhX3ZhbCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICAgIH1cbiAgICAgIHZhbHVlID0gdmFsdWUgPj4gMTtcbiAgICB9XG5cbiAgICAvLyBGbHVzaCB0aGUgbGFzdCBjaGFyXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnRleHRfZGF0YV92YWwgPSAoY29udGV4dF9kYXRhX3ZhbCA8PCAxKTtcbiAgICAgIGlmIChjb250ZXh0X2RhdGFfcG9zaXRpb24gPT0gYml0c1BlckNoYXItMSkge1xuICAgICAgICBjb250ZXh0X2RhdGEucHVzaChnZXRDaGFyRnJvbUludChjb250ZXh0X2RhdGFfdmFsKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgZWxzZSBjb250ZXh0X2RhdGFfcG9zaXRpb24rKztcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRleHRfZGF0YS5qb2luKCcnKTtcbiAgfSxcblxuICBkZWNvbXByZXNzOiBmdW5jdGlvbiAoY29tcHJlc3NlZCkge1xuICAgIGlmIChjb21wcmVzc2VkID09IG51bGwpIHJldHVybiBcIlwiO1xuICAgIGlmIChjb21wcmVzc2VkID09IFwiXCIpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBMWlN0cmluZy5fZGVjb21wcmVzcyhjb21wcmVzc2VkLmxlbmd0aCwgMzI3NjgsIGZ1bmN0aW9uKGluZGV4KSB7IHJldHVybiBjb21wcmVzc2VkLmNoYXJDb2RlQXQoaW5kZXgpOyB9KTtcbiAgfSxcblxuICBfZGVjb21wcmVzczogZnVuY3Rpb24gKGxlbmd0aCwgcmVzZXRWYWx1ZSwgZ2V0TmV4dFZhbHVlKSB7XG4gICAgdmFyIGRpY3Rpb25hcnkgPSBbXSxcbiAgICAgICAgbmV4dCxcbiAgICAgICAgZW5sYXJnZUluID0gNCxcbiAgICAgICAgZGljdFNpemUgPSA0LFxuICAgICAgICBudW1CaXRzID0gMyxcbiAgICAgICAgZW50cnkgPSBcIlwiLFxuICAgICAgICByZXN1bHQgPSBbXSxcbiAgICAgICAgaSxcbiAgICAgICAgdyxcbiAgICAgICAgYml0cywgcmVzYiwgbWF4cG93ZXIsIHBvd2VyLFxuICAgICAgICBjLFxuICAgICAgICBkYXRhID0ge3ZhbDpnZXROZXh0VmFsdWUoMCksIHBvc2l0aW9uOnJlc2V0VmFsdWUsIGluZGV4OjF9O1xuXG4gICAgZm9yIChpID0gMDsgaSA8IDM7IGkgKz0gMSkge1xuICAgICAgZGljdGlvbmFyeVtpXSA9IGk7XG4gICAgfVxuXG4gICAgYml0cyA9IDA7XG4gICAgbWF4cG93ZXIgPSBNYXRoLnBvdygyLDIpO1xuICAgIHBvd2VyPTE7XG4gICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgcmVzYiA9IGRhdGEudmFsICYgZGF0YS5wb3NpdGlvbjtcbiAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgIGRhdGEucG9zaXRpb24gPSByZXNldFZhbHVlO1xuICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgfVxuICAgICAgYml0cyB8PSAocmVzYj4wID8gMSA6IDApICogcG93ZXI7XG4gICAgICBwb3dlciA8PD0gMTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKG5leHQgPSBiaXRzKSB7XG4gICAgICBjYXNlIDA6XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgbWF4cG93ZXIgPSBNYXRoLnBvdygyLDgpO1xuICAgICAgICAgIHBvd2VyPTE7XG4gICAgICAgICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgICAgICAgcmVzYiA9IGRhdGEudmFsICYgZGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICAgICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPSByZXNldFZhbHVlO1xuICAgICAgICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYml0cyB8PSAocmVzYj4wID8gMSA6IDApICogcG93ZXI7XG4gICAgICAgICAgICBwb3dlciA8PD0gMTtcbiAgICAgICAgICB9XG4gICAgICAgIGMgPSBmKGJpdHMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICBtYXhwb3dlciA9IE1hdGgucG93KDIsMTYpO1xuICAgICAgICAgIHBvd2VyPTE7XG4gICAgICAgICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgICAgICAgcmVzYiA9IGRhdGEudmFsICYgZGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICAgICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPSByZXNldFZhbHVlO1xuICAgICAgICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYml0cyB8PSAocmVzYj4wID8gMSA6IDApICogcG93ZXI7XG4gICAgICAgICAgICBwb3dlciA8PD0gMTtcbiAgICAgICAgICB9XG4gICAgICAgIGMgPSBmKGJpdHMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfVxuICAgIGRpY3Rpb25hcnlbM10gPSBjO1xuICAgIHcgPSBjO1xuICAgIHJlc3VsdC5wdXNoKGMpO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoZGF0YS5pbmRleCA+IGxlbmd0aCkge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgIH1cblxuICAgICAgYml0cyA9IDA7XG4gICAgICBtYXhwb3dlciA9IE1hdGgucG93KDIsbnVtQml0cyk7XG4gICAgICBwb3dlcj0xO1xuICAgICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgICByZXNiID0gZGF0YS52YWwgJiBkYXRhLnBvc2l0aW9uO1xuICAgICAgICBkYXRhLnBvc2l0aW9uID4+PSAxO1xuICAgICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgICAgZGF0YS5wb3NpdGlvbiA9IHJlc2V0VmFsdWU7XG4gICAgICAgICAgZGF0YS52YWwgPSBnZXROZXh0VmFsdWUoZGF0YS5pbmRleCsrKTtcbiAgICAgICAgfVxuICAgICAgICBiaXRzIHw9IChyZXNiPjAgPyAxIDogMCkgKiBwb3dlcjtcbiAgICAgICAgcG93ZXIgPDw9IDE7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAoYyA9IGJpdHMpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIG1heHBvd2VyID0gTWF0aC5wb3coMiw4KTtcbiAgICAgICAgICBwb3dlcj0xO1xuICAgICAgICAgIHdoaWxlIChwb3dlciE9bWF4cG93ZXIpIHtcbiAgICAgICAgICAgIHJlc2IgPSBkYXRhLnZhbCAmIGRhdGEucG9zaXRpb247XG4gICAgICAgICAgICBkYXRhLnBvc2l0aW9uID4+PSAxO1xuICAgICAgICAgICAgaWYgKGRhdGEucG9zaXRpb24gPT0gMCkge1xuICAgICAgICAgICAgICBkYXRhLnBvc2l0aW9uID0gcmVzZXRWYWx1ZTtcbiAgICAgICAgICAgICAgZGF0YS52YWwgPSBnZXROZXh0VmFsdWUoZGF0YS5pbmRleCsrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpdHMgfD0gKHJlc2I+MCA/IDEgOiAwKSAqIHBvd2VyO1xuICAgICAgICAgICAgcG93ZXIgPDw9IDE7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGljdGlvbmFyeVtkaWN0U2l6ZSsrXSA9IGYoYml0cyk7XG4gICAgICAgICAgYyA9IGRpY3RTaXplLTE7XG4gICAgICAgICAgZW5sYXJnZUluLS07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICBtYXhwb3dlciA9IE1hdGgucG93KDIsMTYpO1xuICAgICAgICAgIHBvd2VyPTE7XG4gICAgICAgICAgd2hpbGUgKHBvd2VyIT1tYXhwb3dlcikge1xuICAgICAgICAgICAgcmVzYiA9IGRhdGEudmFsICYgZGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPj49IDE7XG4gICAgICAgICAgICBpZiAoZGF0YS5wb3NpdGlvbiA9PSAwKSB7XG4gICAgICAgICAgICAgIGRhdGEucG9zaXRpb24gPSByZXNldFZhbHVlO1xuICAgICAgICAgICAgICBkYXRhLnZhbCA9IGdldE5leHRWYWx1ZShkYXRhLmluZGV4KyspO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYml0cyB8PSAocmVzYj4wID8gMSA6IDApICogcG93ZXI7XG4gICAgICAgICAgICBwb3dlciA8PD0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGljdGlvbmFyeVtkaWN0U2l6ZSsrXSA9IGYoYml0cyk7XG4gICAgICAgICAgYyA9IGRpY3RTaXplLTE7XG4gICAgICAgICAgZW5sYXJnZUluLS07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LmpvaW4oJycpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZW5sYXJnZUluID09IDApIHtcbiAgICAgICAgZW5sYXJnZUluID0gTWF0aC5wb3coMiwgbnVtQml0cyk7XG4gICAgICAgIG51bUJpdHMrKztcbiAgICAgIH1cblxuICAgICAgaWYgKGRpY3Rpb25hcnlbY10pIHtcbiAgICAgICAgZW50cnkgPSBkaWN0aW9uYXJ5W2NdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGMgPT09IGRpY3RTaXplKSB7XG4gICAgICAgICAgZW50cnkgPSB3ICsgdy5jaGFyQXQoMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJlc3VsdC5wdXNoKGVudHJ5KTtcblxuICAgICAgLy8gQWRkIHcrZW50cnlbMF0gdG8gdGhlIGRpY3Rpb25hcnkuXG4gICAgICBkaWN0aW9uYXJ5W2RpY3RTaXplKytdID0gdyArIGVudHJ5LmNoYXJBdCgwKTtcbiAgICAgIGVubGFyZ2VJbi0tO1xuXG4gICAgICB3ID0gZW50cnk7XG5cbiAgICAgIGlmIChlbmxhcmdlSW4gPT0gMCkge1xuICAgICAgICBlbmxhcmdlSW4gPSBNYXRoLnBvdygyLCBudW1CaXRzKTtcbiAgICAgICAgbnVtQml0cysrO1xuICAgICAgfVxuXG4gICAgfVxuICB9XG59O1xuICByZXR1cm4gTFpTdHJpbmc7XG59KSgpO1xuXG5pZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gIGRlZmluZShmdW5jdGlvbiAoKSB7IHJldHVybiBMWlN0cmluZzsgfSk7XG59IGVsc2UgaWYoIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZSAhPSBudWxsICkge1xuICBtb2R1bGUuZXhwb3J0cyA9IExaU3RyaW5nXG59IGVsc2UgaWYoIHR5cGVvZiBhbmd1bGFyICE9PSAndW5kZWZpbmVkJyAmJiBhbmd1bGFyICE9IG51bGwgKSB7XG4gIGFuZ3VsYXIubW9kdWxlKCdMWlN0cmluZycsIFtdKVxuICAuZmFjdG9yeSgnTFpTdHJpbmcnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIExaU3RyaW5nO1xuICB9KTtcbn1cbiIsImltcG9ydCBDYXRhbG9ndWUgZnJvbSBcIi4uL2NhdGFsb2d1ZS9jYXRhbG9ndWVcIjtcclxuaW1wb3J0IEJhciBmcm9tIFwiLi4vY29tbW9uL2Jhci9iYXJcIjtcclxuaW1wb3J0IHsgQm9vaywgQ2F0YWxvZ3VlSXRlbSwgY2hhbmdlVmFsdWVXaXRoTmV3T2JqLCBQcm9ncmVzcyB9IGZyb20gXCIuLi9jb21tb24vY29tbW9uXCI7XHJcbmltcG9ydCBQYWdpbmF0aW9uIGZyb20gXCIuLi9jb21tb24vcGFnaW5hdGlvbi9wYWdpbmF0aW9uXCI7XHJcblxyXG5jbGFzcyBBcnRpY2xlIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG4gICAgYmFyOiBCYXI7XHJcbiAgICBwYWdpbmF0aW9uOiBQYWdpbmF0aW9uO1xyXG5cclxuICAgIGN1cnJlbnRCb29rOiBCb29rO1xyXG5cclxuICAgIHByb2dyZXNzOiBQcm9ncmVzcztcclxuXHJcbiAgICBjYXRhbG9ndWU6IENhdGFsb2d1ZUl0ZW1bXSA9IFtdO1xyXG5cclxuICAgIGNvbnRlbnQ6IHN0cmluZztcclxuXHJcbiAgICBsb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnBhZ2UuYXJ0aWNsZScpO1xyXG5cclxuICAgICAgICB0aGlzLnBhZ2luYXRpb24gPSBuZXcgUGFnaW5hdGlvbih7XHJcbiAgICAgICAgICAgIHJvb3Q6IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuY29udGVudCcpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5iYXIgPSBuZXcgQmFyKHtcclxuICAgICAgICAgICAgZWxlbWVudDogdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5iYXInKSxcclxuICAgICAgICAgICAgcGFnaW5hdGlvbjogdGhpcy5wYWdpbmF0aW9uXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuY29udGVudC1pbm5lcicpLCB0aGlzLCAnY29udGVudCcsIChjb250ZW50OiBzdHJpbmcpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFjb250ZW50KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldCBodG1sID0gYFxyXG4gICAgICAgICAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAgICAgPC9zdHlsZT5cclxuICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgY29udGVudC5zcGxpdCgnXFxuJykubWFwKHYgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHYudHJpbSgpXHJcbiAgICAgICAgICAgIH0pLmZpbHRlcih2ID0+ICEhdikuZm9yRWFjaCh2ID0+IHtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxwPiR7dn08L3A+XHJcbiAgICAgICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYWdpbmF0aW9uLmNoZWNrUGFnZSgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRQYWdlQnlQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmQodGhpcywgJ3Byb2dyZXNzJywgKG5ld1Y6IGFueSwgb2xkVjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghb2xkVikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXRPYmooYHBfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWAsIG5ld1YpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wcm9ncmVzcy5wb3MgPiB0aGlzLmNvbnRlbnQubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgd2luZG93LkFwaS5zYXZlUHJvZ3Jlc3ModGhpcy5jdXJyZW50Qm9vaywgdGhpcy5wcm9ncmVzcyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnQ6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW50LWluZm8nKTtcclxuICAgICAgICBjb25zdCBjaGFuZ2VJbmZvID0gKCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gYCR7dGhpcy5jdXJyZW50Qm9vaz8ubmFtZX0gLSAke3RoaXMuY3VycmVudEJvb2s/LmF1dGhvcn0gLSAke3RoaXMucHJvZ3Jlc3M/LnRpdGxlfWA7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhjdXJyZW50LCB0aGlzLCAnY3VycmVudEJvb2snLCBjaGFuZ2VJbmZvKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhjdXJyZW50LCB0aGlzLCAncHJvZ3Jlc3MnLCBjaGFuZ2VJbmZvKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhjdXJyZW50LCB0aGlzLCAnY2F0YWxvZ3VlJywgY2hhbmdlSW5mbyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IGNvbnRlbnQ6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50Jyk7XHJcbiAgICAgICAgbGV0IGNvbnRlbnRJbm5lcjogSFRNTEVsZW1lbnQgPSBjb250ZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50LWlubmVyJyk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFN0eWxlKGNvbnRlbnRJbm5lciwgd2luZG93LkxheW91dCwgJ2ZvbnRTaXplJywgJ2ZvbnRTaXplJywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRTdHlsZShjb250ZW50SW5uZXIsIHdpbmRvdy5MYXlvdXQsICdsaW5lSGVpZ2h0JywgJ2xpbmVIZWlnaHQnLCAodjogYW55KSA9PiBgJHt2fXB4YCk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFN0eWxlKGNvbnRlbnQsIHdpbmRvdy5MYXlvdXQsICdsaW5lSGVpZ2h0JywgJ2hlaWdodCcsICh2OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmVsZW1lbnQub2Zmc2V0SGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IGJhc2UgPSB0aGlzLmVsZW1lbnQub2Zmc2V0SGVpZ2h0IC0gMjMwIC0gMjA7XHJcbiAgICAgICAgICAgIGxldCBvbyA9IGJhc2UgJSB3aW5kb3cuTGF5b3V0LmxpbmVIZWlnaHQ7XHJcbiAgICAgICAgICAgIGlmIChvbyA8IDEwKSB7XHJcbiAgICAgICAgICAgICAgICBvbyArPSB3aW5kb3cuTGF5b3V0LmxpbmVIZWlnaHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IGhlaWdodCA9IGJhc2UgLSBvbyArIDIwO1xyXG4gICAgICAgICAgICBjdXJyZW50LnN0eWxlLmhlaWdodCA9IGAke29vfXB4YDtcclxuICAgICAgICAgICAgY3VycmVudC5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7b299cHhgO1xyXG4gICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLnBhZ2luYXRpb24uY2hlY2tQYWdlKCkpO1xyXG4gICAgICAgICAgICByZXR1cm4gYCR7aGVpZ2h0fXB4YDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgbGV0IGZ1bmMgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjdXJyZW50ID0gd2luZG93LlN0b3JlLmdldCgnY3VycmVudCcpO1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRCb29rID0gd2luZG93LkJvb2tTaGVsZi5ib29rTWFwW2N1cnJlbnRdO1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudEJvb2spIHtcclxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cuUm91dGVyLmN1cnJlbnQgPT09ICdhcnRpY2xlJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5Sb3V0ZXIuZ28oJ2Jvb2tzaGVsZicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB3aW5kb3cuTGF5b3V0LmxpbmVIZWlnaHQgPSB3aW5kb3cuTGF5b3V0LmxpbmVIZWlnaHQ7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmNhdGFsb2d1ZSA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYGNfJHtjdXJyZW50fWApIHx8IFtdO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5wcm9ncmVzcyA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYHBfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWApO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5nZXRDb250ZW50KCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgd2luZG93LlJvdXRlci5jYk1hcC5hcnRpY2xlID0gZnVuYztcclxuICAgICAgICBmdW5jKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Q29udGVudCgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnQgPSB3aW5kb3cuU3RvcmUuZ2V0KGBhXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1fJHt0aGlzLnByb2dyZXNzLmluZGV4fWApIHx8ICcnO1xyXG4gICAgICAgIGxldCBjYiA9ICgpID0+IHtcclxuICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgd2luZG93LkNhdGFsb2d1ZT8uZG9DYWNoZSg1KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBpZiAoIXRoaXMuY29udGVudCkge1xyXG4gICAgICAgICAgICB0aGlzLmdldEFydGljbGUoY2IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNiKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHBhZ2VDaGFuZ2UobnVtOiAxIHwgLTEpOiB2b2lkICB7XHJcbiAgICAgICAgbGV0IHRhcmdldCA9IHRoaXMucGFnaW5hdGlvbi5wYWdlSW5kZXggKyBudW07XHJcbiAgICAgICAgaWYgKHRhcmdldCA8IDAgfHwgdGFyZ2V0ID49IHRoaXMucGFnaW5hdGlvbi5wYWdlTGltaXQpIHtcclxuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5wcm9ncmVzcy5pbmRleCArIG51bTtcclxuICAgICAgICAgICAgbGV0IHBvcyA9IG51bSA9PT0gLTE/OTk5OTk5OTk5OTk5OjA7Ly8gdG8gdGhlIGVuZFxyXG4gICAgICAgICAgICB0aGlzLnByb2dyZXNzID0gY2hhbmdlVmFsdWVXaXRoTmV3T2JqKHRoaXMucHJvZ3Jlc3MsIHtpbmRleDogaW5kZXgsIHRpdGxlOiB0aGlzLmNhdGFsb2d1ZVtpbmRleF0udGl0bGUsIHRpbWU6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLCBwb3M6IHBvc30pO1xyXG4gICAgICAgICAgICB0aGlzLmdldENvbnRlbnQoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnBhZ2luYXRpb24uc2V0UGFnZSh0YXJnZXQpO1xyXG4gICAgICAgICAgICB0aGlzLmdldFBhZ2VQb3ModGFyZ2V0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0UGFnZVBvcyh0YXJnZXQ6IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIGxldCB0b3AgPSB0YXJnZXQgKiB0aGlzLnBhZ2luYXRpb24ucGFnZVN0ZXA7XHJcbiAgICAgICAgbGV0IHBzID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb250ZW50LWlubmVyIHAnKTtcclxuICAgICAgICBsZXQgc3RyID0gJyc7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoKHBzW2ldIGFzIEhUTUxFbGVtZW50KS5vZmZzZXRUb3AgPj0gdG9wKSB7XHJcbiAgICAgICAgICAgICAgICBzdHIgPSBwc1tpXS5pbm5lckhUTUw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgcG9zID0gdGhpcy5jb250ZW50LmluZGV4T2Yoc3RyKTtcclxuICAgICAgICB0aGlzLnByb2dyZXNzID0gY2hhbmdlVmFsdWVXaXRoTmV3T2JqKHRoaXMucHJvZ3Jlc3MsIHt0aW1lOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSwgcG9zOiBwb3N9KTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRQYWdlQnlQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBsZXQgdGFyZ2V0ID0gdGhpcy5jb250ZW50LnNsaWNlKDAsIHRoaXMucHJvZ3Jlc3MucG9zKS5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMTtcclxuICAgICAgICBsZXQgZWxlOiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udGVudC1pbm5lciBwJylbdGFyZ2V0XSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBsZXQgdG9wID0gZWxlLm9mZnNldFRvcDtcclxuICAgICAgICBsZXQgaW5kZXggPSBNYXRoLmZsb29yKHRvcCAvIHRoaXMucGFnaW5hdGlvbi5wYWdlU3RlcCk7XHJcbiAgICAgICAgdGhpcy5wYWdpbmF0aW9uLnNldFBhZ2UoaW5kZXgpO1xyXG4gICAgICAgIGlmICh0aGlzLnByb2dyZXNzLnBvcyA+IHRoaXMuY29udGVudC5sZW5ndGgpIHsvL3Jlc2V0IHRvIHJpZ2h0XHJcbiAgICAgICAgICAgIHRoaXMuZ2V0UGFnZVBvcyhpbmRleCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGdldEFydGljbGUoY2I/OiBGdW5jdGlvbik6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmxvYWRpbmcgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtjb250ZW50OiAn5q2j5Zyo5Yqg6L2956ug6IqC5YaF5a65J30pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubG9hZGluZyA9IHRydWU7XHJcbiAgICAgICAgd2luZG93LkFwaS5nZXRBcnRpY2xlKHRoaXMuY3VycmVudEJvb2suc291cmNlLCB0aGlzLnByb2dyZXNzLmluZGV4LCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChyZXM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSByZXMuZGF0YTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXQoYGFfJHt0aGlzLmN1cnJlbnRCb29rLmlkfV8ke3RoaXMucHJvZ3Jlc3MuaW5kZXh9YCwgdGhpcy5jb250ZW50KTtcclxuICAgICAgICAgICAgICAgIGNiICYmIGNiKCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBBcnRpY2xlOyIsImltcG9ydCBCYXIgZnJvbSAnLi4vY29tbW9uL2Jhci9iYXInO1xyXG5pbXBvcnQgeyBCb29rLCBnZXRPYmplY3QsIGdldFNwZWNpYWxQYXJlbnQsIFByb2dyZXNzIH0gZnJvbSAnLi4vY29tbW9uL2NvbW1vbic7XHJcbmltcG9ydCBQYWdpbmF0aW9uIGZyb20gJy4uL2NvbW1vbi9wYWdpbmF0aW9uL3BhZ2luYXRpb24nO1xyXG5cclxuY2xhc3MgQm9va1NoZWxmIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG4gICAgYmFyOiBCYXI7XHJcbiAgICBwYWdpbmF0aW9uOiBQYWdpbmF0aW9uO1xyXG5cclxuICAgIGJvb2tNYXA6IHtba2V5OiBzdHJpbmddOiBCb29rfSA9IHt9O1xyXG4gICAgYm9va0xpc3Q6IEJvb2tbXSA9IFtdO1xyXG5cclxuXHJcbiAgICBsb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgcGFnZUhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wYWdlLmJvb2tzaGVsZicpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMucGFnaW5hdGlvbiA9IG5ldyBQYWdpbmF0aW9uKHtcclxuICAgICAgICAgICAgcm9vdDogdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50JylcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmJhciA9IG5ldyBCYXIoe1xyXG4gICAgICAgICAgICBlbGVtZW50OiB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJhcicpLFxyXG4gICAgICAgICAgICBwYWdpbmF0aW9uOiB0aGlzLnBhZ2luYXRpb25cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5ib29rTGlzdCA9IHdpbmRvdy5TdG9yZS5nZXRPYmooJ2Jvb2tzaGVsZicpIHx8IFtdO1xyXG4gICAgICAgIC8vIHRoaXMuYm9va0xpc3QgPSB3aW5kb3cuU3RvcmUuZ2V0QnlIZWFkKCdiXycpLm1hcCh2ID0+IEpTT04ucGFyc2Uod2luZG93LlN0b3JlLmdldCh2KSB8fCAnJykpOy8vd2FpdFxyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyh0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJvb2stbGlzdCcpLCB0aGlzLCAnYm9va0xpc3QnLCAoYm9va0xpc3Q6IEJvb2tbXSwgb2xkVjogQm9va1tdID0gW10pID0+IHtcclxuICAgICAgICAgICAgdGhpcy5jb21wYXJlQm9va0xpc3QoYm9va0xpc3QsIG9sZFYpO1xyXG4gICAgICAgICAgICBsZXQgaGVpZ2h0ID0gKHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcucGFnaW5hdGlvbi1ib3gnKSBhcyBIVE1MRWxlbWVudCkub2Zmc2V0SGVpZ2h0IC8gNDtcclxuICAgICAgICAgICAgbGV0IGltZ1dpZHRoID0gaGVpZ2h0ICogMyAvIDQ7XHJcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IE1hdGguZmxvb3IoKHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYm9vay1saXN0JykgYXMgSFRNTEVsZW1lbnQpLm9mZnNldFdpZHRoIC8gMik7XHJcbiAgICAgICAgICAgIGxldCBodG1sID0gYFxyXG4gICAgICAgICAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAgICAgICAgIC5ib29rLWl0ZW0ge2hlaWdodDogJHtoZWlnaHR9cHg7fVxyXG4gICAgICAgICAgICAgICAgICAgIC5ib29rLWl0ZW0gLmJvb2stY292ZXIge3dpZHRoOiAke2ltZ1dpZHRofXB4O31cclxuICAgICAgICAgICAgICAgICAgICAuYm9vay1pdGVtIC5ib29rLWluZm8ge3dpZHRoOiAke3dpZHRoIC0gaW1nV2lkdGggLSAzMH1weDt9XHJcbiAgICAgICAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICBib29rTGlzdC5mb3JFYWNoKGJvb2sgPT4ge1xyXG4gICAgICAgICAgICAgICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShib29rLmxhdGVzdENoYXB0ZXJUaW1lKTtcclxuICAgICAgICAgICAgICAgIGxldCBwcm9ncmVzczogUHJvZ3Jlc3MgPSB3aW5kb3cuU3RvcmUuZ2V0T2JqKGBwXyR7Ym9vay5pZH1gKTtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWl0ZW1cIiBrZXk9XCIke2Jvb2suaWR9XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWNvdmVyXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOiB1cmwoJHtib29rLmN1c3RvbUNvdmVyVXJsfSk7XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIHNyYz1cIiR7Ym9vay5jb3ZlclVybH1cIiBhbHQ9XCIke2Jvb2submFtZX1cIi8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9vay1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9vay1uYW1lXCI+JHtib29rLm5hbWV9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9vay1hdXRob3JcIj4ke2Jvb2suYXV0aG9yfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJvb2stZHVyXCI+JHtwcm9ncmVzcy50aXRsZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJib29rLWxhdGVzdFwiPiR7Ym9vay5sYXRlc3RDaGFwdGVyVGl0bGV9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYm9vay1sYXRlc3QtdGltZVwiPuabtOaWsOaXtumXtO+8miR7ZGF0ZS5nZXRGdWxsWWVhcigpfS0ke2RhdGUuZ2V0TW9udGgoKSArIDF9LSR7ZGF0ZS5nZXREYXkoKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wYWdpbmF0aW9uLmNoZWNrUGFnZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGh0bWw7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIuY2JNYXAuYm9va3NoZWxmID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmJvb2tMaXN0ID0gW10uY29uY2F0KHRoaXMuYm9va0xpc3QpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGJvb2tEZWxldGUoYm9vazogQm9vaywgb25seVNvdXJjZT86IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIW9ubHlTb3VyY2UpIHtcclxuICAgICAgICAgICAgd2luZG93LlN0b3JlLmRlbChgcF8ke2Jvb2suaWR9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5TdG9yZS5kZWwoYGNfJHtib29rLmlkfWApO1xyXG4gICAgICAgIHdpbmRvdy5TdG9yZS5nZXRCeUhlYWQoYGFfJHtib29rLmlkfWApLmZvckVhY2godiA9PiB3aW5kb3cuU3RvcmUuZGVsKHYpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb21wYXJlQm9va0xpc3QobmV3VjogQm9va1tdLCBvbGRWOiBCb29rW10pOiB2b2lkIHtcclxuICAgICAgICBsZXQgb2xkTWFwID0gdGhpcy5ib29rTWFwO1xyXG4gICAgICAgIHRoaXMuYm9va01hcCA9IHt9O1xyXG4gICAgICAgIG5ld1YuZm9yRWFjaChib29rID0+IHtcclxuICAgICAgICAgICAgdGhpcy5ib29rTWFwW2Jvb2suaWRdID0gYm9vaztcclxuICAgICAgICAgICAgaWYgKG9sZE1hcFtib29rLmlkXSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGJvb2suc291cmNlICE9PSBvbGRNYXBbYm9vay5pZF0uc291cmNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ib29rRGVsZXRlKG9sZE1hcFtib29rLmlkXSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgb2xkTWFwW2Jvb2suaWRdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgT2JqZWN0LmtleXMob2xkTWFwKS5mb3JFYWNoKChpZDogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuYm9va0RlbGV0ZShvbGRNYXBbaWRdKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRCb29rU2hlbGYoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMubG9hZGluZyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmraPlnKjliqDovb3kuabmnrbmlbDmja4nfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2FkaW5nID0gdHJ1ZTtcclxuICAgICAgICB3aW5kb3cuQXBpLmdldEJvb2tzaGVsZih7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChyZXM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBsZXQgYm9va0xpc3Q6IEJvb2tbXSA9IHJlcy5kYXRhLm1hcCgoYm9vazogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGlkID0gd2luZG93LlN0b3JlLmNvbXByZXNzKGAke2Jvb2submFtZX1fJHtib29rLmF1dGhvcn1gKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQga2V5czogc3RyaW5nW10gPSBbJ25hbWUnLCAnYXV0aG9yJywgJ2NvdmVyVXJsJywgJ2N1c3RvbUNvdmVyVXJsJywgJ2xhdGVzdENoYXB0ZXJUaW1lJywgJ2xhdGVzdENoYXB0ZXJUaXRsZSddO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBwb2JqOiBQcm9ncmVzcyA9IGdldE9iamVjdChib29rLCBbXSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogYm9vay5kdXJDaGFwdGVySW5kZXgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvczogYm9vay5kdXJDaGFwdGVyUG9zLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZShib29rLmR1ckNoYXB0ZXJUaW1lKS5nZXRUaW1lKCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBib29rLmR1ckNoYXB0ZXJUaXRsZVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBvbGQgPSB3aW5kb3cuU3RvcmUuZ2V0T2JqKGBwXyR7aWR9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvbGQgfHwgb2xkLnRpbWUgPCBwb2JqLnRpbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LlN0b3JlLnNldE9iaihgcF8ke2lkfWAsIHBvYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T2JqZWN0KGJvb2ssIGtleXMsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGlkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IGJvb2suYm9va1VybFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJvb2tMaXN0ID0gW10uY29uY2F0KGJvb2tMaXN0KTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXRPYmooJ2Jvb2tzaGVsZicsIHRoaXMuYm9va0xpc3QpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNsaWNrSXRlbShldmVudDogRXZlbnQpOiB2b2lkIHtcclxuICAgICAgICBsZXQgaXRlbSA9IGdldFNwZWNpYWxQYXJlbnQoKGV2ZW50LnRhcmdldCB8fCBldmVudC5zcmNFbGVtZW50KSBhcyBIVE1MRWxlbWVudCwgKGVsZTogSFRNTEVsZW1lbnQpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGVsZS5jbGFzc0xpc3QuY29udGFpbnMoJ2Jvb2staXRlbScpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGxldCBpZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdrZXknKTtcclxuICAgICAgICB3aW5kb3cuU3RvcmUuc2V0KCdjdXJyZW50JywgaWQpO1xyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIuZ28oJ2FydGljbGUnKTtcclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEJvb2tTaGVsZjsiLCJpbXBvcnQgQmFyIGZyb20gXCIuLi9jb21tb24vYmFyL2JhclwiO1xyXG5pbXBvcnQgeyBCb29rLCBDYXRhbG9ndWVJdGVtLCBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmosIGdldFNwZWNpYWxQYXJlbnQsIFByb2dyZXNzIH0gZnJvbSBcIi4uL2NvbW1vbi9jb21tb25cIjtcclxuaW1wb3J0IFBhZ2luYXRpb24gZnJvbSBcIi4uL2NvbW1vbi9wYWdpbmF0aW9uL3BhZ2luYXRpb25cIjtcclxuXHJcbmNsYXNzIENhdGFsb2d1ZSB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuICAgIGJhcjogQmFyO1xyXG4gICAgcGFnaW5hdGlvbjogUGFnaW5hdGlvbjtcclxuXHJcbiAgICBjdXJyZW50Qm9vazogQm9vaztcclxuICAgIHByb2dyZXNzOiBQcm9ncmVzcztcclxuXHJcbiAgICBsaW5lUGVyUGFnZTogbnVtYmVyO1xyXG5cclxuICAgIGxpc3Q6IENhdGFsb2d1ZUl0ZW1bXSA9IFtdO1xyXG4gICAgcGFnZUxpc3Q6IENhdGFsb2d1ZUl0ZW1bXSA9IFtdO1xyXG5cclxuICAgIG9vOiBudW1iZXIgPSAxMDtcclxuXHJcbiAgICBsb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgY2FjaGVGbGFnOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnBhZ2UuY2F0YWxvZ3VlJyk7XHJcblxyXG4gICAgICAgIHRoaXMucGFnaW5hdGlvbiA9IG5ldyBQYWdpbmF0aW9uKHtcclxuICAgICAgICAgICAgcm9vdDogdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50JyksXHJcbiAgICAgICAgICAgIGZha2U6IHRydWUsXHJcbiAgICAgICAgICAgIHBhZ2VDaGFuZ2U6IChpbmRleDogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgc3RhcnQgPSBpbmRleCAqIHRoaXMubGluZVBlclBhZ2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhZ2VMaXN0ID0gdGhpcy5saXN0LnNsaWNlKHN0YXJ0LCBzdGFydCArIHRoaXMubGluZVBlclBhZ2UpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5iYXIgPSBuZXcgQmFyKHtcclxuICAgICAgICAgICAgZWxlbWVudDogdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5iYXInKSxcclxuICAgICAgICAgICAgcGFnaW5hdGlvbjogdGhpcy5wYWdpbmF0aW9uXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnQ6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJyZW50LWluZm8nKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kKHRoaXMsICdsaXN0JywgKGxpc3Q6IENhdGFsb2d1ZUl0ZW1bXSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMubGluZVBlclBhZ2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnBhZ2luYXRpb24uY2hlY2tQYWdlKE1hdGguY2VpbChsaXN0Lmxlbmd0aCAvIHRoaXMubGluZVBlclBhZ2UpKTtcclxuICAgICAgICAgICAgdGhpcy5wYWdpbmF0aW9uLnNldFBhZ2UoTWF0aC5mbG9vcih0aGlzLnByb2dyZXNzLmluZGV4IC8gdGhpcy5saW5lUGVyUGFnZSkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYXJ0aWNsZS1saXN0JyksIHRoaXMsICdwYWdlTGlzdCcsIChsaXN0OiBDYXRhbG9ndWVJdGVtW10pID0+IHtcclxuICAgICAgICAgICAgbGV0IGh0bWwgPSBgXHJcbiAgICAgICAgICAgICAgICA8c3R5bGU+XHJcbiAgICAgICAgICAgICAgICAgICAgLmFydGljbGUtaXRlbSB7bGluZS1oZWlnaHQ6IDgwcHg7fVxyXG4gICAgICAgICAgICAgICAgPC9zdHlsZT5cclxuICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgbGlzdC5mb3JFYWNoKChhcnRpY2xlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgY3VycmVudCA9IGFydGljbGUuaW5kZXggPT09IHRoaXMucHJvZ3Jlc3MuaW5kZXg/J2N1cnJlbnQnOicnO1xyXG4gICAgICAgICAgICAgICAgbGV0IGNhY2hlZCA9IHdpbmRvdy5TdG9yZS5oYXMoYGFfJHt0aGlzLmN1cnJlbnRCb29rLmlkfV8ke2FydGljbGUuaW5kZXh9YCk/J2NhY2hlZCc6Jyc7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IGBcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYXJ0aWNsZS1pdGVtICR7Y3VycmVudH0gJHtjYWNoZWR9XCIga2V5PVwiJHthcnRpY2xlLmluZGV4fVwiPiR7YXJ0aWNsZS50aXRsZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gaHRtbDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFZpZXcoY3VycmVudCwgdGhpcywgJ2N1cnJlbnRCb29rJywgKCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gYCR7dGhpcy5jdXJyZW50Qm9vaz8ubmFtZX0gLSAke3RoaXMuY3VycmVudEJvb2s/LmF1dGhvcn1gO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kKHRoaXMsICdwcm9ncmVzcycsIChuZXdWOiBhbnksIG9sZFY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICB3aW5kb3cuU3RvcmUuc2V0T2JqKGBwXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1gLCBuZXdWKTtcclxuICAgICAgICB9KTtcclxuXHJcblxyXG4gICAgICAgIGxldCBmdW5jID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrQ3VycmVudCgpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5jaGVja0hlaWdodCgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIuY2JNYXAuY2F0YWxvZ3VlID0gZnVuYztcclxuICAgICAgICBmdW5jKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNoZWNrQ3VycmVudCgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmN1cnJlbnRCb29rID0gd2luZG93LkJvb2tTaGVsZi5ib29rTWFwW3dpbmRvdy5TdG9yZS5nZXQoJ2N1cnJlbnQnKV07XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5jdXJyZW50Qm9vaykge1xyXG4gICAgICAgICAgICBpZiAod2luZG93LlJvdXRlci5jdXJyZW50ID09PSAnY2F0YWxvZ3VlJykge1xyXG4gICAgICAgICAgICAgICAgd2luZG93LlJvdXRlci5nbygnYm9va3NoZWxmJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5wcm9ncmVzcyA9IHdpbmRvdy5TdG9yZS5nZXRPYmooYHBfJHt0aGlzLmN1cnJlbnRCb29rLmlkfWApO1xyXG5cclxuICAgICAgICB0aGlzLmxpc3QgPSB3aW5kb3cuU3RvcmUuZ2V0T2JqKGBjXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1gKSB8fCBbXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5saXN0Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmdldENhdGFsb2d1ZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjaGVja0hlaWdodCgpOiB2b2lkIHtcclxuICAgICAgICBsZXQgaGVpZ2h0ID0gdGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCAtIDIzMCAtIDIwO1xyXG4gICAgICAgIGxldCBvbyA9IGhlaWdodCAlIDgwO1xyXG4gICAgICAgIGlmIChvbyA8IDEwKSB7XHJcbiAgICAgICAgICAgIG9vICs9IDgwO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLm9vID0gb287XHJcbiAgICAgICAgdGhpcy5saW5lUGVyUGFnZSA9IE1hdGgucm91bmQoKGhlaWdodCAtIG9vKSAvIDgwKSAqIDI7XHJcbiAgICAgICAgY29uc3QgY3VycmVudDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmN1cnJlbnQtaW5mbycpO1xyXG4gICAgICAgIGNvbnN0IGNvbnRlbnQ6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb250ZW50Jyk7XHJcbiAgICAgICAgY3VycmVudC5zdHlsZS5oZWlnaHQgPSBgJHtvb31weGA7XHJcbiAgICAgICAgY3VycmVudC5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7b299cHhgO1xyXG4gICAgICAgIGNvbnRlbnQuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0IC0gb28gKyAyMH1weGA7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIGdldENhdGFsb2d1ZSgpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5sb2FkaW5nID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+ato+WcqOWKoOi9veebruW9leaVsOaNrid9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxvYWRpbmcgPSB0cnVlO1xyXG4gICAgICAgIHdpbmRvdy5BcGkuZ2V0Q2F0YWxvZ3VlKHRoaXMuY3VycmVudEJvb2suc291cmNlLCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChyZXM6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxpc3QgPSByZXMuZGF0YS5tYXAoKHY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiB2LmluZGV4LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogdi50aXRsZSAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgd2luZG93LlN0b3JlLnNldE9iaihgY18ke3RoaXMuY3VycmVudEJvb2suaWR9YCwgdGhpcy5saXN0KTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjbGlja0l0ZW0oZXZlbnQ6IEV2ZW50KTogdm9pZCB7XHJcbiAgICAgICAgbGV0IGl0ZW0gPSBnZXRTcGVjaWFsUGFyZW50KChldmVudC50YXJnZXQgfHwgZXZlbnQuc3JjRWxlbWVudCkgYXMgSFRNTEVsZW1lbnQsIChlbGU6IEhUTUxFbGVtZW50KSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdhcnRpY2xlLWl0ZW0nKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBsZXQgaW5kZXggPSBwYXJzZUludChpdGVtLmdldEF0dHJpYnV0ZSgna2V5JykpO1xyXG4gICAgICAgIHRoaXMucHJvZ3Jlc3MgPSBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmoodGhpcy5wcm9ncmVzcywge2luZGV4OiBpbmRleCwgdGl0bGU6IHRoaXMubGlzdFtpbmRleF0udGl0bGUsIHRpbWU6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLCBwb3M6IDB9KTtcclxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5Sb3V0ZXIuZ28oJ2FydGljbGUnKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBtYWtlQ2FjaGUoc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpOiB2b2lkIHtcclxuICAgICAgICBpZiAoc3RhcnQgPiBlbmQpIHtcclxuICAgICAgICAgICAgdGhpcy5jYWNoZUZsYWcgPSBmYWxzZTtcclxuICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtcclxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICfnvJPlrZjku7vliqHlrozmiJAnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh3aW5kb3cuU3RvcmUuaGFzKGBhXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1fJHtzdGFydH1gKSkge1xyXG4gICAgICAgICAgICB0aGlzLm1ha2VDYWNoZShzdGFydCArIDEsIGVuZCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93LkFwaS5nZXRBcnRpY2xlKHRoaXMuY3VycmVudEJvb2suc291cmNlLCBzdGFydCwge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiAocmVzOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5TdG9yZS5zZXQoYGFfJHt0aGlzLmN1cnJlbnRCb29rLmlkfV8ke3N0YXJ0fWAsIHJlcy5kYXRhKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKGAuYXJ0aWNsZS1pdGVtW2tleT1cIiR7c3RhcnR9XCJdYCk/LmNsYXNzTGlzdC5hZGQoJ2NhY2hlZCcpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWtlQ2FjaGUoc3RhcnQgKyAxLCBlbmQpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGDnvJPlrZjnq6DoioLjgIoke3RoaXMubGlzdFtzdGFydF0udGl0bGV944CL5aSx6LSlYFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1ha2VDYWNoZShzdGFydCArIDEsIGVuZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkb0NhY2hlKHZhbDogbnVtYmVyIHwgJ2VuZCcgfCAnYWxsJyk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmNhY2hlRmxhZykge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe1xyXG4gICAgICAgICAgICAgICAgY29udGVudDogJ+ato+WcqOe8k+WtmO+8jOivt+WLv+mHjeWkjeaTjeS9nCdcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5jaGVja0N1cnJlbnQoKTtcclxuICAgICAgICB0aGlzLmNhY2hlRmxhZyA9IHRydWU7XHJcbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wcm9ncmVzcz8uaW5kZXg7XHJcbiAgICAgICAgbGV0IGxhc3QgPSB0aGlzLmxpc3RbdGhpcy5saXN0Lmxlbmd0aCAtIDFdPy5pbmRleCB8fCAwO1xyXG4gICAgICAgIGlmICh2YWwgPT09ICdhbGwnKSB7XHJcbiAgICAgICAgICAgIHN0YXJ0ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIGxhc3QgPSBNYXRoLm1pbihsYXN0LCBzdGFydCArIHZhbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWFrZUNhY2hlKHN0YXJ0LCBsYXN0KTtcclxuICAgIH1cclxuXHJcbiAgICBkZWxldGVDYWNoZSh0eXBlOiAncmVhZGVkJyB8ICdhbGwnKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVGbGFnKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiAn5q2j5Zyo57yT5a2Y77yM56aB55So5Yig6Zmk5pON5L2cJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuU3RvcmUuZ2V0QnlIZWFkKGBhXyR7dGhpcy5jdXJyZW50Qm9vay5pZH1fYCkuZmlsdGVyKHYgPT4gISh0eXBlID09PSAncmVhZGVkJyAmJiBwYXJzZUludCh2LnNwbGl0KCdfJylbMl0pID49IHRoaXMucHJvZ3Jlc3MuaW5kZXgpKS5mb3JFYWNoKHYgPT4ge1xyXG4gICAgICAgICAgICB3aW5kb3cuU3RvcmUuZGVsKHYpO1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcihgLmFydGljbGUtaXRlbVtrZXk9XCIke3Yuc3BsaXQoJ18nKVsyXX1cIl1gKT8uY2xhc3NMaXN0LnJlbW92ZSgnY2FjaGVkJyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtcclxuICAgICAgICAgICAgY29udGVudDogJ+WIoOmZpOaMh+Wumue8k+WtmOWujOaIkCdcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjYWNoZSgpOiB2b2lkIHtcclxuICAgICAgICB3aW5kb3cuTW9kYWwuYWRkKHtcclxuICAgICAgICAgICAgY29udGVudDogYFxyXG4gICAgICAgICAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAgICAgICAgIC5tb2RhbC1jb250ZW50IC5idXR0b24ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lLWhlaWdodDogNjBweDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogMjBweDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDQwJTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQ6IGxlZnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogMTBweDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSgyMClcIj7nvJPlrZgyMOeroDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSg1MClcIj7nvJPlrZg1MOeroDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZG9DYWNoZSgxMDApXCI+57yT5a2YMTAw56ugPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kb0NhY2hlKDIwMClcIj7nvJPlrZgyMDDnq6A8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJidXR0b25cIiBvbmNsaWNrPVwiQ2F0YWxvZ3VlLmRvQ2FjaGUoJ2VuZCcpXCI+57yT5a2Y5pyq6K+7PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kb0NhY2hlKCdhbGwnKVwiPue8k+WtmOWFqOaWhzwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvblwiIG9uY2xpY2s9XCJDYXRhbG9ndWUuZGVsZXRlQ2FjaGUoJ3JlYWRlZCcpXCI+5Yig6Zmk5bey6K+7PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnV0dG9uXCIgb25jbGljaz1cIkNhdGFsb2d1ZS5kZWxldGVDYWNoZSgnYWxsJylcIj7liKDpmaTlhajpg6g8L2Rpdj5cclxuICAgICAgICAgICAgYCxcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgQ2F0YWxvZ3VlOyIsImltcG9ydCB7IEJvb2ssIFByb2dyZXNzIH0gZnJvbSBcIi4uL2NvbW1vblwiO1xyXG5cclxuY2xhc3MgQXBpIHtcclxuICAgIHVybDogc3RyaW5nO1xyXG5cclxuICAgIGFwaU1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7XHJcbiAgICAgICAgICAgIGJvb2tzaGVsZjogJy9nZXRCb29rc2hlbGYnLFxyXG4gICAgICAgICAgICBjYXRhbG9ndWU6ICcvZ2V0Q2hhcHRlckxpc3QnLFxyXG4gICAgICAgICAgICBhcnRpY2xlOiAnL2dldEJvb2tDb250ZW50JyxcclxuICAgICAgICAgICAgc2F2ZTogJy9zYXZlQm9va1Byb2dyZXNzJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBfY2hlY2tYSFI6IFhNTEh0dHBSZXF1ZXN0O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuQXBpKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdhcGkgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5BcGkgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLnVybCA9IHdpbmRvdy5TdG9yZS5nZXQoJ3VybCcpIHx8ICcnO1xyXG4gICAgfVxyXG5cclxuICAgIHNhdmVQcm9ncmVzcyhib29rOiBCb29rLCBwcm9ncmVzczogUHJvZ3Jlc3MsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLnBvc3QodGhpcy51cmwgKyB0aGlzLmFwaU1hcC5zYXZlLCB7XHJcbiAgICAgICAgICAgIGF1dGhvcjogYm9vay5hdXRob3IsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJJbmRleDogcHJvZ3Jlc3MuaW5kZXgsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJQb3M6IHByb2dyZXNzLnBvcyxcclxuICAgICAgICAgICAgZHVyQ2hhcHRlclRpbWU6IHByb2dyZXNzLnRpbWUsXHJcbiAgICAgICAgICAgIGR1ckNoYXB0ZXJUaXRsZTogcHJvZ3Jlc3MudGl0bGUsXHJcbiAgICAgICAgICAgIG5hbWU6IGJvb2submFtZVxyXG4gICAgICAgIH0sIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKGRhdGEpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IoZXJyKTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+S/neWtmOmYheivu+i/m+W6puWIsOacjeWKoeerr+Wksei0pSd9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QXJ0aWNsZSh1cmw6IHN0cmluZywgaW5kZXg6IG51bWJlciwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9ufSk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZ2V0KHRoaXMudXJsICsgdGhpcy5hcGlNYXAuYXJ0aWNsZSwge3VybDogdXJsLCBpbmRleDogaW5kZXh9LCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNiICYmIGNiLnN1Y2Nlc3MgJiYgY2Iuc3VjY2VzcyhkYXRhKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXJyb3I6IChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcclxuICAgICAgICAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfojrflj5bnq6DoioLlhoXlrrnlpLHotKUnfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRDYXRhbG9ndWUodXJsOiBzdHJpbmcsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmdldCh0aGlzLnVybCArIHRoaXMuYXBpTWFwLmNhdGFsb2d1ZSwge3VybDogdXJsfSwge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiAoZGF0YTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYi5zdWNjZXNzICYmIGNiLnN1Y2Nlc3MoZGF0YSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgICAgICAgICBjYiAmJiBjYi5lcnJvciAmJiBjYi5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgICAgICAgd2luZG93Lk1lc3NhZ2UuYWRkKHtjb250ZW50OiAn6I635Y+W55uu5b2V5YaF5a655aSx6LSlJ30pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Qm9va3NoZWxmKGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbn0pOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmdldCh0aGlzLnVybCArIHRoaXMuYXBpTWFwLmJvb2tzaGVsZiwge30sIHtcclxuICAgICAgICAgICAgc3VjY2VzczogKGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKGRhdGEpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IoZXJyKTtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+iOt+WPluS5puaetuWGheWuueWksei0pSd9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHBvc3QodXJsOiBzdHJpbmcsIGRhdGE6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbiwgY2hlY2s/OiBib29sZWFufSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmh0dHAoJ1BPU1QnLCB1cmwsIGRhdGEsIGNiKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXQodXJsOiBzdHJpbmcsIGRhdGE6IHsgW2tleTogc3RyaW5nXTogYW55IH0sIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZXJyb3I/OiBGdW5jdGlvbiwgY2hlY2s/OiBib29sZWFufSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmh0dHAoJ0dFVCcsIHVybCwgZGF0YSwgY2IpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGdldCh1cmw6IHN0cmluZywgZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9uLCBjaGVjaz86IGJvb2xlYW59KSB7XHJcbiAgICAvLyAgICAgaWYgKCF0aGlzLnVybCAmJiAhKGNiICYmIGNiLmNoZWNrKSkge1xyXG4gICAgLy8gICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICflvZPliY3mnKrphY3nva7mnI3liqHlmajlnLDlnYAnfSk7XHJcbiAgICAvLyAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKG51bGwpO1xyXG4gICAgLy8gICAgICAgICByZXR1cm47XHJcbiAgICAvLyAgICAgfVxyXG5cclxuICAgIC8vICAgICAvLyDliJvlu7ogWE1MSHR0cFJlcXVlc3TvvIznm7jlvZPkuo7miZPlvIDmtY/op4jlmahcclxuICAgIC8vICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxyXG5cclxuICAgIC8vICAgICAvLyDmiZPlvIDkuIDkuKrkuI7nvZHlnYDkuYvpl7TnmoTov57mjqUgICDnm7jlvZPkuo7ovpPlhaXnvZHlnYBcclxuICAgIC8vICAgICAvLyDliKnnlKhvcGVu77yI77yJ5pa55rOV77yM56ys5LiA5Liq5Y+C5pWw5piv5a+55pWw5o2u55qE5pON5L2c77yM56ys5LqM5Liq5piv5o6l5Y+jXHJcbiAgICAvLyAgICAgeGhyLm9wZW4oXCJHRVRcIiwgYCR7dXJsfT8ke09iamVjdC5rZXlzKGRhdGEpLm1hcCh2ID0+IGAke3Z9PSR7ZGF0YVt2XX1gKS5qb2luKCcmJyl9YCk7XHJcblxyXG4gICAgLy8gICAgIC8vIOmAmui/h+i/nuaOpeWPkemAgeivt+axgiAg55u45b2T5LqO54K55Ye75Zue6L2m5oiW6ICF6ZO+5o6lXHJcbiAgICAvLyAgICAgeGhyLnNlbmQobnVsbCk7XHJcblxyXG4gICAgLy8gICAgIC8vIOaMh+WumiB4aHIg54q25oCB5Y+Y5YyW5LqL5Lu25aSE55CG5Ye95pWwICAg55u45b2T5LqO5aSE55CG572R6aG15ZGI546w5ZCO55qE5pON5L2cXHJcbiAgICAvLyAgICAgLy8g5YWo5bCP5YaZXHJcbiAgICAvLyAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIC8vICAgICAgICAgLy8g6YCa6L+HcmVhZHlTdGF0ZeeahOWAvOadpeWIpOaWreiOt+WPluaVsOaNrueahOaDheWGtVxyXG4gICAgLy8gICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAvLyAgICAgICAgICAgICAvLyDlk43lupTkvZPnmoTmlofmnKwgcmVzcG9uc2VUZXh0XHJcbiAgICAvLyAgICAgICAgICAgICBsZXQgcmVzcG9uc2U7XHJcbiAgICAvLyAgICAgICAgICAgICB0cnkge1xyXG4gICAgLy8gICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAvLyAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgIC8vICAgICAgICAgICAgICAgICByZXNwb25zZSA9IHRoaXMucmVzcG9uc2VUZXh0O1xyXG4gICAgLy8gICAgICAgICAgICAgfVxyXG4gICAgLy8gICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDAgJiYgcmVzcG9uc2UuaXNTdWNjZXNzKSB7XHJcbiAgICAvLyAgICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKHJlc3BvbnNlKTtcclxuICAgIC8vICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAvLyAgICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IocmVzcG9uc2UpO1xyXG4gICAgLy8gICAgICAgICAgICAgfVxyXG4gICAgLy8gICAgICAgICB9XHJcbiAgICAvLyAgICAgfVxyXG5cclxuICAgIC8vICAgICByZXR1cm4geGhyO1xyXG4gICAgLy8gfVxyXG5cclxuICAgIGh0dHAobWV0aG9kOiAnR0VUJyB8ICdQT1NUJyx1cmw6IHN0cmluZywgZGF0YTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBlcnJvcj86IEZ1bmN0aW9uLCBjaGVjaz86IGJvb2xlYW59KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnVybCAmJiAhKGNiICYmIGNiLmNoZWNrKSkge1xyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICflvZPliY3mnKrphY3nva7mnI3liqHlmajlnLDlnYAnfSk7XHJcbiAgICAgICAgICAgIGNiICYmIGNiLmVycm9yICYmIGNiLmVycm9yKG51bGwpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDliJvlu7ogWE1MSHR0cFJlcXVlc3TvvIznm7jlvZPkuo7miZPlvIDmtY/op4jlmahcclxuICAgICAgICBjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHJcbiAgICAgICAgLy8g5omT5byA5LiA5Liq5LiO572R5Z2A5LmL6Ze055qE6L+e5o6lICAg55u45b2T5LqO6L6T5YWl572R5Z2AXHJcbiAgICAgICAgLy8g5Yip55Sob3Blbu+8iO+8ieaWueazle+8jOesrOS4gOS4quWPguaVsOaYr+WvueaVsOaNrueahOaTjeS9nO+8jOesrOS6jOS4quaYr+aOpeWPo1xyXG4gICAgICAgIC8vIHhoci5vcGVuKG1ldGhvZCwgYCR7dXJsfT8ke09iamVjdC5rZXlzKGRhdGEpLm1hcCh2ID0+IGAke3Z9PSR7ZGF0YVt2XX1gKS5qb2luKCcmJyl9YCk7XHJcbiAgICAgICAgbGV0IHBhcmFtOiBzdHJpbmcgPSBPYmplY3Qua2V5cyhkYXRhKS5tYXAodiA9PiBgJHt2fT0ke2RhdGFbdl19YCkuam9pbignJicpO1xyXG4gICAgICAgIHhoci5vcGVuKG1ldGhvZCwgbWV0aG9kID09PSAnR0VUJz9gJHt1cmx9PyR7cGFyYW19YDp1cmwpO1xyXG5cclxuICAgICAgICBpZiAobWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04Jyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDpgJrov4fov57mjqXlj5HpgIHor7fmsYIgIOebuOW9k+S6jueCueWHu+Wbnui9puaIluiAhemTvuaOpVxyXG4gICAgICAgIHhoci5zZW5kKG1ldGhvZCA9PT0gJ0dFVCc/bnVsbDpKU09OLnN0cmluZ2lmeShkYXRhKSk7XHJcblxyXG4gICAgICAgIC8vIOaMh+WumiB4aHIg54q25oCB5Y+Y5YyW5LqL5Lu25aSE55CG5Ye95pWwICAg55u45b2T5LqO5aSE55CG572R6aG15ZGI546w5ZCO55qE5pON5L2cXHJcbiAgICAgICAgLy8g5YWo5bCP5YaZXHJcbiAgICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8g6YCa6L+HcmVhZHlTdGF0ZeeahOWAvOadpeWIpOaWreiOt+WPluaVsOaNrueahOaDheWGtVxyXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAvLyDlk43lupTkvZPnmoTmlofmnKwgcmVzcG9uc2VUZXh0XHJcbiAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2U7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZSA9IHRoaXMucmVzcG9uc2VUZXh0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDAgJiYgcmVzcG9uc2UuaXNTdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKHJlc3BvbnNlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2IgJiYgY2IuZXJyb3IgJiYgY2IuZXJyb3IocmVzcG9uc2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4geGhyO1xyXG4gICAgfVxyXG5cclxuICAgIHNldFVybCh1cmw6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMudXJsID0gdXJsO1xyXG4gICAgICAgIHdpbmRvdy5TdG9yZS5zZXQoJ3VybCcsIHVybCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tVcmwodXJsOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAodGhpcy5fY2hlY2tYSFIpIHtcclxuICAgICAgICAgICAgdGhpcy5fY2hlY2tYSFIuYWJvcnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY2hlY2tYSFIgPSB0aGlzLmdldCh1cmwgKyB0aGlzLmFwaU1hcC5ib29rc2hlbGYsIHt9LCB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+acjeWKoeWZqOWcsOWdgOa1i+ivleaIkOWKnyd9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0VXJsKHVybCk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGVycm9yOiAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmnI3liqHlmajlnLDlnYDmtYvor5XlpLHotKUnfSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNoZWNrOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBBcGk7IiwiaW1wb3J0IFBhZ2luYXRpb24gZnJvbSBcIi4uL3BhZ2luYXRpb24vcGFnaW5hdGlvblwiO1xyXG5cclxuY2xhc3MgQmFyIHtcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xyXG4gICAgcGFnaW5hdGlvbjogUGFnaW5hdGlvbjtcclxuICAgIHBlcmNlbnQ6IG51bWJlcjtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IHtcclxuICAgICAgICBlbGVtZW50OiBIVE1MRWxlbWVudCxcclxuICAgICAgICBwYWdpbmF0aW9uOiBQYWdpbmF0aW9uXHJcbiAgICB9KSB7XHJcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gY29uZmlnLmVsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5wYWdpbmF0aW9uID0gY29uZmlnLnBhZ2luYXRpb247XHJcbiAgICAgICAgdGhpcy5wZXJjZW50ID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiYXItcHJvZ3Jlc3NcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJiYXItdGV4dFwiPjxzcGFuIGNsYXNzPVwiYmFyLWN1cnJlbnRcIj48L3NwYW4+LzxzcGFuIGNsYXNzPVwiYmFyLXRvdGFsXCI+PC9zcGFuPjwvZGl2PlxyXG4gICAgICAgICAgICBgO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBpbmRleDogSFRNTEVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLmJhci1jdXJyZW50Jyk7XHJcbiAgICAgICAgbGV0IHRvdGFsOiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYmFyLXRvdGFsJyk7XHJcbiAgICAgICAgbGV0IHByb2dyZXNzOiBIVE1MRWxlbWVudCA9IHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuYmFyLXByb2dyZXNzJyk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KGluZGV4LCB0aGlzLnBhZ2luYXRpb24sICdwYWdlSW5kZXgnLCAodmFsdWU6IG51bWJlcikgPT4ge1xyXG4gICAgICAgICAgICBsZXQgdiA9IHZhbHVlICsgMTtcclxuICAgICAgICAgICAgdGhpcy5wZXJjZW50ID0gdiAvIHRoaXMucGFnaW5hdGlvbi5wYWdlTGltaXQ7XHJcbiAgICAgICAgICAgIHJldHVybiB2O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRvdGFsLCB0aGlzLnBhZ2luYXRpb24sICdwYWdlTGltaXQnLCAodmFsdWU6IG51bWJlcikgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnBlcmNlbnQgPSAodGhpcy5wYWdpbmF0aW9uLnBhZ2VJbmRleCArIDEpIC8gdmFsdWU7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFN0eWxlKHByb2dyZXNzLCB0aGlzLCAncGVyY2VudCcsICd3aWR0aCcsICh2OiBhbnkpID0+IGAke3YgKiAxMDB9JWApO1xyXG5cclxuICAgICAgICB0aGlzLmVsZW1lbnQub25jbGljayA9KGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IHRoaXMuZWxlbWVudC5vZmZzZXRXaWR0aDtcclxuICAgICAgICAgICAgbGV0IHggPSBldmVudC5wYWdlWDtcclxuICAgICAgICAgICAgbGV0IGluZGV4ID0gTWF0aC5mbG9vcih0aGlzLnBhZ2luYXRpb24ucGFnZUxpbWl0ICogeCAvIHdpZHRoKTtcclxuICAgICAgICAgICAgdGhpcy5wYWdpbmF0aW9uLnNldFBhZ2UoaW5kZXgpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBCYXI7IiwiY2xhc3MgQmluZCB7XHJcbiAgICBjYk1hcDogYW55ID0ge307XHJcbiAgICBvYmpJbmRleDogbnVtYmVyID0gMDtcclxuICAgIG9iak1hcDogYW55ID0ge307XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgaWYgKHdpbmRvdy5CaW5kKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdiaW5kIGhhcyBiZWVuIGluaXRlZCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuQmluZCA9IHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBoYW5kbGVPYmoob2JqOiBhbnksIHByb3A6IHN0cmluZykge1xyXG4gICAgICAgIGlmICghb2JqLmhhc093blByb3BlcnR5KCdfYmluZElkJykpIHtcclxuICAgICAgICAgICAgb2JqLl9iaW5kSWQgPSB0aGlzLm9iakluZGV4Kys7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmNiTWFwW29iai5fYmluZElkICsgcHJvcF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgaW5kZXggPSAnXycgKyBwcm9wO1xyXG4gICAgICAgIG9ialtpbmRleF0gPSBvYmpbcHJvcF07XHJcbiAgICAgICAgdGhpcy5jYk1hcFtvYmouX2JpbmRJZCArIHByb3BdID0gW107XHJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcCwge1xyXG4gICAgICAgICAgICBnZXQ6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvYmpbaW5kZXhdO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzZXQ6ICh2YWx1ZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgdGVtcCA9IG9ialtpbmRleF07XHJcbiAgICAgICAgICAgICAgICBvYmpbaW5kZXhdID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJ1bihvYmosIHByb3AsIHZhbHVlLCB0ZW1wKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgYmluZElucHV0KGVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQsIG9iajogYW55LCBwcm9wOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAoIWVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdlbGVtZW50IGlzIG51bGwnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5iaW5kKG9iaiwgcHJvcCwgKG5ld1Y6IGFueSwgb2xkVjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQudmFsdWUgPSBuZXdWO1xyXG4gICAgICAgIH0sIHRydWUpO1xyXG4gICAgICAgIGVsZW1lbnQub25jaGFuZ2UgPSAoZXZlbnQ6IElucHV0RXZlbnQpID0+IHtcclxuICAgICAgICAgICAgb2JqW3Byb3BdID0gKGV2ZW50LnRhcmdldCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZTtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGJpbmRTdHlsZShlbGVtZW50OiBIVE1MRWxlbWVudCwgb2JqOiBhbnksIHByb3A6IHN0cmluZywgdGFyZ2V0OiBhbnksIGhhbmRsZT86IEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgaWYgKCFlbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZWxlbWVudCBpcyBudWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYmluZChvYmosIHByb3AsIChuZXdWOiBhbnksIG9sZFY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlW3RhcmdldF0gPSBoYW5kbGU/aGFuZGxlKG5ld1YsIG9sZFYpOm5ld1Y7XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYmluZFZpZXcoZWxlbWVudDogSFRNTEVsZW1lbnQsIG9iajogYW55LCBwcm9wOiBzdHJpbmcsIGZvcm1hdHRlcj86IEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgaWYgKCFlbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZWxlbWVudCBpcyBudWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYmluZChvYmosIHByb3AsIChuZXdWOiBhbnksIG9sZFY6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9IGZvcm1hdHRlcj9mb3JtYXR0ZXIobmV3Viwgb2xkVik6bmV3VjtcclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBiaW5kKG9iajogYW55LCBwcm9wOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbiwgaW1tZWRpYXRlbHk/OiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVPYmoob2JqLCBwcm9wKTtcclxuICAgICAgICB0aGlzLmNiTWFwW29iai5fYmluZElkICsgcHJvcF0ucHVzaChjYWxsYmFjayk7XHJcbiAgICAgICAgaW1tZWRpYXRlbHkgJiYgY2FsbGJhY2sob2JqW3Byb3BdLCB1bmRlZmluZWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHJ1bihvYmo6IGFueSwgcHJvcDogc3RyaW5nLCBuZXdWPzogYW55LCBvbGRWPzogYW55KSB7XHJcbiAgICAgICAgdGhpcy5jYk1hcFtvYmouX2JpbmRJZCArIHByb3BdLmZvckVhY2goKGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3Viwgb2xkVik7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgQmluZDsiLCJmdW5jdGlvbiBzdHJUb0RvbShzdHI6IHN0cmluZyk6IEhUTUxDb2xsZWN0aW9uIHtcclxuICAgIGxldCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGRpdi5pbm5lckhUTUwgPSBzdHI7XHJcbiAgICByZXR1cm4gZGl2LmNoaWxkcmVuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWtlRGlzcGxheVRleHQodGltZTogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgIGxldCB0ZXh0ID0gJ+a1i+ivleaWh+acrCc7XHJcblxyXG4gICAgbGV0IHJlc3VsdCA9IG5ldyBBcnJheSh0aW1lICsgMSkuam9pbih0ZXh0KTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTcGVjaWFsUGFyZW50KGVsZTogSFRNTEVsZW1lbnQsY2hlY2tGdW46IEZ1bmN0aW9uKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcclxuICAgIGlmIChlbGUgJiYgZWxlICE9PSBkb2N1bWVudCBhcyB1bmtub3duICYmIGNoZWNrRnVuKGVsZSkpIHtcclxuICAgICAgICByZXR1cm4gZWxlO1xyXG4gICAgfVxyXG4gICAgbGV0IHBhcmVudCA9IGVsZS5wYXJlbnRFbGVtZW50IHx8IGVsZS5wYXJlbnROb2RlO1xyXG4gICAgcmV0dXJuIHBhcmVudD9nZXRTcGVjaWFsUGFyZW50KHBhcmVudCBhcyBIVE1MRWxlbWVudCwgY2hlY2tGdW4pOm51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldE9iamVjdChzb3VyY2U6IGFueSwga2V5czogc3RyaW5nW10sIG90aGVycz86IHtba2V5OiBzdHJpbmddOiBhbnl9KTogYW55IHtcclxuICAgIGxldCBvYmo6IGFueSA9IHt9O1xyXG4gICAga2V5cy5mb3JFYWNoKGtleSA9PiB7XHJcbiAgICAgICAgb2JqW2tleV0gPSBzb3VyY2Vba2V5XTtcclxuICAgIH0pO1xyXG4gICAgb3RoZXJzICYmIE9iamVjdC5rZXlzKG90aGVycykuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgIG9ialtrZXldID0gb3RoZXJzW2tleV07XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBvYmo7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNoYW5nZVZhbHVlV2l0aE5ld09iaihvYmo6IGFueSwgdGFyZ2V0OiB7W2tleTogc3RyaW5nXTogYW55fSk6IGFueSB7XHJcbiAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcclxuICAgIE9iamVjdC5rZXlzKHRhcmdldCkuZm9yRWFjaCh2ID0+IHtcclxuICAgICAgICByZXN1bHRbdl0gPSB0YXJnZXRbdl07XHJcbiAgICB9KTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmludGVyZmFjZSBCb29rIHtcclxuICAgIGlkOiBzdHJpbmc7XHJcbiAgICBzb3VyY2U6IHN0cmluZztcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF1dGhvcjogc3RyaW5nO1xyXG4gICAgYm9va1VybDogc3RyaW5nO1xyXG4gICAgY292ZXJVcmw6IHN0cmluZztcclxuICAgIGN1c3RvbUNvdmVyVXJsOiBzdHJpbmc7XHJcbiAgICBkdXJDaGFwdGVyVGl0bGU6IHN0cmluZztcclxuICAgIGxhdGVzdENoYXB0ZXJUaW1lOiBzdHJpbmc7XHJcbiAgICBsYXRlc3RDaGFwdGVyVGl0bGU6IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIENhdGFsb2d1ZUl0ZW0ge1xyXG4gICAgaW5kZXg6IG51bWJlcjtcclxuICAgIHRpdGxlOiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBQcm9ncmVzcyB7XHJcbiAgICBpbmRleDogbnVtYmVyO1xyXG4gICAgcG9zOiBudW1iZXI7XHJcbiAgICB0aW1lOiBudW1iZXI7XHJcbiAgICB0aXRsZTogc3RyaW5nO1xyXG59XHJcblxyXG5cclxuZXhwb3J0IHsgc3RyVG9Eb20sIG1ha2VEaXNwbGF5VGV4dCwgZ2V0U3BlY2lhbFBhcmVudCwgZ2V0T2JqZWN0LCBjaGFuZ2VWYWx1ZVdpdGhOZXdPYmosIEJvb2ssIENhdGFsb2d1ZUl0ZW0sIFByb2dyZXNzIH07IiwiY2xhc3MgRGVidWdnZXIge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgd2luZG93Lm9uZXJyb3IgPSBmdW5jdGlvbiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcblxyXG4gICAgICAgICAgICB3aW5kb3cuTW9kYWwgJiYgd2luZG93Lk1vZGFsLmFkZCh7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBlcnJvci50b1N0cmluZygpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IERlYnVnZ2VyOyIsImludGVyZmFjZSBMYXlvdXRJbnRlcmZhY2Uge1xyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuICAgIGxpbmVIZWlnaHQ6IG51bWJlcjtcclxufTtcclxuXHJcbmNsYXNzIExheW91dCB7XHJcblxyXG4gICAgZm9udFNpemU6IG51bWJlcjtcclxuXHJcbiAgICBsaW5lSGVpZ2h0OiBudW1iZXI7XHJcblxyXG4gICAgbGltaXQ6IExheW91dEludGVyZmFjZSA9IHtcclxuICAgICAgICAgICAgZm9udFNpemU6IDIwLFxyXG4gICAgICAgICAgICBsaW5lSGVpZ2h0OiAyNFxyXG4gICAgICAgIH07XHJcbiAgICBiYXNlOiBMYXlvdXRJbnRlcmZhY2UgPSB7XHJcbiAgICAgICAgICAgIGZvbnRTaXplOiAzMCxcclxuICAgICAgICAgICAgbGluZUhlaWdodDogNDBcclxuICAgICAgICB9O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuTGF5b3V0KSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdsYXlvdXQgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5MYXlvdXQgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLmZvbnRTaXplID0gcGFyc2VJbnQod2luZG93LlN0b3JlLmdldCgnZm9udFNpemUnKSB8fCB0aGlzLmJhc2UuZm9udFNpemUudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgdGhpcy5saW5lSGVpZ2h0ID0gcGFyc2VJbnQod2luZG93LlN0b3JlLmdldCgnbGluZUhlaWdodCcpIHx8IHRoaXMuYmFzZS5saW5lSGVpZ2h0LnRvU3RyaW5nKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHNldCh0YXJnZXQ6ICdmb250U2l6ZScgfCAnbGluZUhlaWdodCcsIHZhbHVlPzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgdGhpc1t0YXJnZXRdID0gdmFsdWUgfHwgdGhpcy5iYXNlW3RhcmdldF07XHJcbiAgICAgICAgd2luZG93LlN0b3JlLnNldCh0YXJnZXQsIHRoaXNbdGFyZ2V0XS50b1N0cmluZygpKTtcclxuICAgIH1cclxuXHJcbiAgICBhZGQodGFyZ2V0OiAnZm9udFNpemUnIHwgJ2xpbmVIZWlnaHQnLCBudW06IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIGxldCBjdXJyZW50ID0gdGhpc1t0YXJnZXRdO1xyXG4gICAgICAgIGN1cnJlbnQgKz0gbnVtO1xyXG5cclxuICAgICAgICBpZiAoY3VycmVudCA8IHRoaXMubGltaXRbdGFyZ2V0XSkge1xyXG4gICAgICAgICAgICBjdXJyZW50ID0gdGhpcy5saW1pdFt0YXJnZXRdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zZXQodGFyZ2V0LCBjdXJyZW50KTtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCh0YXJnZXQ/OiAnZm9udFNpemUnIHwgJ2xpbmVIZWlnaHQnKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRhcmdldCkge1xyXG4gICAgICAgICAgICB0aGlzLnNldCh0YXJnZXQpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc2V0KCdmb250U2l6ZScpO1xyXG4gICAgICAgIHRoaXMuc2V0KCdsaW5lSGVpZ2h0Jyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBMYXlvdXQ7IiwiaW1wb3J0IHsgc3RyVG9Eb20gfSBmcm9tICcuLi9jb21tb24nO1xyXG5cclxuaW50ZXJmYWNlIE1lc3NhZ2VPcHRpb24ge1xyXG4gICAgY29udGVudDogc3RyaW5nO1xyXG4gICAgb25Paz86IEZ1bmN0aW9uO1xyXG4gICAgb25DYW5jbGU/OiBGdW5jdGlvbjtcclxuICAgIGJhbkF1dG9SZW1vdmU/OiBib29sZWFuO1xyXG59O1xyXG5cclxuY2xhc3MgTWVzc2FnZUl0ZW0ge1xyXG4gICAgYm9keTogRWxlbWVudDtcclxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbjogTWVzc2FnZU9wdGlvbikge1xyXG4gICAgICAgIGxldCBzdHIgPSBgXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibWVzc2FnZS1jb250ZW50XCI+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgYDtcclxuICAgICAgICBsZXQgbWVzc2FnZTogRWxlbWVudCA9IHN0clRvRG9tKHN0cilbMF07XHJcbiAgICAgICAgdGhpcy5ib2R5ID0gbWVzc2FnZTtcclxuICAgICAgICBsZXQgY29udGVudDogSFRNTERpdkVsZW1lbnQgPSBtZXNzYWdlLnF1ZXJ5U2VsZWN0b3IoJy5tZXNzYWdlLWNvbnRlbnQnKTtcclxuICAgICAgICBjb250ZW50LmlubmVySFRNTCA9IG9wdGlvbi5jb250ZW50O1xyXG5cclxuICAgICAgICBjb250ZW50Lm9uY2xpY2sgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIG9wdGlvbi5vbk9rICYmIG9wdGlvbi5vbk9rKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbi5iYW5BdXRvUmVtb3ZlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgb3B0aW9uLm9uQ2FuY2xlICYmIG9wdGlvbi5vbkNhbmNsZSgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xyXG4gICAgICAgIH0sIDIwMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZSgpIHtcclxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5ib2R5LnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgcGFyZW50ICYmIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmJvZHkpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgTWVzc2FnZSB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuICAgIGxpc3Q6IGFueVtdO1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgaWYgKHdpbmRvdy5NZXNzYWdlKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdtb2RhbCBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5saXN0ID0gW107XHJcbiAgICAgICAgd2luZG93Lk1lc3NhZ2UgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tZXNzYWdlLWJveCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZChvcHRpb246IE1lc3NhZ2VPcHRpb24pIHtcclxuICAgICAgICBsZXQgaXRlbSA9IG5ldyBNZXNzYWdlSXRlbShvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtLmJvZHkpO1xyXG4gICAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZShpdGVtOiBNZXNzYWdlSXRlbSk6IHZvaWQge1xyXG4gICAgICAgIGl0ZW0ucmVtb3ZlKCk7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5saXN0LmluZGV4T2YoaXRlbSk7XHJcbiAgICAgICAgdGhpcy5saXN0LnNwbGljZShpbmRleCwgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgY2xlYXIoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5saXN0ID0gW107XHJcbiAgICAgICAgdGhpcy5lbGVtZW50LmlubmVySFRNTCA9ICcnO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgTWVzc2FnZTsiLCJpbXBvcnQgeyBzdHJUb0RvbSB9IGZyb20gJy4uL2NvbW1vbic7XHJcblxyXG5cclxuaW50ZXJmYWNlIE1vZGFsT3B0aW9uIHtcclxuICAgIGNvbnRlbnQ6IHN0cmluZyB8IEhUTUxFbGVtZW50O1xyXG4gICAgb25Paz86IEZ1bmN0aW9uO1xyXG4gICAgb25DYW5jZWw/OiBGdW5jdGlvbjtcclxuICAgIHpJbmRleD86IG51bWJlcjtcclxufTtcclxuXHJcbmNsYXNzIE1vZGFsSXRlbSB7XHJcbiAgICBib2R5OiBFbGVtZW50O1xyXG4gICAgekluZGV4OiBudW1iZXI7XHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb246IE1vZGFsT3B0aW9uKSB7XHJcbiAgICAgICAgdGhpcy56SW5kZXggPSBvcHRpb24uekluZGV4O1xyXG4gICAgICAgIGxldCBzdHIgPSBgXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbFwiIHN0eWxlPVwiei1pbmRleDogJHt0aGlzLnpJbmRleH07XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtY29udGVudFwiPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZm9vdGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvbiBtb2RhbC1jb25maXJtXCI+56Gu5a6aPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1dHRvbiBtb2RhbC1jYW5jZWxcIj7lj5bmtog8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICBgO1xyXG4gICAgICAgIGxldCBtb2RhbDogRWxlbWVudCA9IHN0clRvRG9tKHN0cilbMF07XHJcbiAgICAgICAgdGhpcy5ib2R5ID0gbW9kYWw7XHJcbiAgICAgICAgbGV0IGNvbnRlbnQ6IEhUTUxEaXZFbGVtZW50ID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLWNvbnRlbnQnKTtcclxuICAgICAgICBsZXQgYnRuQ29uZmlybTogSFRNTEJ1dHRvbkVsZW1lbnQgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtY29uZmlybScpO1xyXG4gICAgICAgIGxldCBidG5DYW5jZWw6IEhUTUxCdXR0b25FbGVtZW50ID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLWNhbmNlbCcpO1xyXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uLmNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGNvbnRlbnQuaW5uZXJIVE1MID0gb3B0aW9uLmNvbnRlbnQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29udGVudC5hcHBlbmRDaGlsZChvcHRpb24uY29udGVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ0bkNhbmNlbC5vbmNsaWNrID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb24ub25DYW5jZWwgJiYgb3B0aW9uLm9uQ2FuY2VsKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgYnRuQ29uZmlybS5vbmNsaWNrID0gKCkgPT4ge1xyXG4gICAgICAgICAgICBvcHRpb24ub25PayAmJiBvcHRpb24ub25PaygpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlKCkge1xyXG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLmJvZHkucGFyZW50RWxlbWVudDtcclxuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5ib2R5KTtcclxuICAgIH1cclxufTtcclxuXHJcblxyXG5jbGFzcyBNb2RhbCB7XHJcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcclxuICAgIGxpc3Q6IE1vZGFsSXRlbVtdID0gW107XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBpZiAod2luZG93Lk1vZGFsKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdtb2RhbCBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93Lk1vZGFsID0gdGhpcztcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm94Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkKG9wdGlvbjogTW9kYWxPcHRpb24pOiBNb2RhbEl0ZW0ge1xyXG4gICAgICAgIGlmICghKCd6SW5kZXgnIGluIG9wdGlvbikpIHtcclxuICAgICAgICAgICAgbGV0IGxlbmd0aCA9IHRoaXMubGlzdC5sZW5ndGg7XHJcbiAgICAgICAgICAgIG9wdGlvbi56SW5kZXggPSAobGVuZ3RoP3RoaXMubGlzdFtsZW5ndGggLSAxXS56SW5kZXg6MTAwKSArIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBpdGVtID0gbmV3IE1vZGFsSXRlbShvcHRpb24pO1xyXG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChpdGVtLmJvZHkpO1xyXG4gICAgICAgIHJldHVybiBpdGVtO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZShpdGVtOiBNb2RhbEl0ZW0pOiB2b2lkIHtcclxuICAgICAgICBpdGVtLnJlbW92ZSgpO1xyXG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMubGlzdC5pbmRleE9mKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsZWFyKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMubGlzdCA9IFtdO1xyXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lckhUTUwgPSAnJztcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgTW9kYWw7IiwiY2xhc3MgUGFnaW5hdGlvbiB7XHJcbiAgICByb290OiBIVE1MRWxlbWVudDtcclxuICAgIGJveDogSFRNTEVsZW1lbnQ7XHJcbiAgICBwYWRkaW5nOiBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBwYWdlU3RlcDogbnVtYmVyO1xyXG5cclxuICAgIHBhZ2VJbmRleDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwYWdlTGltaXQ6IG51bWJlciA9IDE7XHJcblxyXG4gICAgcGFnZVBhZGRpbmc6IG51bWJlciA9IDA7XHJcblxyXG4gICAgZmFrZVBhZ2U6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihjb25maWc6IHtcclxuICAgICAgICByb290OiBIVE1MRWxlbWVudCxcclxuICAgICAgICBmYWtlPzogYm9vbGVhbiAgICAgXHJcbiAgICAgICAgcGFnZUNoYW5nZT86IEZ1bmN0aW9uICAgIFxyXG4gICAgfSkge1xyXG4gICAgICAgIHRoaXMucm9vdCA9IGNvbmZpZy5yb290O1xyXG4gICAgICAgIHRoaXMuaGFuZGxlSHRtbChjb25maWcucm9vdCk7XHJcblxyXG4gICAgICAgIHRoaXMuZmFrZVBhZ2UgPSBjb25maWcuZmFrZSB8fCBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5wYWdlU3RlcCA9IHRoaXMuYm94Lm9mZnNldEhlaWdodDtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVja1BhZ2UoKTtcclxuICAgICAgICBcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUodGhpcy5wYWRkaW5nLCB0aGlzLCAncGFnZVBhZGRpbmcnLCAnaGVpZ2h0JywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmQodGhpcywgJ3BhZ2VJbmRleCcsICh2YWx1ZTogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmZha2VQYWdlKSB7XHJcbiAgICAgICAgICAgICAgICBjb25maWc/LnBhZ2VDaGFuZ2UodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuYm94LnNjcm9sbFRvcCA9IHRoaXMucGFnZVN0ZXAgKiB2YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0gIFxyXG4gICAgXHJcbiAgICBwcml2YXRlIGhhbmRsZUh0bWwocm9vdDogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICBsZXQgaW5uZXIgPSByb290LmlubmVySFRNTDtcclxuICAgICAgICByb290LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhZ2luYXRpb24tYm94XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicGFnaW5hdGlvbi1ib2R5XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInBhZ2luYXRpb24tY29udGVudFwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwYWdpbmF0aW9uLXBhZGRpbmdcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5gO1xyXG4gICAgICAgIGxldCBjb250ZW50OiBIVE1MRWxlbWVudCA9IHJvb3QucXVlcnlTZWxlY3RvcignLnBhZ2luYXRpb24tY29udGVudCcpO1xyXG4gICAgICAgIGNvbnRlbnQuaW5uZXJIVE1MID0gaW5uZXI7XHJcbiAgICAgICAgdGhpcy5ib3ggPSByb290LnF1ZXJ5U2VsZWN0b3IoJy5wYWdpbmF0aW9uLWJveCcpO1xyXG4gICAgICAgIHRoaXMucGFkZGluZyA9IHJvb3QucXVlcnlTZWxlY3RvcignLnBhZ2luYXRpb24tcGFkZGluZycpO1xyXG4gICAgfVxyXG5cclxuICAgIGNoZWNrUGFnZShsaW1pdD86IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIHRoaXMucGFnZVN0ZXAgPSB0aGlzLmJveC5vZmZzZXRIZWlnaHQ7XHJcbiAgICAgICAgaWYgKHRoaXMuZmFrZVBhZ2UpIHtcclxuICAgICAgICAgICAgdGhpcy5wYWdlTGltaXQgPSBsaW1pdCB8fCAxO1xyXG4gICAgICAgICAgICB0aGlzLnBhZ2VQYWRkaW5nID0gMDtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnBhZ2VMaW1pdCA9IE1hdGguY2VpbCh0aGlzLmJveC5zY3JvbGxIZWlnaHQgLyB0aGlzLnBhZ2VTdGVwKSB8fCAxO1xyXG4gICAgICAgIHRoaXMucGFnZVBhZGRpbmcgPSB0aGlzLnBhZ2VTdGVwICogdGhpcy5wYWdlTGltaXQgLSB0aGlzLmJveC5zY3JvbGxIZWlnaHQ7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0UGFnZShudW06IG51bWJlcikge1xyXG4gICAgICAgIGxldCB0YXJnZXQgPSBudW07XHJcbiAgICAgICAgaWYgKG51bSA8IDApIHtcclxuICAgICAgICAgICAgdGFyZ2V0ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG51bSA+PSB0aGlzLnBhZ2VMaW1pdCkge1xyXG4gICAgICAgICAgICB0YXJnZXQgPSB0aGlzLnBhZ2VMaW1pdCAtIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucGFnZUluZGV4ID0gdGFyZ2V0O1xyXG4gICAgfVxyXG5cclxuICAgIHBhZ2VDaGFuZ2UoYWRkOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnNldFBhZ2UodGhpcy5wYWdlSW5kZXggKyBhZGQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgUGFnaW5hdGlvbjsiLCJjbGFzcyBSb3V0ZXIge1xyXG5cclxuICAgIGN1cnJlbnQ6IHN0cmluZztcclxuXHJcbiAgICBwYWdlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICBjYk1hcDoge1trZXk6IHN0cmluZ106IEZ1bmN0aW9ufSA9IHt9O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHBhZ2VzOiBzdHJpbmdbXSkge1xyXG4gICAgICAgIGlmICh3aW5kb3cuUm91dGVyKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdyb3V0ZXIgaGFzIGJlZW4gaW5pdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5Sb3V0ZXIgPSB0aGlzO1xyXG5cclxuICAgICAgICB0aGlzLnBhZ2VzID0gcGFnZXM7XHJcblxyXG4gICAgICAgIGxldCBmdW5jID0gKGV2ZW50PzogSGFzaENoYW5nZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBoYXNoID0gd2luZG93LmxvY2F0aW9uLmhhc2g7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IGhhc2gubGFzdEluZGV4T2YoJyMnKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcclxuICAgICAgICAgICAgICAgIGhhc2ggPSBoYXNoLnNsaWNlKGluZGV4ICsgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMucGFnZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMucGFnZXMuaW5kZXhPZihoYXNoKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gdGhpcy5wYWdlc1swXTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5zd2l0Y2hQYWdlKGhhc2gpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgd2luZG93Lm9uaGFzaGNoYW5nZSA9IGZ1bmM7XHJcbiAgICAgICAgZnVuYygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc3dpdGNoUGFnZShzdHI6IHN0cmluZykge1xyXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaG93Jyk/LmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTtcclxuICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAuJHtzdHJ9YCk/LmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTtcclxuICAgICAgICB0aGlzLmN1cnJlbnQgPSBzdHI7XHJcbiAgICAgICAgdGhpcy5jYk1hcFtzdHJdICYmIHRoaXMuY2JNYXBbc3RyXSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGdvKHRhcmdldDogc3RyaW5nKTogdm9pZCAge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gdGFyZ2V0O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBSb3V0ZXI7IiwiLy8gaW1wb3J0ICogYXMgTHpTdHJpbmcgZnJvbSAnbHotc3RyaW5nJztcclxuaW1wb3J0IHsgY29tcHJlc3MsIGRlY29tcHJlc3MgfSBmcm9tICdsei1zdHJpbmcnO1xyXG5pbXBvcnQgeyBCb29rIH0gZnJvbSAnLi4vY29tbW9uJztcclxuXHJcbi8vIHByZWZpeCBtYXBcclxuLy8gYSBhcnRpY2xlXHJcbi8vIGIgYm9va1xyXG4vLyBjIGNhdGFsb2d1ZVxyXG4vLyBwIHByb2dyZXNzXHJcblxyXG5jbGFzcyBTdG9yZSB7XHJcbiAgICBkYXRhOiBhbnk7XHJcblxyXG4gICAgbGltaXRDaGVja2luZzogYm9vbGVhbiA9IGZhbHNlO1xyXG4gICAgbGltaXQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgdXNhZ2U6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcGVyY2VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBjb21wcmVzczogRnVuY3Rpb24gPSBjb21wcmVzcztcclxuICAgIGRlY29tcHJlc3M6IEZ1bmN0aW9uID0gZGVjb21wcmVzcztcclxuXHJcbiAgICBjaGVja0ZsYWc6IG51bWJlcjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBpZiAod2luZG93LlN0b3JlKSB7XHJcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdzdG9yZSBoYXMgYmVlbiBpbml0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2luZG93LlN0b3JlID0gdGhpcztcclxuICAgICAgICB0aGlzLmxpbWl0ID0gcGFyc2VJbnQodGhpcy5nZXQoJ2xpbWl0JykgfHwgJzAnKTtcclxuXHJcbiAgICAgICAgdGhpcy5jaGVja1VzYWdlKCk7XHJcbiAgICAgICAgaWYgKHRoaXMubGltaXQgPT09IDApIHtcclxuICAgICAgICAgICAgLy8gdGhpcy5jaGVja0xpbWl0KCk7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+e8k+WtmOacquWIneWni+WMluivt+aJi+WKqOajgOa1iyd9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYm9va0RlbGV0ZShib29rOiBCb29rLCBvbmx5U291cmNlPzogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIGlmICghb25seVNvdXJjZSkge1xyXG4gICAgICAgICAgICB0aGlzLmRlbChgcF8ke2Jvb2suaWR9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZGVsKGBjXyR7Ym9vay5pZH1gKTtcclxuICAgICAgICB0aGlzLmdldEJ5SGVhZChgYV8ke2Jvb2suaWR9YCkuZm9yRWFjaCh2ID0+IHRoaXMuZGVsKHYpKTtcclxuICAgIH1cclxuXHJcbiAgICBkZWwoa2V5OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xyXG4gICAgICAgIHRoaXMuY2hlY2tVc2FnZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuaGFzT3duUHJvcGVydHkoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRPYmooa2V5OiBzdHJpbmcpOiBhbnkgfCBudWxsIHtcclxuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLmdldChrZXkpKTsgICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHNldE9iaihrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgY2I/OiB7c3VjY2Vzcz86IEZ1bmN0aW9uLCBmYWlsPzogRnVuY3Rpb259KTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5zZXQoa2V5LCBKU09OLnN0cmluZ2lmeSh2YWx1ZSksIGNiKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcsIGNiPzoge3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmFpbD86IEZ1bmN0aW9ufSk6IHZvaWQge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIGxldCBja2V5ID0gY29tcHJlc3Moa2V5KTtcclxuICAgICAgICAgICAgbGV0IGN2YWx1ZSA9IGNvbXByZXNzKHZhbHVlKTtcclxuICAgICAgICAgICAgLy8gbG9jYWxTdG9yYWdlLnNldEl0ZW0oY2tleSwgY3ZhbHVlKTtcclxuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBjdmFsdWUpO1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrVXNhZ2UoKTtcclxuICAgICAgICAgICAgY2IgJiYgY2Iuc3VjY2VzcyAmJiBjYi5zdWNjZXNzKCk7XHJcbiAgICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+e8k+WtmOWksei0pe+8jOepuumXtOS4jei2syd9KTtcclxuICAgICAgICAgICAgY2IgJiYgY2IuZmFpbCAmJiBjYi5mYWlsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGdldChrZXk6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgICAgIC8vIGxldCBzdG9yZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGNvbXByZXNzKGtleSkpO1xyXG4gICAgICAgIGxldCBzdG9yZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XHJcbiAgICAgICAgaWYgKHN0b3JlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBkZWNvbXByZXNzKHN0b3JlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0QnlIZWFkKGhlYWQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMobG9jYWxTdG9yYWdlKS5maWx0ZXIodiA9PiB2LmluZGV4T2YoaGVhZCkgPT09IDApO1xyXG4gICAgfVxyXG5cclxuICAgIGNoZWNrVXNhZ2UoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuY2hlY2tGbGFnKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5jaGVja0ZsYWcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmNoZWNrRmxhZyA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy51c2FnZSA9IE9iamVjdC5rZXlzKGxvY2FsU3RvcmFnZSkubWFwKHYgPT4gdiArIGxvY2FsU3RvcmFnZS5nZXRJdGVtKHYpKS5qb2luKCcnKS5sZW5ndGg7XHJcbiAgICAgICAgICAgIHRoaXMucGVyY2VudCA9IHRoaXMubGltaXQ/TWF0aC5yb3VuZCh0aGlzLnVzYWdlIC8gKHRoaXMubGltaXQpICogMTAwKTowO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wZXJjZW50ID4gOTUpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogYOe8k+WtmOW3suS9v+eUqCR7dGhpcy5wZXJjZW50fSXvvIzor7fms6jmhI9gXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tMaW1pdCgpOiB2b2lkIHtcclxuICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmraPlnKjmo4DmtYvnvJPlrZjlrrnph48nfSk7XHJcbiAgICAgICAgaWYgKHRoaXMubGltaXRDaGVja2luZykge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubGltaXRDaGVja2luZyA9IHRydWU7XHJcblxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGxldCBiYXNlID0gdGhpcy51c2FnZTtcclxuICAgICAgICAgICAgbGV0IGFkZExlbmd0aCA9IDEwMDAwMDA7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IDA7XHJcblxyXG4gICAgICAgICAgICB3aGlsZSAoYWRkTGVuZ3RoID4gMikge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQga2V5ID0gYF90ZXN0JHtpbmRleCsrfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFkZExlbmd0aCA8IGtleS5sZW5ndGgpIHticmVhazt9XHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBuZXcgQXJyYXkoYWRkTGVuZ3RoIC0ga2V5Lmxlbmd0aCArIDEpLmpvaW4oJ2EnKSk7ICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGJhc2UgKz0gYWRkTGVuZ3RoOyAgICAgXHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcclxuICAgICAgICAgICAgICAgICAgICBpbmRleC0tO1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZExlbmd0aCA9IE1hdGgucm91bmQoYWRkTGVuZ3RoIC8gMik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5saW1pdCA9IGJhc2U7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmdldEJ5SGVhZCgnX3Rlc3QnKS5mb3JFYWNoKHYgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kZWwodilcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnNldCgnbGltaXQnLCB0aGlzLmxpbWl0LnRvU3RyaW5nKCkpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5saW1pdENoZWNraW5nID0gZmFsc2U7XHJcblxyXG4gICAgICAgICAgICB3aW5kb3cuTWVzc2FnZS5hZGQoe2NvbnRlbnQ6ICfmo4DmtYvlrozmiJAnfSk7XHJcbiAgICAgICAgfSwgMTAwMCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBTdG9yZTsiLCJpbXBvcnQge21ha2VEaXNwbGF5VGV4dH0gZnJvbSAnLi4vY29tbW9uL2NvbW1vbic7XHJcblxyXG5jbGFzcyBDb25maWcge1xyXG4gICAgZWxlbWVudDogSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgZGlzcGxheVRleHQ6IHN0cmluZztcclxuXHJcbiAgICB1cmw6IHN0cmluZztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucGFnZS5jb25maWcnKTtcclxuXHJcbiAgICAgICAgdGhpcy51cmwgPSB3aW5kb3cuQXBpLnVybDtcclxuXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5VGV4dCA9IG1ha2VEaXNwbGF5VGV4dCgyMDApO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kSW5wdXQodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy51cmwgaW5wdXQnKSwgdGhpcywgJ3VybCcpO1xyXG5cclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyh0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnN0b3JlLXVzYWdlJyksIHdpbmRvdy5TdG9yZSwgJ3VzYWdlJyk7XHJcbiAgICAgICAgd2luZG93LkJpbmQuYmluZFZpZXcodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zdG9yZS10b3RhbCcpLCB3aW5kb3cuU3RvcmUsICdsaW1pdCcpO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc3RvcmUtcGVyY2VudCcpLCB3aW5kb3cuU3RvcmUsICdwZXJjZW50JywgKHY6IG51bWJlcikgPT4gYCAgKCAke3Z9JSApYCk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuZm9udC1zaXplJyksIHdpbmRvdy5MYXlvdXQsICdmb250U2l6ZScpO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRWaWV3KHRoaXMuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcubGluZS1oZWlnaHQnKSwgd2luZG93LkxheW91dCwgJ2xpbmVIZWlnaHQnKTtcclxuXHJcbiAgICAgICAgbGV0IGRpc3BsYXk6IEhUTUxFbGVtZW50ID0gdGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kaXNwbGF5IC50ZXh0IHAnKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kVmlldyhkaXNwbGF5LCB0aGlzLCAnZGlzcGxheVRleHQnKTtcclxuICAgICAgICB3aW5kb3cuQmluZC5iaW5kU3R5bGUoZGlzcGxheSwgd2luZG93LkxheW91dCwgJ2ZvbnRTaXplJywgJ2ZvbnRTaXplJywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG4gICAgICAgIHdpbmRvdy5CaW5kLmJpbmRTdHlsZShkaXNwbGF5LCB3aW5kb3cuTGF5b3V0LCAnbGluZUhlaWdodCcsICdsaW5lSGVpZ2h0JywgKHY6IGFueSkgPT4gYCR7dn1weGApO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMudXJsKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5NZXNzYWdlLmFkZCh7Y29udGVudDogJ+W9k+WJjeacqumFjee9ruacjeWKoeWZqOWcsOWdgCd9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrVXJsKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuXHJcbiAgICBjaGVja1VybCgpIHtcclxuICAgICAgICB3aW5kb3cuQXBpLmNoZWNrVXJsKHRoaXMudXJsKTtcclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IENvbmZpZzsiLCJpbXBvcnQgQm9va1NoZWxmIGZyb20gJy4vYm9va3NoZWxmL2Jvb2tzaGVsZic7XHJcbmltcG9ydCBDb25maWcgZnJvbSAnLi9jb25maWcvY29uZmlnJztcclxuaW1wb3J0IFJvdXRlciBmcm9tICcuL2NvbW1vbi9yb3V0ZXIvcm91dGVyJztcclxuaW1wb3J0IERlYnVnZ2VyIGZyb20gJy4vY29tbW9uL2RlYnVnZ2VyL2RlYnVnZ2VyJztcclxuaW1wb3J0IE1vZGFsIGZyb20gJy4vY29tbW9uL21vZGFsL21vZGFsJztcclxuaW1wb3J0IE1lc3NhZ2UgZnJvbSAnLi9jb21tb24vbWVzc2FnZS9tZXNzYWdlJztcclxuaW1wb3J0IFN0b3JlIGZyb20gJy4vY29tbW9uL3N0b3JlL3N0b3JlJztcclxuaW1wb3J0IEJpbmQgZnJvbSAnLi9jb21tb24vYmluZC9iaW5kJztcclxuaW1wb3J0IExheW91dCBmcm9tICcuL2NvbW1vbi9sYXlvdXQvbGF5b3V0JztcclxuaW1wb3J0IEFwaSBmcm9tICcuL2NvbW1vbi9hcGkvYXBpJztcclxuaW1wb3J0IEFydGljbGUgZnJvbSAnLi9hcnRpY2xlL2FydGljbGUnO1xyXG5pbXBvcnQgQ2F0YWxvZ3VlIGZyb20gJy4vY2F0YWxvZ3VlL2NhdGFsb2d1ZSc7XHJcblxyXG5jb25zdCBwYWdlczogc3RyaW5nW10gPSBbJ2NvbmZpZycsICdib29rc2hlbGYnLCAnYXJ0aWNsZScsICdjYXRhbG9ndWUnXTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICBuZXcgRGVidWdnZXIoKTtcclxuXHJcbiAgICBuZXcgQmluZCgpO1xyXG5cclxuICAgIG5ldyBNb2RhbCgpO1xyXG4gICAgbmV3IE1lc3NhZ2UoKTtcclxuXHJcbiAgICBuZXcgUm91dGVyKHBhZ2VzKTtcclxuXHJcbiAgICBuZXcgU3RvcmUoKTtcclxuXHJcbiAgICBuZXcgTGF5b3V0KCk7XHJcblxyXG4gICAgbmV3IEFwaSgpO1xyXG5cclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5nbG9iYWwtc3R5bGUnKS5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPHN0eWxlPlxyXG4gICAgICAgICAgICAucGFnZSAuY29udGVudCB7XHJcbiAgICAgICAgICAgICAgICBoZWlnaHQ6ICR7ZG9jdW1lbnQuYm9keS5vZmZzZXRIZWlnaHQgLSAyMzB9cHg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICA8L3N0eWxlPlxyXG4gICAgYDtcclxuXHJcbiAgICB3aW5kb3cuQ29uZmlnID0gbmV3IENvbmZpZygpO1xyXG5cclxuICAgIHdpbmRvdy5Cb29rU2hlbGYgPSBuZXcgQm9va1NoZWxmKCk7XHJcbiAgICBcclxuICAgIHdpbmRvdy5DYXRhbG9ndWUgPSBuZXcgQ2F0YWxvZ3VlKCk7XHJcblxyXG4gICAgd2luZG93LkFydGljbGUgPSBuZXcgQXJ0aWNsZSgpO1xyXG5cclxufVxyXG5cclxud2luZG93LmluaXQgPSBpbml0O1xyXG5cclxuXHJcblxyXG53aW5kb3cub25kYmxjbGljayA9IGZ1bmN0aW9uKGV2ZW50OiBFdmVudCkge1xyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxufSJdfQ==
