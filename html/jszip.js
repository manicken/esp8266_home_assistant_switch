
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.JSZip = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
  'use strict';
  var utils = require('./utils');
  var support = require('./support');
  var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  exports.encode = function(input) {
      var output = [];
      var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
      var i = 0, len = input.length, remainingBytes = len;
  
      var isArray = utils.getTypeOf(input) !== "string";
      while (i < input.length) {
          remainingBytes = len - i;
  
          if (!isArray) {
              chr1 = input.charCodeAt(i++);
              chr2 = i < len ? input.charCodeAt(i++) : 0;
              chr3 = i < len ? input.charCodeAt(i++) : 0;
          } else {
              chr1 = input[i++];
              chr2 = i < len ? input[i++] : 0;
              chr3 = i < len ? input[i++] : 0;
          }
  
          enc1 = chr1 >> 2;
          enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
          enc3 = remainingBytes > 1 ? (((chr2 & 15) << 2) | (chr3 >> 6)) : 64;
          enc4 = remainingBytes > 2 ? (chr3 & 63) : 64;
  
          output.push(_keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4));
  
      }
  
      return output.join("");
  };
  exports.decode = function(input) {
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0, resultIndex = 0;
  
      var dataUrlPrefix = "data:";
  
      if (input.substr(0, dataUrlPrefix.length) === dataUrlPrefix) {
          // (data:image/png;base64,iVBOR...) with a {base64: true} and
          // We can detect that the string input looks like a data url but we
          // be too dangerous.
          throw new Error("Invalid base64 input, it looks like a data url.");
      }
  
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  
      var totalLength = input.length * 3 / 4;
      if(input.charAt(input.length - 1) === _keyStr.charAt(64)) {
          totalLength--;
      }
      if(input.charAt(input.length - 2) === _keyStr.charAt(64)) {
          totalLength--;
      }
      if (totalLength % 1 !== 0) {
          // base64 content. That can happen if:
          // - the input is *almost* a base64 content, with a extra chars at the
          // - the input uses a base64 variant (base64url for example)
          throw new Error("Invalid base64 input, bad content length.");
      }
      var output;
      if (support.uint8array) {
          output = new Uint8Array(totalLength|0);
      } else {
          output = new Array(totalLength|0);
      }
  
      while (i < input.length) {
  
          enc1 = _keyStr.indexOf(input.charAt(i++));
          enc2 = _keyStr.indexOf(input.charAt(i++));
          enc3 = _keyStr.indexOf(input.charAt(i++));
          enc4 = _keyStr.indexOf(input.charAt(i++));
  
          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;
  
          output[resultIndex++] = chr1;
  
          if (enc3 !== 64) {
              output[resultIndex++] = chr2;
          }
          if (enc4 !== 64) {
              output[resultIndex++] = chr3;
          }
  
      }
  
      return output;
  };
  
  },{"./support":30,"./utils":32}],2:[function(require,module,exports){
  'use strict';
  
  var external = require("./external");
  var DataWorker = require('./stream/DataWorker');
  var DataLengthProbe = require('./stream/DataLengthProbe');
  var Crc32Probe = require('./stream/Crc32Probe');
  var DataLengthProbe = require('./stream/DataLengthProbe');
  function CompressedObject(compressedSize, uncompressedSize, crc32, compression, data) {
      this.compressedSize = compressedSize;
      this.uncompressedSize = uncompressedSize;
      this.crc32 = crc32;
      this.compression = compression;
      this.compressedContent = data;
  }
  
  CompressedObject.prototype = {
      getContentWorker : function () {
          var worker = new DataWorker(external.Promise.resolve(this.compressedContent))
          .pipe(this.compression.uncompressWorker())
          .pipe(new DataLengthProbe("data_length"));
  
          var that = this;
          worker.on("end", function () {
              if(this.streamInfo['data_length'] !== that.uncompressedSize) {
                  throw new Error("Bug : uncompressed data size mismatch");
              }
          });
          return worker;
      },
      getCompressedWorker : function () {
          return new DataWorker(external.Promise.resolve(this.compressedContent))
          .withStreamInfo("compressedSize", this.compressedSize)
          .withStreamInfo("uncompressedSize", this.uncompressedSize)
          .withStreamInfo("crc32", this.crc32)
          .withStreamInfo("compression", this.compression)
          ;
      }
  };
  CompressedObject.createWorkerFrom = function (uncompressedWorker, compression, compressionOptions) {
      return uncompressedWorker
      .pipe(new Crc32Probe())
      .pipe(new DataLengthProbe("uncompressedSize"))
      .pipe(compression.compressWorker(compressionOptions))
      .pipe(new DataLengthProbe("compressedSize"))
      .withStreamInfo("compression", compression);
  };
  
  module.exports = CompressedObject;
  
  },{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(require,module,exports){
  'use strict';
  
  var GenericWorker = require("./stream/GenericWorker");
  
  exports.STORE = {
      magic: "\x00\x00",
      compressWorker : function (compressionOptions) {
          return new GenericWorker("STORE compression");
      },
      uncompressWorker : function () {
          return new GenericWorker("STORE decompression");
      }
  };
  exports.DEFLATE = require('./flate');
  
  },{"./flate":7,"./stream/GenericWorker":28}],4:[function(require,module,exports){
  'use strict';
  
  var utils = require('./utils');
  function makeTable() {
      var c, table = [];
  
      for(var n =0; n < 256; n++){
          c = n;
          for(var k =0; k < 8; k++){
              c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
          }
          table[n] = c;
      }
  
      return table;
  }
  var crcTable = makeTable();
  
  
  function crc32(crc, buf, len, pos) {
      var t = crcTable, end = pos + len;
  
      crc = crc ^ (-1);
  
      for (var i = pos; i < end; i++ ) {
          crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
      }
  
      return (crc ^ (-1)); // >>> 0;
  }
  function crc32str(crc, str, len, pos) {
      var t = crcTable, end = pos + len;
  
      crc = crc ^ (-1);
  
      for (var i = pos; i < end; i++ ) {
          crc = (crc >>> 8) ^ t[(crc ^ str.charCodeAt(i)) & 0xFF];
      }
  
      return (crc ^ (-1)); // >>> 0;
  }
  
  module.exports = function crc32wrapper(input, crc) {
      if (typeof input === "undefined" || !input.length) {
          return 0;
      }
  
      var isArray = utils.getTypeOf(input) !== "string";
  
      if(isArray) {
          return crc32(crc|0, input, input.length, 0);
      } else {
          return crc32str(crc|0, input, input.length, 0);
      }
  };
  
  },{"./utils":32}],5:[function(require,module,exports){
  'use strict';
  exports.base64 = false;
  exports.binary = false;
  exports.dir = false;
  exports.createFolders = true;
  exports.date = null;
  exports.compression = null;
  exports.compressionOptions = null;
  exports.comment = null;
  exports.unixPermissions = null;
  exports.dosPermissions = null;
  
  },{}],6:[function(require,module,exports){
  'use strict';
  // - it should be better integrated in the system (unhandledRejection in node)
  var ES6Promise = null;
  if (typeof Promise !== "undefined") {
      ES6Promise = Promise;
  } else {
      ES6Promise = require("lie");
  }
  module.exports = {
      Promise: ES6Promise
  };
  
  },{"lie":37}],7:[function(require,module,exports){
  'use strict';
  var USE_TYPEDARRAY = (typeof Uint8Array !== 'undefined') && (typeof Uint16Array !== 'undefined') && (typeof Uint32Array !== 'undefined');
  
  var pako = require("pako");
  var utils = require("./utils");
  var GenericWorker = require("./stream/GenericWorker");
  
  var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";
  
  exports.magic = "\x08\x00";
  function FlateWorker(action, options) {
      GenericWorker.call(this, "FlateWorker/" + action);
  
      this._pako = null;
      this._pakoAction = action;
      this._pakoOptions = options;
      // this allow this worker to pass around metadata
      this.meta = {};
  }
  
  utils.inherits(FlateWorker, GenericWorker);
  FlateWorker.prototype.processChunk = function (chunk) {
      this.meta = chunk.meta;
      if (this._pako === null) {
          this._createPako();
      }
      this._pako.push(utils.transformTo(ARRAY_TYPE, chunk.data), false);
  };
  FlateWorker.prototype.flush = function () {
      GenericWorker.prototype.flush.call(this);
      if (this._pako === null) {
          this._createPako();
      }
      this._pako.push([], true);
  };
  FlateWorker.prototype.cleanUp = function () {
      GenericWorker.prototype.cleanUp.call(this);
      this._pako = null;
  };
  FlateWorker.prototype._createPako = function () {
      this._pako = new pako[this._pakoAction]({
          raw: true,
          level: this._pakoOptions.level || -1 // default compression
      });
      var self = this;
      this._pako.onData = function(data) {
          self.push({
              data : data,
              meta : self.meta
          });
      };
  };
  
  exports.compressWorker = function (compressionOptions) {
      return new FlateWorker("Deflate", compressionOptions);
  };
  exports.uncompressWorker = function () {
      return new FlateWorker("Inflate", {});
  };
  
  },{"./stream/GenericWorker":28,"./utils":32,"pako":38}],8:[function(require,module,exports){
  'use strict';
  
  var utils = require('../utils');
  var GenericWorker = require('../stream/GenericWorker');
  var utf8 = require('../utf8');
  var crc32 = require('../crc32');
  var signature = require('../signature');
  var decToHex = function(dec, bytes) {
      var hex = "", i;
      for (i = 0; i < bytes; i++) {
          hex += String.fromCharCode(dec & 0xff);
          dec = dec >>> 8;
      }
      return hex;
  };
  var generateUnixExternalFileAttr = function (unixPermissions, isDir) {
  
      var result = unixPermissions;
      if (!unixPermissions) {
          //  040775 => 0x41fd
          result = isDir ? 0x41fd : 0x81b4;
      }
      return (result & 0xFFFF) << 16;
  };
  var generateDosExternalFileAttr = function (dosPermissions, isDir) {
      return (dosPermissions || 0)  & 0x3F;
  };
  var generateZipParts = function(streamInfo, streamedContent, streamingEnded, offset, platform, encodeFileName) {
      var file = streamInfo['file'],
      compression = streamInfo['compression'],
      useCustomEncoding = encodeFileName !== utf8.utf8encode,
      encodedFileName = utils.transformTo("string", encodeFileName(file.name)),
      utfEncodedFileName = utils.transformTo("string", utf8.utf8encode(file.name)),
      comment = file.comment,
      encodedComment = utils.transformTo("string", encodeFileName(comment)),
      utfEncodedComment = utils.transformTo("string", utf8.utf8encode(comment)),
      useUTF8ForFileName = utfEncodedFileName.length !== file.name.length,
      useUTF8ForComment = utfEncodedComment.length !== comment.length,
      dosTime,
      dosDate,
      extraFields = "",
      unicodePathExtraField = "",
      unicodeCommentExtraField = "",
      dir = file.dir,
      date = file.date;
  
  
      var dataInfo = {
          crc32 : 0,
          compressedSize : 0,
          uncompressedSize : 0
      };
      // the end of the stream.
      if (!streamedContent || streamingEnded) {
          dataInfo.crc32 = streamInfo['crc32'];
          dataInfo.compressedSize = streamInfo['compressedSize'];
          dataInfo.uncompressedSize = streamInfo['uncompressedSize'];
      }
  
      var bitflag = 0;
      if (streamedContent) {
          // The correct values are put in the data descriptor immediately
          bitflag |= 0x0008;
      }
      if (!useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment)) {
          bitflag |= 0x0800;
      }
  
  
      var extFileAttr = 0;
      var versionMadeBy = 0;
      if (dir) {
          extFileAttr |= 0x00010;
      }
      if(platform === "UNIX") {
          versionMadeBy = 0x031E; // UNIX, version 3.0
          extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
      } else { // DOS or other, fallback to DOS
          versionMadeBy = 0x0014; // DOS, version 2.0
          extFileAttr |= generateDosExternalFileAttr(file.dosPermissions, dir);
      }
      // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
      // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html
  
      dosTime = date.getUTCHours();
      dosTime = dosTime << 6;
      dosTime = dosTime | date.getUTCMinutes();
      dosTime = dosTime << 5;
      dosTime = dosTime | date.getUTCSeconds() / 2;
  
      dosDate = date.getUTCFullYear() - 1980;
      dosDate = dosDate << 4;
      dosDate = dosDate | (date.getUTCMonth() + 1);
      dosDate = dosDate << 5;
      dosDate = dosDate | date.getUTCDate();
  
      if (useUTF8ForFileName) {
          // field to correctly handle unicode path, so using the path is as good
          // other archive managers too.
          // unicode path in the header (winrar, winzip). This helps (a bit)
          // breaks on p7zip which doesn't seek the unicode path extra field.
          unicodePathExtraField =
              decToHex(1, 1) +
              decToHex(crc32(encodedFileName), 4) +
              utfEncodedFileName;
  
          extraFields +=
              "\x75\x70" +
              decToHex(unicodePathExtraField.length, 2) +
              unicodePathExtraField;
      }
  
      if(useUTF8ForComment) {
  
          unicodeCommentExtraField =
              decToHex(1, 1) +
              decToHex(crc32(encodedComment), 4) +
              utfEncodedComment;
  
          extraFields +=
              "\x75\x63" +
              decToHex(unicodeCommentExtraField.length, 2) +
              unicodeCommentExtraField;
      }
  
      var header = "";
      header += "\x0A\x00";
      header += decToHex(bitflag, 2);
      header += compression.magic;
      header += decToHex(dosTime, 2);
      header += decToHex(dosDate, 2);
      header += decToHex(dataInfo.crc32, 4);
      header += decToHex(dataInfo.compressedSize, 4);
      header += decToHex(dataInfo.uncompressedSize, 4);
      header += decToHex(encodedFileName.length, 2);
      header += decToHex(extraFields.length, 2);
  
  
      var fileRecord = signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields;
  
      var dirRecord = signature.CENTRAL_FILE_HEADER +
          decToHex(versionMadeBy, 2) +
          header +
          decToHex(encodedComment.length, 2) +
          "\x00\x00" +
          "\x00\x00" +
          decToHex(extFileAttr, 4) +
          decToHex(offset, 4) +
          encodedFileName +
          extraFields +
          encodedComment;
  
      return {
          fileRecord: fileRecord,
          dirRecord: dirRecord
      };
  };
  var generateCentralDirectoryEnd = function (entriesCount, centralDirLength, localDirLength, comment, encodeFileName) {
      var dirEnd = "";
      var encodedComment = utils.transformTo("string", encodeFileName(comment));
      dirEnd = signature.CENTRAL_DIRECTORY_END +
          "\x00\x00" +
          "\x00\x00" +
          decToHex(entriesCount, 2) +
          decToHex(entriesCount, 2) +
          decToHex(centralDirLength, 4) +
          decToHex(localDirLength, 4) +
          decToHex(encodedComment.length, 2) +
          encodedComment;
  
      return dirEnd;
  };
  var generateDataDescriptors = function (streamInfo) {
      var descriptor = "";
      descriptor = signature.DATA_DESCRIPTOR +
          decToHex(streamInfo['crc32'], 4) +
          decToHex(streamInfo['compressedSize'], 4) +
          decToHex(streamInfo['uncompressedSize'], 4);
  
      return descriptor;
  };
  function ZipFileWorker(streamFiles, comment, platform, encodeFileName) {
      GenericWorker.call(this, "ZipFileWorker");
      this.bytesWritten = 0;
      this.zipComment = comment;
      this.zipPlatform = platform;
      this.encodeFileName = encodeFileName;
      this.streamFiles = streamFiles;
      // files to calculate sizes / crc32 (and write them *before* the content).
      // during the lifetime of this worker).
      this.accumulate = false;
      this.contentBuffer = [];
      this.dirRecords = [];
      this.currentSourceOffset = 0;
      this.entriesCount = 0;
      // Used for the emitted metadata.
      this.currentFile = null;
  
  
  
      this._sources = [];
  }
  utils.inherits(ZipFileWorker, GenericWorker);
  ZipFileWorker.prototype.push = function (chunk) {
  
      var currentFilePercent = chunk.meta.percent || 0;
      var entriesCount = this.entriesCount;
      var remainingFiles = this._sources.length;
  
      if(this.accumulate) {
          this.contentBuffer.push(chunk);
      } else {
          this.bytesWritten += chunk.data.length;
  
          GenericWorker.prototype.push.call(this, {
              data : chunk.data,
              meta : {
                  currentFile : this.currentFile,
                  percent : entriesCount ? (currentFilePercent + 100 * (entriesCount - remainingFiles - 1)) / entriesCount : 100
              }
          });
      }
  };
  ZipFileWorker.prototype.openedSource = function (streamInfo) {
      this.currentSourceOffset = this.bytesWritten;
      this.currentFile = streamInfo['file'].name;
  
      var streamedContent = this.streamFiles && !streamInfo['file'].dir;
      if(streamedContent) {
          var record = generateZipParts(streamInfo, streamedContent, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          this.push({
              data : record.fileRecord,
              meta : {percent:0}
          });
      } else {
          this.accumulate = true;
      }
  };
  ZipFileWorker.prototype.closedSource = function (streamInfo) {
      this.accumulate = false;
      var streamedContent = this.streamFiles && !streamInfo['file'].dir;
      var record = generateZipParts(streamInfo, streamedContent, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
  
      this.dirRecords.push(record.dirRecord);
      if(streamedContent) {
          this.push({
              data : generateDataDescriptors(streamInfo),
              meta : {percent:100}
          });
      } else {
          // first the file record, then the content
          this.push({
              data : record.fileRecord,
              meta : {percent:0}
          });
          while(this.contentBuffer.length) {
              this.push(this.contentBuffer.shift());
          }
      }
      this.currentFile = null;
  };
  ZipFileWorker.prototype.flush = function () {
  
      var localDirLength = this.bytesWritten;
      for(var i = 0; i < this.dirRecords.length; i++) {
          this.push({
              data : this.dirRecords[i],
              meta : {percent:100}
          });
      }
      var centralDirLength = this.bytesWritten - localDirLength;
  
      var dirEnd = generateCentralDirectoryEnd(this.dirRecords.length, centralDirLength, localDirLength, this.zipComment, this.encodeFileName);
  
      this.push({
          data : dirEnd,
          meta : {percent:100}
      });
  };
  ZipFileWorker.prototype.prepareNextSource = function () {
      this.previous = this._sources.shift();
      this.openedSource(this.previous.streamInfo);
      if (this.isPaused) {
          this.previous.pause();
      } else {
          this.previous.resume();
      }
  };
  ZipFileWorker.prototype.registerPrevious = function (previous) {
      this._sources.push(previous);
      var self = this;
  
      previous.on('data', function (chunk) {
          self.processChunk(chunk);
      });
      previous.on('end', function () {
          self.closedSource(self.previous.streamInfo);
          if(self._sources.length) {
              self.prepareNextSource();
          } else {
              self.end();
          }
      });
      previous.on('error', function (e) {
          self.error(e);
      });
      return this;
  };
  ZipFileWorker.prototype.resume = function () {
      if(!GenericWorker.prototype.resume.call(this)) {
          return false;
      }
  
      if (!this.previous && this._sources.length) {
          this.prepareNextSource();
          return true;
      }
      if (!this.previous && !this._sources.length && !this.generatedError) {
          this.end();
          return true;
      }
  };
  ZipFileWorker.prototype.error = function (e) {
      var sources = this._sources;
      if(!GenericWorker.prototype.error.call(this, e)) {
          return false;
      }
      for(var i = 0; i < sources.length; i++) {
          try {
              sources[i].error(e);
          } catch(e) {
          }
      }
      return true;
  };
  ZipFileWorker.prototype.lock = function () {
      GenericWorker.prototype.lock.call(this);
      var sources = this._sources;
      for(var i = 0; i < sources.length; i++) {
          sources[i].lock();
      }
  };
  
  module.exports = ZipFileWorker;
  
  },{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(require,module,exports){
  'use strict';
  
  var compressions = require('../compressions');
  var ZipFileWorker = require('./ZipFileWorker');
  var getCompression = function (fileCompression, zipCompression) {
  
      var compressionName = fileCompression || zipCompression;
      var compression = compressions[compressionName];
      if (!compression) {
          throw new Error(compressionName + " is not a valid compression method !");
      }
      return compression;
  };
  exports.generateWorker = function (zip, options, comment) {
  
      var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
      var entriesCount = 0;
      try {
  
          zip.forEach(function (relativePath, file) {
              entriesCount++;
              var compression = getCompression(file.options.compression, options.compression);
              var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
              var dir = file.dir, date = file.date;
  
              file._compressWorker(compression, compressionOptions)
              .withStreamInfo("file", {
                  name : relativePath,
                  dir : dir,
                  date : date,
                  comment : file.comment || "",
                  unixPermissions : file.unixPermissions,
                  dosPermissions : file.dosPermissions
              })
              .pipe(zipFileWorker);
          });
          zipFileWorker.entriesCount = entriesCount;
      } catch (e) {
          zipFileWorker.error(e);
      }
  
      return zipFileWorker;
  };
  
  },{"../compressions":3,"./ZipFileWorker":8}],10:[function(require,module,exports){
  'use strict';
  function JSZip() {
      if(!(this instanceof JSZip)) {
          return new JSZip();
      }
  
      if(arguments.length) {
          throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
      }
      // {
      //   "folder/data.txt" : {...}
      this.files = {};
  
      this.comment = null;
      this.root = "";
      this.clone = function() {
          var newObj = new JSZip();
          for (var i in this) {
              if (typeof this[i] !== "function") {
                  newObj[i] = this[i];
              }
          }
          return newObj;
      };
  }
  JSZip.prototype = require('./object');
  JSZip.prototype.loadAsync = require('./load');
  JSZip.support = require('./support');
  JSZip.defaults = require('./defaults');
  // a require('package.json').version doesn't work with webpack, see #327
  JSZip.version = "3.5.0";
  
  JSZip.loadAsync = function (content, options) {
      return new JSZip().loadAsync(content, options);
  };
  
  JSZip.external = require("./external");
  module.exports = JSZip;
  
  },{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(require,module,exports){
  'use strict';
  var utils = require('./utils');
  var external = require("./external");
  var utf8 = require('./utf8');
  var utils = require('./utils');
  var ZipEntries = require('./zipEntries');
  var Crc32Probe = require('./stream/Crc32Probe');
  var nodejsUtils = require("./nodejsUtils");
  function checkEntryCRC32(zipEntry) {
      return new external.Promise(function (resolve, reject) {
          var worker = zipEntry.decompressed.getContentWorker().pipe(new Crc32Probe());
          worker.on("error", function (e) {
              reject(e);
          })
          .on("end", function () {
              if (worker.streamInfo.crc32 !== zipEntry.decompressed.crc32) {
                  reject(new Error("Corrupted zip : CRC32 mismatch"));
              } else {
                  resolve();
              }
          })
          .resume();
      });
  }
  
  module.exports = function(data, options) {
      var zip = this;
      options = utils.extend(options || {}, {
          base64: false,
          checkCRC32: false,
          optimizedBinaryString: false,
          createFolders: false,
          decodeFileName: utf8.utf8decode
      });
  
      if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
          return external.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file."));
      }
  
      return utils.prepareContent("the loaded zip file", data, true, options.optimizedBinaryString, options.base64)
      .then(function(data) {
          var zipEntries = new ZipEntries(options);
          zipEntries.load(data);
          return zipEntries;
      }).then(function checkCRC32(zipEntries) {
          var promises = [external.Promise.resolve(zipEntries)];
          var files = zipEntries.files;
          if (options.checkCRC32) {
              for (var i = 0; i < files.length; i++) {
                  promises.push(checkEntryCRC32(files[i]));
              }
          }
          return external.Promise.all(promises);
      }).then(function addFiles(results) {
          var zipEntries = results.shift();
          var files = zipEntries.files;
          for (var i = 0; i < files.length; i++) {
              var input = files[i];
              zip.file(input.fileNameStr, input.decompressed, {
                  binary: true,
                  optimizedBinaryString: true,
                  date: input.date,
                  dir: input.dir,
                  comment : input.fileCommentStr.length ? input.fileCommentStr : null,
                  unixPermissions : input.unixPermissions,
                  dosPermissions : input.dosPermissions,
                  createFolders: options.createFolders
              });
          }
          if (zipEntries.zipComment.length) {
              zip.comment = zipEntries.zipComment;
          }
  
          return zip;
      });
  };
  
  },{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(require,module,exports){
  "use strict";
  
  var utils = require('../utils');
  var GenericWorker = require('../stream/GenericWorker');
  function NodejsStreamInputAdapter(filename, stream) {
      GenericWorker.call(this, "Nodejs stream input adapter for " + filename);
      this._upstreamEnded = false;
      this._bindStream(stream);
  }
  
  utils.inherits(NodejsStreamInputAdapter, GenericWorker);
  NodejsStreamInputAdapter.prototype._bindStream = function (stream) {
      var self = this;
      this._stream = stream;
      stream.pause();
      stream
      .on("data", function (chunk) {
          self.push({
              data: chunk,
              meta : {
                  percent : 0
              }
          });
      })
      .on("error", function (e) {
          if(self.isPaused) {
              this.generatedError = e;
          } else {
              self.error(e);
          }
      })
      .on("end", function () {
          if(self.isPaused) {
              self._upstreamEnded = true;
          } else {
              self.end();
          }
      });
  };
  NodejsStreamInputAdapter.prototype.pause = function () {
      if(!GenericWorker.prototype.pause.call(this)) {
          return false;
      }
      this._stream.pause();
      return true;
  };
  NodejsStreamInputAdapter.prototype.resume = function () {
      if(!GenericWorker.prototype.resume.call(this)) {
          return false;
      }
  
      if(this._upstreamEnded) {
          this.end();
      } else {
          this._stream.resume();
      }
  
      return true;
  };
  
  module.exports = NodejsStreamInputAdapter;
  
  },{"../stream/GenericWorker":28,"../utils":32}],13:[function(require,module,exports){
  'use strict';
  
  var Readable = require('readable-stream').Readable;
  
  var utils = require('../utils');
  utils.inherits(NodejsStreamOutputAdapter, Readable);
  function NodejsStreamOutputAdapter(helper, options, updateCb) {
      Readable.call(this, options);
      this._helper = helper;
  
      var self = this;
      helper.on("data", function (data, meta) {
          if (!self.push(data)) {
              self._helper.pause();
          }
          if(updateCb) {
              updateCb(meta);
          }
      })
      .on("error", function(e) {
          self.emit('error', e);
      })
      .on("end", function () {
          self.push(null);
      });
  }
  
  
  NodejsStreamOutputAdapter.prototype._read = function() {
      this._helper.resume();
  };
  
  module.exports = NodejsStreamOutputAdapter;
  
  },{"../utils":32,"readable-stream":16}],14:[function(require,module,exports){
  'use strict';
  
  module.exports = {
      isNode : typeof Buffer !== "undefined",
      newBufferFrom: function(data, encoding) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) {
              return Buffer.from(data, encoding);
          } else {
              if (typeof data === "number") {
                  // Buffer.from(number) / Buffer(number, encoding) already throw.
                  throw new Error("The \"data\" argument must not be a number");
              }
              return new Buffer(data, encoding);
          }
      },
      allocBuffer: function (size) {
          if (Buffer.alloc) {
              return Buffer.alloc(size);
          } else {
              var buf = new Buffer(size);
              buf.fill(0);
              return buf;
          }
      },
      isBuffer : function(b){
          return Buffer.isBuffer(b);
      },
  
      isStream : function (obj) {
          return obj &&
              typeof obj.on === "function" &&
              typeof obj.pause === "function" &&
              typeof obj.resume === "function";
      }
  };
  
  },{}],15:[function(require,module,exports){
  'use strict';
  var utf8 = require('./utf8');
  var utils = require('./utils');
  var GenericWorker = require('./stream/GenericWorker');
  var StreamHelper = require('./stream/StreamHelper');
  var defaults = require('./defaults');
  var CompressedObject = require('./compressedObject');
  var ZipObject = require('./zipObject');
  var generate = require("./generate");
  var nodejsUtils = require("./nodejsUtils");
  var NodejsStreamInputAdapter = require("./nodejs/NodejsStreamInputAdapter");
  var fileAdd = function(name, data, originalOptions) {
      var dataType = utils.getTypeOf(data),
          parent;
      var o = utils.extend(originalOptions || {}, defaults);
      o.date = o.date || new Date();
      if (o.compression !== null) {
          o.compression = o.compression.toUpperCase();
      }
  
      if (typeof o.unixPermissions === "string") {
          o.unixPermissions = parseInt(o.unixPermissions, 8);
      }
      if (o.unixPermissions && (o.unixPermissions & 0x4000)) {
          o.dir = true;
      }
      if (o.dosPermissions && (o.dosPermissions & 0x0010)) {
          o.dir = true;
      }
  
      if (o.dir) {
          name = forceTrailingSlash(name);
      }
      if (o.createFolders && (parent = parentFolder(name))) {
          folderAdd.call(this, parent, true);
      }
  
      var isUnicodeString = dataType === "string" && o.binary === false && o.base64 === false;
      if (!originalOptions || typeof originalOptions.binary === "undefined") {
          o.binary = !isUnicodeString;
      }
  
  
      var isCompressedEmpty = (data instanceof CompressedObject) && data.uncompressedSize === 0;
  
      if (isCompressedEmpty || o.dir || !data || data.length === 0) {
          o.base64 = false;
          o.binary = true;
          data = "";
          o.compression = "STORE";
          dataType = "string";
      }
      var zipObjectContent = null;
      if (data instanceof CompressedObject || data instanceof GenericWorker) {
          zipObjectContent = data;
      } else if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
          zipObjectContent = new NodejsStreamInputAdapter(name, data);
      } else {
          zipObjectContent = utils.prepareContent(name, data, o.binary, o.optimizedBinaryString, o.base64);
      }
  
      var object = new ZipObject(name, zipObjectContent, o);
      this.files[name] = object;
  };
  var parentFolder = function (path) {
      if (path.slice(-1) === '/') {
          path = path.substring(0, path.length - 1);
      }
      var lastSlash = path.lastIndexOf('/');
      return (lastSlash > 0) ? path.substring(0, lastSlash) : "";
  };
  var forceTrailingSlash = function(path) {
      if (path.slice(-1) !== "/") {
          path += "/"; // IE doesn't like substr(-1)
      }
      return path;
  };
  var folderAdd = function(name, createFolders) {
      createFolders = (typeof createFolders !== 'undefined') ? createFolders : defaults.createFolders;
  
      name = forceTrailingSlash(name);
      if (!this.files[name]) {
          fileAdd.call(this, name, null, {
              dir: true,
              createFolders: createFolders
          });
      }
      return this.files[name];
  };
  function isRegExp(object) {
      return Object.prototype.toString.call(object) === "[object RegExp]";
  }
  var out = {
      load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
      },
      forEach: function(cb) {
          var filename, relativePath, file;
          for (filename in this.files) {
              if (!this.files.hasOwnProperty(filename)) {
                  continue;
              }
              file = this.files[filename];
              relativePath = filename.slice(this.root.length, filename.length);
              if (relativePath && filename.slice(0, this.root.length) === this.root) { // the file is in the current root
                  cb(relativePath, file); // TODO reverse the parameters ? need to be clean AND consistent with the filter search fn...
              }
          }
      },
      filter: function(search) {
          var result = [];
          this.forEach(function (relativePath, entry) {
              if (search(relativePath, entry)) { // the file matches the function
                  result.push(entry);
              }
  
          });
          return result;
      },
      file: function(name, data, o) {
          if (arguments.length === 1) {
              if (isRegExp(name)) {
                  var regexp = name;
                  return this.filter(function(relativePath, file) {
                      return !file.dir && regexp.test(relativePath);
                  });
              }
              else { // text
                  var obj = this.files[this.root + name];
                  if (obj && !obj.dir) {
                      return obj;
                  } else {
                      return null;
                  }
              }
          }
          else { // more than one argument : we have data !
              name = this.root + name;
              fileAdd.call(this, name, data, o);
          }
          return this;
      },
      folder: function(arg) {
          if (!arg) {
              return this;
          }
  
          if (isRegExp(arg)) {
              return this.filter(function(relativePath, file) {
                  return file.dir && arg.test(relativePath);
              });
          }
          var name = this.root + arg;
          var newFolder = folderAdd.call(this, name);
          var ret = this.clone();
          ret.root = newFolder.name;
          return ret;
      },
      remove: function(name) {
          name = this.root + name;
          var file = this.files[name];
          if (!file) {
              if (name.slice(-1) !== "/") {
                  name += "/";
              }
              file = this.files[name];
          }
  
          if (file && !file.dir) {
              delete this.files[name];
          } else {
              var kids = this.filter(function(relativePath, file) {
                  return file.name.slice(0, name.length) === name;
              });
              for (var i = 0; i < kids.length; i++) {
                  delete this.files[kids[i].name];
              }
          }
  
          return this;
      },
      generate: function(options) {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
      },
      generateInternalStream: function(options) {
        var worker, opts = {};
        try {
            opts = utils.extend(options || {}, {
                streamFiles: false,
                compression: "STORE",
                compressionOptions : null,
                type: "",
                platform: "DOS",
                comment: null,
                mimeType: 'application/zip',
                encodeFileName: utf8.utf8encode
            });
  
            opts.type = opts.type.toLowerCase();
            opts.compression = opts.compression.toUpperCase();
            if(opts.type === "binarystring") {
              opts.type = "string";
            }
  
            if (!opts.type) {
              throw new Error("No output type specified.");
            }
  
            utils.checkSupport(opts.type);
            if(
                opts.platform === 'darwin' ||
                opts.platform === 'freebsd' ||
                opts.platform === 'linux' ||
                opts.platform === 'sunos'
            ) {
                opts.platform = "UNIX";
            }
            if (opts.platform === 'win32') {
                opts.platform = "DOS";
            }
  
            var comment = opts.comment || this.comment || "";
            worker = generate.generateWorker(this, opts, comment);
        } catch (e) {
          worker = new GenericWorker("error");
          worker.error(e);
        }
        return new StreamHelper(worker, opts.type || "string", opts.mimeType);
      },
      generateAsync: function(options, onUpdate) {
          return this.generateInternalStream(options).accumulate(onUpdate);
      },
      generateNodeStream: function(options, onUpdate) {
          options = options || {};
          if (!options.type) {
              options.type = "nodebuffer";
          }
          return this.generateInternalStream(options).toNodejsStream(onUpdate);
      }
  };
  module.exports = out;
  
  },{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(require,module,exports){
  module.exports = require("stream");
  
  },{"stream":undefined}],17:[function(require,module,exports){
  'use strict';
  var DataReader = require('./DataReader');
  var utils = require('../utils');
  
  function ArrayReader(data) {
      DataReader.call(this, data);
    for(var i = 0; i < this.data.length; i++) {
      data[i] = data[i] & 0xFF;
    }
  }
  utils.inherits(ArrayReader, DataReader);
  ArrayReader.prototype.byteAt = function(i) {
      return this.data[this.zero + i];
  };
  ArrayReader.prototype.lastIndexOfSignature = function(sig) {
      var sig0 = sig.charCodeAt(0),
          sig1 = sig.charCodeAt(1),
          sig2 = sig.charCodeAt(2),
          sig3 = sig.charCodeAt(3);
      for (var i = this.length - 4; i >= 0; --i) {
          if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {
              return i - this.zero;
          }
      }
  
      return -1;
  };
  ArrayReader.prototype.readAndCheckSignature = function (sig) {
      var sig0 = sig.charCodeAt(0),
          sig1 = sig.charCodeAt(1),
          sig2 = sig.charCodeAt(2),
          sig3 = sig.charCodeAt(3),
          data = this.readData(4);
      return sig0 === data[0] && sig1 === data[1] && sig2 === data[2] && sig3 === data[3];
  };
  ArrayReader.prototype.readData = function(size) {
      this.checkOffset(size);
      if(size === 0) {
          return [];
      }
      var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
      this.index += size;
      return result;
  };
  module.exports = ArrayReader;
  
  },{"../utils":32,"./DataReader":18}],18:[function(require,module,exports){
  'use strict';
  var utils = require('../utils');
  
  function DataReader(data) {
      this.data = data; // type : see implementation
      this.length = data.length;
      this.index = 0;
      this.zero = 0;
  }
  DataReader.prototype = {
      checkOffset: function(offset) {
          this.checkIndex(this.index + offset);
      },
      checkIndex: function(newIndex) {
          if (this.length < this.zero + newIndex || newIndex < 0) {
              throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");
          }
      },
      setIndex: function(newIndex) {
          this.checkIndex(newIndex);
          this.index = newIndex;
      },
      skip: function(n) {
          this.setIndex(this.index + n);
      },
      byteAt: function(i) {
      },
      readInt: function(size) {
          var result = 0,
              i;
          this.checkOffset(size);
          for (i = this.index + size - 1; i >= this.index; i--) {
              result = (result << 8) + this.byteAt(i);
          }
          this.index += size;
          return result;
      },
      readString: function(size) {
          return utils.transformTo("string", this.readData(size));
      },
      readData: function(size) {
      },
      lastIndexOfSignature: function(sig) {
      },
      readAndCheckSignature: function(sig) {
      },
      readDate: function() {
          var dostime = this.readInt(4);
          return new Date(Date.UTC(
          ((dostime >> 25) & 0x7f) + 1980, // year
          ((dostime >> 21) & 0x0f) - 1, // month
          (dostime >> 16) & 0x1f, // day
          (dostime >> 11) & 0x1f, // hour
          (dostime >> 5) & 0x3f, // minute
          (dostime & 0x1f) << 1)); // second
      }
  };
  module.exports = DataReader;
  
  },{"../utils":32}],19:[function(require,module,exports){
  'use strict';
  var Uint8ArrayReader = require('./Uint8ArrayReader');
  var utils = require('../utils');
  
  function NodeBufferReader(data) {
      Uint8ArrayReader.call(this, data);
  }
  utils.inherits(NodeBufferReader, Uint8ArrayReader);
  NodeBufferReader.prototype.readData = function(size) {
      this.checkOffset(size);
      var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
      this.index += size;
      return result;
  };
  module.exports = NodeBufferReader;
  
  },{"../utils":32,"./Uint8ArrayReader":21}],20:[function(require,module,exports){
  'use strict';
  var DataReader = require('./DataReader');
  var utils = require('../utils');
  
  function StringReader(data) {
      DataReader.call(this, data);
  }
  utils.inherits(StringReader, DataReader);
  StringReader.prototype.byteAt = function(i) {
      return this.data.charCodeAt(this.zero + i);
  };
  StringReader.prototype.lastIndexOfSignature = function(sig) {
      return this.data.lastIndexOf(sig) - this.zero;
  };
  StringReader.prototype.readAndCheckSignature = function (sig) {
      var data = this.readData(4);
      return sig === data;
  };
  StringReader.prototype.readData = function(size) {
      this.checkOffset(size);
      var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
      this.index += size;
      return result;
  };
  module.exports = StringReader;
  
  },{"../utils":32,"./DataReader":18}],21:[function(require,module,exports){
  'use strict';
  var ArrayReader = require('./ArrayReader');
  var utils = require('../utils');
  
  function Uint8ArrayReader(data) {
      ArrayReader.call(this, data);
  }
  utils.inherits(Uint8ArrayReader, ArrayReader);
  Uint8ArrayReader.prototype.readData = function(size) {
      this.checkOffset(size);
      if(size === 0) {
          return new Uint8Array(0);
      }
      var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
      this.index += size;
      return result;
  };
  module.exports = Uint8ArrayReader;
  
  },{"../utils":32,"./ArrayReader":17}],22:[function(require,module,exports){
  'use strict';
  
  var utils = require('../utils');
  var support = require('../support');
  var ArrayReader = require('./ArrayReader');
  var StringReader = require('./StringReader');
  var NodeBufferReader = require('./NodeBufferReader');
  var Uint8ArrayReader = require('./Uint8ArrayReader');
  module.exports = function (data) {
      var type = utils.getTypeOf(data);
      utils.checkSupport(type);
      if (type === "string" && !support.uint8array) {
          return new StringReader(data);
      }
      if (type === "nodebuffer") {
          return new NodeBufferReader(data);
      }
      if (support.uint8array) {
          return new Uint8ArrayReader(utils.transformTo("uint8array", data));
      }
      return new ArrayReader(utils.transformTo("array", data));
  };
  
  },{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(require,module,exports){
  'use strict';
  exports.LOCAL_FILE_HEADER = "PK\x03\x04";
  exports.CENTRAL_FILE_HEADER = "PK\x01\x02";
  exports.CENTRAL_DIRECTORY_END = "PK\x05\x06";
  exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
  exports.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
  exports.DATA_DESCRIPTOR = "PK\x07\x08";
  
  },{}],24:[function(require,module,exports){
  'use strict';
  
  var GenericWorker = require('./GenericWorker');
  var utils = require('../utils');
  function ConvertWorker(destType) {
      GenericWorker.call(this, "ConvertWorker to " + destType);
      this.destType = destType;
  }
  utils.inherits(ConvertWorker, GenericWorker);
  ConvertWorker.prototype.processChunk = function (chunk) {
      this.push({
          data : utils.transformTo(this.destType, chunk.data),
          meta : chunk.meta
      });
  };
  module.exports = ConvertWorker;
  
  },{"../utils":32,"./GenericWorker":28}],25:[function(require,module,exports){
  'use strict';
  
  var GenericWorker = require('./GenericWorker');
  var crc32 = require('../crc32');
  var utils = require('../utils');
  function Crc32Probe() {
      GenericWorker.call(this, "Crc32Probe");
      this.withStreamInfo("crc32", 0);
  }
  utils.inherits(Crc32Probe, GenericWorker);
  Crc32Probe.prototype.processChunk = function (chunk) {
      this.streamInfo.crc32 = crc32(chunk.data, this.streamInfo.crc32 || 0);
      this.push(chunk);
  };
  module.exports = Crc32Probe;
  
  },{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(require,module,exports){
  'use strict';
  
  var utils = require('../utils');
  var GenericWorker = require('./GenericWorker');
  function DataLengthProbe(propName) {
      GenericWorker.call(this, "DataLengthProbe for " + propName);
      this.propName = propName;
      this.withStreamInfo(propName, 0);
  }
  utils.inherits(DataLengthProbe, GenericWorker);
  DataLengthProbe.prototype.processChunk = function (chunk) {
      if(chunk) {
          var length = this.streamInfo[this.propName] || 0;
          this.streamInfo[this.propName] = length + chunk.data.length;
      }
      GenericWorker.prototype.processChunk.call(this, chunk);
  };
  module.exports = DataLengthProbe;
  
  
  },{"../utils":32,"./GenericWorker":28}],27:[function(require,module,exports){
  'use strict';
  
  var utils = require('../utils');
  var GenericWorker = require('./GenericWorker');
  // TODO expose this as a public variable
  var DEFAULT_BLOCK_SIZE = 16 * 1024;
  function DataWorker(dataP) {
      GenericWorker.call(this, "DataWorker");
      var self = this;
      this.dataIsReady = false;
      this.index = 0;
      this.max = 0;
      this.data = null;
      this.type = "";
  
      this._tickScheduled = false;
  
      dataP.then(function (data) {
          self.dataIsReady = true;
          self.data = data;
          self.max = data && data.length || 0;
          self.type = utils.getTypeOf(data);
          if(!self.isPaused) {
              self._tickAndRepeat();
          }
      }, function (e) {
          self.error(e);
      });
  }
  
  utils.inherits(DataWorker, GenericWorker);
  DataWorker.prototype.cleanUp = function () {
      GenericWorker.prototype.cleanUp.call(this);
      this.data = null;
  };
  DataWorker.prototype.resume = function () {
      if(!GenericWorker.prototype.resume.call(this)) {
          return false;
      }
  
      if (!this._tickScheduled && this.dataIsReady) {
          this._tickScheduled = true;
          utils.delay(this._tickAndRepeat, [], this);
      }
      return true;
  };
  DataWorker.prototype._tickAndRepeat = function() {
      this._tickScheduled = false;
      if(this.isPaused || this.isFinished) {
          return;
      }
      this._tick();
      if(!this.isFinished) {
          utils.delay(this._tickAndRepeat, [], this);
          this._tickScheduled = true;
      }
  };
  DataWorker.prototype._tick = function() {
  
      if(this.isPaused || this.isFinished) {
          return false;
      }
  
      var size = DEFAULT_BLOCK_SIZE;
      var data = null, nextIndex = Math.min(this.max, this.index + size);
      if (this.index >= this.max) {
          return this.end();
      } else {
          switch(this.type) {
              case "string":
                  data = this.data.substring(this.index, nextIndex);
              break;
              case "uint8array":
                  data = this.data.subarray(this.index, nextIndex);
              break;
              case "array":
              case "nodebuffer":
                  data = this.data.slice(this.index, nextIndex);
              break;
          }
          this.index = nextIndex;
          return this.push({
              data : data,
              meta : {
                  percent : this.max ? this.index / this.max * 100 : 0
              }
          });
      }
  };
  
  module.exports = DataWorker;
  
  },{"../utils":32,"./GenericWorker":28}],28:[function(require,module,exports){
  'use strict';
  function GenericWorker(name) {
      this.name = name || "default";
      this.streamInfo = {};
      this.generatedError = null;
      this.extraStreamInfo = {};
      this.isPaused = true;
      this.isFinished = false;
      this.isLocked = false;
      this._listeners = {
          'data':[],
          'end':[],
          'error':[]
      };
      this.previous = null;
  }
  
  GenericWorker.prototype = {
      push : function (chunk) {
          this.emit("data", chunk);
      },
      end : function () {
          if (this.isFinished) {
              return false;
          }
  
          this.flush();
          try {
              this.emit("end");
              this.cleanUp();
              this.isFinished = true;
          } catch (e) {
              this.emit("error", e);
          }
          return true;
      },
      error : function (e) {
          if (this.isFinished) {
              return false;
          }
  
          if(this.isPaused) {
              this.generatedError = e;
          } else {
              this.isFinished = true;
  
              this.emit("error", e);
              // the error event will go downward but we also need to notify
              if(this.previous) {
                  this.previous.error(e);
              }
  
              this.cleanUp();
          }
          return true;
      },
      on : function (name, listener) {
          this._listeners[name].push(listener);
          return this;
      },
      cleanUp : function () {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null;
          this._listeners = [];
      },
      emit : function (name, arg) {
          if (this._listeners[name]) {
              for(var i = 0; i < this._listeners[name].length; i++) {
                  this._listeners[name][i].call(this, arg);
              }
          }
      },
      pipe : function (next) {
          return next.registerPrevious(this);
      },
      registerPrevious : function (previous) {
          if (this.isLocked) {
              throw new Error("The stream '" + this + "' has already been used.");
          }
          this.streamInfo = previous.streamInfo;
          this.mergeStreamInfo();
          this.previous =  previous;
          var self = this;
          previous.on('data', function (chunk) {
              self.processChunk(chunk);
          });
          previous.on('end', function () {
              self.end();
          });
          previous.on('error', function (e) {
              self.error(e);
          });
          return this;
      },
      pause : function () {
          if(this.isPaused || this.isFinished) {
              return false;
          }
          this.isPaused = true;
  
          if(this.previous) {
              this.previous.pause();
          }
          return true;
      },
      resume : function () {
          if(!this.isPaused || this.isFinished) {
              return false;
          }
          this.isPaused = false;
          var withError = false;
          if(this.generatedError) {
              this.error(this.generatedError);
              withError = true;
          }
          if(this.previous) {
              this.previous.resume();
          }
  
          return !withError;
      },
      flush : function () {},
      processChunk : function(chunk) {
          this.push(chunk);
      },
      withStreamInfo : function (key, value) {
          this.extraStreamInfo[key] = value;
          this.mergeStreamInfo();
          return this;
      },
      mergeStreamInfo : function () {
          for(var key in this.extraStreamInfo) {
              if (!this.extraStreamInfo.hasOwnProperty(key)) {
                  continue;
              }
              this.streamInfo[key] = this.extraStreamInfo[key];
          }
      },
      lock: function () {
          if (this.isLocked) {
              throw new Error("The stream '" + this + "' has already been used.");
          }
          this.isLocked = true;
          if (this.previous) {
              this.previous.lock();
          }
      },
      toString : function () {
          var me = "Worker " + this.name;
          if (this.previous) {
              return this.previous + " -> " + me;
          } else {
              return me;
          }
      }
  };
  
  module.exports = GenericWorker;
  
  },{}],29:[function(require,module,exports){
  'use strict';
  
  var utils = require('../utils');
  var ConvertWorker = require('./ConvertWorker');
  var GenericWorker = require('./GenericWorker');
  var base64 = require('../base64');
  var support = require("../support");
  var external = require("../external");
  
  var NodejsStreamOutputAdapter = null;
  if (support.nodestream) {
      try {
          NodejsStreamOutputAdapter = require('../nodejs/NodejsStreamOutputAdapter');
      } catch(e) {}
  }
  function transformZipOutput(type, content, mimeType) {
      switch(type) {
          case "blob" :
              return utils.newBlob(utils.transformTo("arraybuffer", content), mimeType);
          case "base64" :
              return base64.encode(content);
          default :
              return utils.transformTo(type, content);
      }
  }
  function concat (type, dataArray) {
      var i, index = 0, res = null, totalLength = 0;
      for(i = 0; i < dataArray.length; i++) {
          totalLength += dataArray[i].length;
      }
      switch(type) {
          case "string":
              return dataArray.join("");
            case "array":
              return Array.prototype.concat.apply([], dataArray);
          case "uint8array":
              res = new Uint8Array(totalLength);
              for(i = 0; i < dataArray.length; i++) {
                  res.set(dataArray[i], index);
                  index += dataArray[i].length;
              }
              return res;
          case "nodebuffer":
              return Buffer.concat(dataArray);
          default:
              throw new Error("concat : unsupported type '"  + type + "'");
      }
  }
  function accumulate(helper, updateCallback) {
      return new external.Promise(function (resolve, reject){
          var dataArray = [];
          var chunkType = helper._internalType,
              resultType = helper._outputType,
              mimeType = helper._mimeType;
          helper
          .on('data', function (data, meta) {
              dataArray.push(data);
              if(updateCallback) {
                  updateCallback(meta);
              }
          })
          .on('error', function(err) {
              dataArray = [];
              reject(err);
          })
          .on('end', function (){
              try {
                  var result = transformZipOutput(resultType, concat(chunkType, dataArray), mimeType);
                  resolve(result);
              } catch (e) {
                  reject(e);
              }
              dataArray = [];
          })
          .resume();
      });
  }
  function StreamHelper(worker, outputType, mimeType) {
      var internalType = outputType;
      switch(outputType) {
          case "blob":
          case "arraybuffer":
              internalType = "uint8array";
          break;
          case "base64":
              internalType = "string";
          break;
      }
  
      try {
          this._internalType = internalType;
          this._outputType = outputType;
          this._mimeType = mimeType;
          utils.checkSupport(internalType);
          this._worker = worker.pipe(new ConvertWorker(internalType));
          // prevent any updates on previous workers.
          worker.lock();
      } catch(e) {
          this._worker = new GenericWorker("error");
          this._worker.error(e);
      }
  }
  
  StreamHelper.prototype = {
      accumulate : function (updateCb) {
          return accumulate(this, updateCb);
      },
      on : function (evt, fn) {
          var self = this;
  
          if(evt === "data") {
              this._worker.on(evt, function (chunk) {
                  fn.call(self, chunk.data, chunk.meta);
              });
          } else {
              this._worker.on(evt, function () {
                  utils.delay(fn, arguments, self);
              });
          }
          return this;
      },
      resume : function () {
          utils.delay(this._worker.resume, [], this._worker);
          return this;
      },
      pause : function () {
          this._worker.pause();
          return this;
      },
      toNodejsStream : function (updateCb) {
          utils.checkSupport("nodestream");
          if (this._outputType !== "nodebuffer") {
              // is strange and I don't know if it would be useful.
              // bug report !
              throw new Error(this._outputType + " is not supported by this method");
          }
  
          return new NodejsStreamOutputAdapter(this, {
              objectMode : this._outputType !== "nodebuffer"
          }, updateCb);
      }
  };
  
  
  module.exports = StreamHelper;
  
  },{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(require,module,exports){
  'use strict';
  
  exports.base64 = true;
  exports.array = true;
  exports.string = true;
  exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
  exports.nodebuffer = typeof Buffer !== "undefined";
  exports.uint8array = typeof Uint8Array !== "undefined";
  
  if (typeof ArrayBuffer === "undefined") {
      exports.blob = false;
  }
  else {
      var buffer = new ArrayBuffer(0);
      try {
          exports.blob = new Blob([buffer], {
              type: "application/zip"
          }).size === 0;
      }
      catch (e) {
          try {
              var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
              var builder = new Builder();
              builder.append(buffer);
              exports.blob = builder.getBlob('application/zip').size === 0;
          }
          catch (e) {
              exports.blob = false;
          }
      }
  }
  
  try {
      exports.nodestream = !!require('readable-stream').Readable;
  } catch(e) {
      exports.nodestream = false;
  }
  
  },{"readable-stream":16}],31:[function(require,module,exports){
  'use strict';
  
  var utils = require('./utils');
  var support = require('./support');
  var nodejsUtils = require('./nodejsUtils');
  var GenericWorker = require('./stream/GenericWorker');
  // Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
  var _utf8len = new Array(256);
  for (var i=0; i<256; i++) {
    _utf8len[i] = (i >= 252 ? 6 : i >= 248 ? 5 : i >= 240 ? 4 : i >= 224 ? 3 : i >= 192 ? 2 : 1);
  }
  _utf8len[254]=_utf8len[254]=1; // Invalid sequence start
  var string2buf = function (str) {
      var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
      for (m_pos = 0; m_pos < str_len; m_pos++) {
          c = str.charCodeAt(m_pos);
          if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
              c2 = str.charCodeAt(m_pos+1);
              if ((c2 & 0xfc00) === 0xdc00) {
                  c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                  m_pos++;
              }
          }
          buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
      }
      if (support.uint8array) {
          buf = new Uint8Array(buf_len);
      } else {
          buf = new Array(buf_len);
      }
      for (i=0, m_pos = 0; i < buf_len; m_pos++) {
          c = str.charCodeAt(m_pos);
          if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
              c2 = str.charCodeAt(m_pos+1);
              if ((c2 & 0xfc00) === 0xdc00) {
                  c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                  m_pos++;
              }
          }
          if (c < 0x80) {
              buf[i++] = c;
          } else if (c < 0x800) {
              buf[i++] = 0xC0 | (c >>> 6);
              buf[i++] = 0x80 | (c & 0x3f);
          } else if (c < 0x10000) {
              buf[i++] = 0xE0 | (c >>> 12);
              buf[i++] = 0x80 | (c >>> 6 & 0x3f);
              buf[i++] = 0x80 | (c & 0x3f);
          } else {
              buf[i++] = 0xf0 | (c >>> 18);
              buf[i++] = 0x80 | (c >>> 12 & 0x3f);
              buf[i++] = 0x80 | (c >>> 6 & 0x3f);
              buf[i++] = 0x80 | (c & 0x3f);
          }
      }
  
      return buf;
  };
  // that will not break sequence. If that's not possible
  //
  // max   - length limit (mandatory);
  var utf8border = function(buf, max) {
      var pos;
  
      max = max || buf.length;
      if (max > buf.length) { max = buf.length; }
      pos = max-1;
      while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }
      // return max, because we should return something anyway.
      if (pos < 0) { return max; }
      // return max too.
      if (pos === 0) { return max; }
  
      return (pos + _utf8len[buf[pos]] > max) ? pos : max;
  };
  var buf2string = function (buf) {
      var str, i, out, c, c_len;
      var len = buf.length;
      // NB: by unknown reasons, Array is significantly faster for
      var utf16buf = new Array(len*2);
  
      for (out=0, i=0; i<len;) {
          c = buf[i++];
          if (c < 0x80) { utf16buf[out++] = c; continue; }
  
          c_len = _utf8len[c];
          if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len-1; continue; }
          c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
          while (c_len > 1 && i < len) {
              c = (c << 6) | (buf[i++] & 0x3f);
              c_len--;
          }
          if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }
  
          if (c < 0x10000) {
              utf16buf[out++] = c;
          } else {
              c -= 0x10000;
              utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
              utf16buf[out++] = 0xdc00 | (c & 0x3ff);
          }
      }
      if (utf16buf.length !== out) {
          if(utf16buf.subarray) {
              utf16buf = utf16buf.subarray(0, out);
          } else {
              utf16buf.length = out;
          }
      }
      return utils.applyFromCharCode(utf16buf);
  };
  exports.utf8encode = function utf8encode(str) {
      if (support.nodebuffer) {
          return nodejsUtils.newBufferFrom(str, "utf-8");
      }
  
      return string2buf(str);
  };
  exports.utf8decode = function utf8decode(buf) {
      if (support.nodebuffer) {
          return utils.transformTo("nodebuffer", buf).toString("utf-8");
      }
  
      buf = utils.transformTo(support.uint8array ? "uint8array" : "array", buf);
  
      return buf2string(buf);
  };
  function Utf8DecodeWorker() {
      GenericWorker.call(this, "utf-8 decode");
      this.leftOver = null;
  }
  utils.inherits(Utf8DecodeWorker, GenericWorker);
  Utf8DecodeWorker.prototype.processChunk = function (chunk) {
  
      var data = utils.transformTo(support.uint8array ? "uint8array" : "array", chunk.data);
      if (this.leftOver && this.leftOver.length) {
          if(support.uint8array) {
              var previousData = data;
              data = new Uint8Array(previousData.length + this.leftOver.length);
              data.set(this.leftOver, 0);
              data.set(previousData, this.leftOver.length);
          } else {
              data = this.leftOver.concat(data);
          }
          this.leftOver = null;
      }
  
      var nextBoundary = utf8border(data);
      var usableData = data;
      if (nextBoundary !== data.length) {
          if (support.uint8array) {
              usableData = data.subarray(0, nextBoundary);
              this.leftOver = data.subarray(nextBoundary, data.length);
          } else {
              usableData = data.slice(0, nextBoundary);
              this.leftOver = data.slice(nextBoundary, data.length);
          }
      }
  
      this.push({
          data : exports.utf8decode(usableData),
          meta : chunk.meta
      });
  };
  Utf8DecodeWorker.prototype.flush = function () {
      if(this.leftOver && this.leftOver.length) {
          this.push({
              data : exports.utf8decode(this.leftOver),
              meta : {}
          });
          this.leftOver = null;
      }
  };
  exports.Utf8DecodeWorker = Utf8DecodeWorker;
  function Utf8EncodeWorker() {
      GenericWorker.call(this, "utf-8 encode");
  }
  utils.inherits(Utf8EncodeWorker, GenericWorker);
  Utf8EncodeWorker.prototype.processChunk = function (chunk) {
      this.push({
          data : exports.utf8encode(chunk.data),
          meta : chunk.meta
      });
  };
  exports.Utf8EncodeWorker = Utf8EncodeWorker;
  
  },{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(require,module,exports){
  'use strict';
  
  var support = require('./support');
  var base64 = require('./base64');
  var nodejsUtils = require('./nodejsUtils');
  var setImmediate = require('set-immediate-shim');
  var external = require("./external");
  function string2binary(str) {
      var result = null;
      if (support.uint8array) {
        result = new Uint8Array(str.length);
      } else {
        result = new Array(str.length);
      }
      return stringToArrayLike(str, result);
  }
  exports.newBlob = function(part, type) {
      exports.checkSupport("blob");
  
      try {
          return new Blob([part], {
              type: type
          });
      }
      catch (e) {
  
          try {
              var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
              var builder = new Builder();
              builder.append(part);
              return builder.getBlob(type);
          }
          catch (e) {
              throw new Error("Bug : can't construct the Blob.");
          }
      }
  
  
  };
  function identity(input) {
      return input;
  }
  function stringToArrayLike(str, array) {
      for (var i = 0; i < str.length; ++i) {
          array[i] = str.charCodeAt(i) & 0xFF;
      }
      return array;
  }
  var arrayToStringHelper = {
      stringifyByChunk: function(array, type, chunk) {
          var result = [], k = 0, len = array.length;
          if (len <= chunk) {
              return String.fromCharCode.apply(null, array);
          }
          while (k < len) {
              if (type === "array" || type === "nodebuffer") {
                  result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len))));
              }
              else {
                  result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
              }
              k += chunk;
          }
          return result.join("");
      },
      stringifyByChar: function(array){
          var resultStr = "";
          for(var i = 0; i < array.length; i++) {
              resultStr += String.fromCharCode(array[i]);
          }
          return resultStr;
      },
      applyCanBeUsed : {
          uint8array : (function () {
              try {
                  return support.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
              } catch (e) {
                  return false;
              }
          })(),
          nodebuffer : (function () {
              try {
                  return support.nodebuffer && String.fromCharCode.apply(null, nodejsUtils.allocBuffer(1)).length === 1;
              } catch (e) {
                  return false;
              }
          })()
      }
  };
  function arrayLikeToString(array) {
      // --------------------
      // see http://jsperf.com/converting-a-uint8array-to-a-string/2
      //
      //
      // TODO : we now have workers that split the work. Do we still need that ?
      var chunk = 65536,
          type = exports.getTypeOf(array),
          canUseApply = true;
      if (type === "uint8array") {
          canUseApply = arrayToStringHelper.applyCanBeUsed.uint8array;
      } else if (type === "nodebuffer") {
          canUseApply = arrayToStringHelper.applyCanBeUsed.nodebuffer;
      }
  
      if (canUseApply) {
          while (chunk > 1) {
              try {
                  return arrayToStringHelper.stringifyByChunk(array, type, chunk);
              } catch (e) {
                  chunk = Math.floor(chunk / 2);
              }
          }
      }
      // default browser on android 4.*
      return arrayToStringHelper.stringifyByChar(array);
  }
  
  exports.applyFromCharCode = arrayLikeToString;
  function arrayLikeToArrayLike(arrayFrom, arrayTo) {
      for (var i = 0; i < arrayFrom.length; i++) {
          arrayTo[i] = arrayFrom[i];
      }
      return arrayTo;
  }
  var transform = {};
  transform["string"] = {
      "string": identity,
      "array": function(input) {
          return stringToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
          return transform["string"]["uint8array"](input).buffer;
      },
      "uint8array": function(input) {
          return stringToArrayLike(input, new Uint8Array(input.length));
      },
      "nodebuffer": function(input) {
          return stringToArrayLike(input, nodejsUtils.allocBuffer(input.length));
      }
  };
  transform["array"] = {
      "string": arrayLikeToString,
      "array": identity,
      "arraybuffer": function(input) {
          return (new Uint8Array(input)).buffer;
      },
      "uint8array": function(input) {
          return new Uint8Array(input);
      },
      "nodebuffer": function(input) {
          return nodejsUtils.newBufferFrom(input);
      }
  };
  transform["arraybuffer"] = {
      "string": function(input) {
          return arrayLikeToString(new Uint8Array(input));
      },
      "array": function(input) {
          return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
      },
      "arraybuffer": identity,
      "uint8array": function(input) {
          return new Uint8Array(input);
      },
      "nodebuffer": function(input) {
          return nodejsUtils.newBufferFrom(new Uint8Array(input));
      }
  };
  transform["uint8array"] = {
      "string": arrayLikeToString,
      "array": function(input) {
          return arrayLikeToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
          return input.buffer;
      },
      "uint8array": identity,
      "nodebuffer": function(input) {
          return nodejsUtils.newBufferFrom(input);
      }
  };
  transform["nodebuffer"] = {
      "string": arrayLikeToString,
      "array": function(input) {
          return arrayLikeToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
          return transform["nodebuffer"]["uint8array"](input).buffer;
      },
      "uint8array": function(input) {
          return arrayLikeToArrayLike(input, new Uint8Array(input.length));
      },
      "nodebuffer": identity
  };
  exports.transformTo = function(outputType, input) {
      if (!input) {
          // an empty string won't harm.
          input = "";
      }
      if (!outputType) {
          return input;
      }
      exports.checkSupport(outputType);
      var inputType = exports.getTypeOf(input);
      var result = transform[inputType][outputType](input);
      return result;
  };
  exports.getTypeOf = function(input) {
      if (typeof input === "string") {
          return "string";
      }
      if (Object.prototype.toString.call(input) === "[object Array]") {
          return "array";
      }
      if (support.nodebuffer && nodejsUtils.isBuffer(input)) {
          return "nodebuffer";
      }
      if (support.uint8array && input instanceof Uint8Array) {
          return "uint8array";
      }
      if (support.arraybuffer && input instanceof ArrayBuffer) {
          return "arraybuffer";
      }
  };
  exports.checkSupport = function(type) {
      var supported = support[type.toLowerCase()];
      if (!supported) {
          throw new Error(type + " is not supported by this platform");
      }
  };
  
  exports.MAX_VALUE_16BITS = 65535;
  exports.MAX_VALUE_32BITS = -1; // well, "\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF" is parsed as -1
  exports.pretty = function(str) {
      var res = '',
          code, i;
      for (i = 0; i < (str || "").length; i++) {
          code = str.charCodeAt(i);
          res += '\\x' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
      }
      return res;
  };
  exports.delay = function(callback, args, self) {
      setImmediate(function () {
          callback.apply(self || null, args || []);
      });
  };
  exports.inherits = function (ctor, superCtor) {
      var Obj = function() {};
      Obj.prototype = superCtor.prototype;
      ctor.prototype = new Obj();
  };
  exports.extend = function() {
      var result = {}, i, attr;
      for (i = 0; i < arguments.length; i++) { // arguments is not enumerable in some browsers
          for (attr in arguments[i]) {
              if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {
                  result[attr] = arguments[i][attr];
              }
          }
      }
      return result;
  };
  exports.prepareContent = function(name, inputData, isBinary, isOptimizedBinaryString, isBase64) {
      var promise = external.Promise.resolve(inputData).then(function(data) {
          
          
          var isBlob = support.blob && (data instanceof Blob || ['[object File]', '[object Blob]'].indexOf(Object.prototype.toString.call(data)) !== -1);
  
          if (isBlob && typeof FileReader !== "undefined") {
              return new external.Promise(function (resolve, reject) {
                  var reader = new FileReader();
  
                  reader.onload = function(e) {
                      resolve(e.target.result);
                  };
                  reader.onerror = function(e) {
                      reject(e.target.error);
                  };
                  reader.readAsArrayBuffer(data);
              });
          } else {
              return data;
          }
      });
  
      return promise.then(function(data) {
          var dataType = exports.getTypeOf(data);
  
          if (!dataType) {
              return external.Promise.reject(
                  new Error("Can't read the data of '" + name + "'. Is it " +
                            "in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?")
              );
          }
          if (dataType === "arraybuffer") {
              data = exports.transformTo("uint8array", data);
          } else if (dataType === "string") {
              if (isBase64) {
                  data = base64.decode(data);
              }
              else if (isBinary) {
                  if (isOptimizedBinaryString !== true) {
                      // Be sure that this is a correct "binary string"
                      data = string2binary(data);
                  }
              }
          }
          return data;
      });
  };
  
  },{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,"set-immediate-shim":54}],33:[function(require,module,exports){
  'use strict';
  var readerFor = require('./reader/readerFor');
  var utils = require('./utils');
  var sig = require('./signature');
  var ZipEntry = require('./zipEntry');
  var utf8 = require('./utf8');
  var support = require('./support');
  function ZipEntries(loadOptions) {
      this.files = [];
      this.loadOptions = loadOptions;
  }
  ZipEntries.prototype = {
      checkSignature: function(expectedSignature) {
          if (!this.reader.readAndCheckSignature(expectedSignature)) {
              this.reader.index -= 4;
              var signature = this.reader.readString(4);
              throw new Error("Corrupted zip or bug: unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
          }
      },
      isSignature: function(askedIndex, expectedSignature) {
          var currentIndex = this.reader.index;
          this.reader.setIndex(askedIndex);
          var signature = this.reader.readString(4);
          var result = signature === expectedSignature;
          this.reader.setIndex(currentIndex);
          return result;
      },
      readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2);
          this.diskWithCentralDirStart = this.reader.readInt(2);
          this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
          this.centralDirRecords = this.reader.readInt(2);
          this.centralDirSize = this.reader.readInt(4);
          this.centralDirOffset = this.reader.readInt(4);
  
          this.zipCommentLength = this.reader.readInt(2);
          // On a linux machine with LANG=en_US.utf8, this field is utf8 encoded.
          var zipComment = this.reader.readData(this.zipCommentLength);
          var decodeParamType = support.uint8array ? "uint8array" : "array";
          // this is utf8 encoded unless specified otherwise.
          var decodeContent = utils.transformTo(decodeParamType, zipComment);
          this.zipComment = this.loadOptions.decodeFileName(decodeContent);
      },
      readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8);
          this.reader.skip(4);
          // this.versionNeeded = this.reader.readInt(2);
          this.diskNumber = this.reader.readInt(4);
          this.diskWithCentralDirStart = this.reader.readInt(4);
          this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
          this.centralDirRecords = this.reader.readInt(8);
          this.centralDirSize = this.reader.readInt(8);
          this.centralDirOffset = this.reader.readInt(8);
  
          this.zip64ExtensibleData = {};
          var extraDataSize = this.zip64EndOfCentralSize - 44,
              index = 0,
              extraFieldId,
              extraFieldLength,
              extraFieldValue;
          while (index < extraDataSize) {
              extraFieldId = this.reader.readInt(2);
              extraFieldLength = this.reader.readInt(4);
              extraFieldValue = this.reader.readData(extraFieldLength);
              this.zip64ExtensibleData[extraFieldId] = {
                  id: extraFieldId,
                  length: extraFieldLength,
                  value: extraFieldValue
              };
          }
      },
      readBlockZip64EndOfCentralLocator: function() {
          this.diskWithZip64CentralDirStart = this.reader.readInt(4);
          this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
          this.disksCount = this.reader.readInt(4);
          if (this.disksCount > 1) {
              throw new Error("Multi-volumes zip are not supported");
          }
      },
      readLocalFiles: function() {
          var i, file;
          for (i = 0; i < this.files.length; i++) {
              file = this.files[i];
              this.reader.setIndex(file.localHeaderOffset);
              this.checkSignature(sig.LOCAL_FILE_HEADER);
              file.readLocalPart(this.reader);
              file.handleUTF8();
              file.processAttributes();
          }
      },
      readCentralDir: function() {
          var file;
  
          this.reader.setIndex(this.centralDirOffset);
          while (this.reader.readAndCheckSignature(sig.CENTRAL_FILE_HEADER)) {
              file = new ZipEntry({
                  zip64: this.zip64
              }, this.loadOptions);
              file.readCentralPart(this.reader);
              this.files.push(file);
          }
  
          if (this.centralDirRecords !== this.files.length) {
              if (this.centralDirRecords !== 0 && this.files.length === 0) {
                  // This is really suspicious, as if something went wrong.
                  throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
              } else {
                  // Something is wrong but we got something for the user: no error here.
              }
          }
      },
      readEndOfCentral: function() {
          var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
          if (offset < 0) {
              // A "LOCAL_FILE_HEADER" is not required at the beginning (auto
              // If an ajax request was used without responseType, we will also
              var isGarbage = !this.isSignature(0, sig.LOCAL_FILE_HEADER);
  
              if (isGarbage) {
                  throw new Error("Can't find end of central directory : is this a zip file ? " +
                                  "If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
              } else {
                  throw new Error("Corrupted zip: can't find end of central directory");
              }
  
          }
          this.reader.setIndex(offset);
          var endOfCentralDirOffset = offset;
          this.checkSignature(sig.CENTRAL_DIRECTORY_END);
          this.readBlockEndOfCentral();
          if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
              this.zip64 = true;
              offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
              if (offset < 0) {
                  throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
              }
              this.reader.setIndex(offset);
              this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
              this.readBlockZip64EndOfCentralLocator();
              if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
                  this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
                  if (this.relativeOffsetEndOfZip64CentralDir < 0) {
                      throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
                  }
              }
              this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
              this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
              this.readBlockZip64EndOfCentral();
          }
  
          var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
          if (this.zip64) {
              expectedEndOfCentralDirOffset += 20; // end of central dir 64 locator
              expectedEndOfCentralDirOffset += 12 /* should not include the leading 12 bytes */ + this.zip64EndOfCentralSize;
          }
  
          var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;
  
          if (extraBytes > 0) {
              if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) {
                  // So… we keep it.
              } else {
                  // this happens if data has been prepended (crx files for example)
                  this.reader.zero = extraBytes;
              }
          } else if (extraBytes < 0) {
              throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
          }
      },
      prepareReader: function(data) {
          this.reader = readerFor(data);
      },
      load: function(data) {
          this.prepareReader(data);
          this.readEndOfCentral();
          this.readCentralDir();
          this.readLocalFiles();
      }
  };
  module.exports = ZipEntries;
  
  },{"./reader/readerFor":22,"./signature":23,"./support":30,"./utf8":31,"./utils":32,"./zipEntry":34}],34:[function(require,module,exports){
  'use strict';
  var readerFor = require('./reader/readerFor');
  var utils = require('./utils');
  var CompressedObject = require('./compressedObject');
  var crc32fn = require('./crc32');
  var utf8 = require('./utf8');
  var compressions = require('./compressions');
  var support = require('./support');
  
  var MADE_BY_DOS = 0x00;
  var MADE_BY_UNIX = 0x03;
  var findCompression = function(compressionMethod) {
      for (var method in compressions) {
          if (!compressions.hasOwnProperty(method)) {
              continue;
          }
          if (compressions[method].magic === compressionMethod) {
              return compressions[method];
          }
      }
      return null;
  };
  function ZipEntry(options, loadOptions) {
      this.options = options;
      this.loadOptions = loadOptions;
  }
  ZipEntry.prototype = {
      isEncrypted: function() {
          return (this.bitFlag & 0x0001) === 0x0001;
      },
      useUTF8: function() {
          return (this.bitFlag & 0x0800) === 0x0800;
      },
      readLocalPart: function(reader) {
          var compression, localExtraFieldsLength;
          // If the central dir data are false, we are doomed.
          // The less data we get here, the more reliable this should be.
          reader.skip(22);
          // Strangely, the filename here is OK.
          // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes '/'") but there are a lot of bad zip generators...
          // the internet.
          // I think I see the logic here : the central directory is used to display
          // may be used to display \ to windows users and use / when extracting the files.
          this.fileNameLength = reader.readInt(2);
          localExtraFieldsLength = reader.readInt(2); // can't be sure this will be the same as the central dir
          this.fileName = reader.readData(this.fileNameLength);
          reader.skip(localExtraFieldsLength);
  
          if (this.compressedSize === -1 || this.uncompressedSize === -1) {
              throw new Error("Bug or corrupted zip : didn't get enough information from the central directory " + "(compressedSize === -1 || uncompressedSize === -1)");
          }
  
          compression = findCompression(this.compressionMethod);
          if (compression === null) { // no compression found
              throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + utils.transformTo("string", this.fileName) + ")");
          }
          this.decompressed = new CompressedObject(this.compressedSize, this.uncompressedSize, this.crc32, compression, reader.readData(this.compressedSize));
      },
      readCentralPart: function(reader) {
          this.versionMadeBy = reader.readInt(2);
          reader.skip(2);
          this.bitFlag = reader.readInt(2);
          this.compressionMethod = reader.readString(2);
          this.date = reader.readDate();
          this.crc32 = reader.readInt(4);
          this.compressedSize = reader.readInt(4);
          this.uncompressedSize = reader.readInt(4);
          var fileNameLength = reader.readInt(2);
          this.extraFieldsLength = reader.readInt(2);
          this.fileCommentLength = reader.readInt(2);
          this.diskNumberStart = reader.readInt(2);
          this.internalFileAttributes = reader.readInt(2);
          this.externalFileAttributes = reader.readInt(4);
          this.localHeaderOffset = reader.readInt(4);
  
          if (this.isEncrypted()) {
              throw new Error("Encrypted zip are not supported");
          }
          reader.skip(fileNameLength);
          this.readExtraFields(reader);
          this.parseZIP64ExtraField(reader);
          this.fileComment = reader.readData(this.fileCommentLength);
      },
      processAttributes: function () {
          this.unixPermissions = null;
          this.dosPermissions = null;
          var madeBy = this.versionMadeBy >> 8;
          // We look for it in the DOS and UNIX permissions
          this.dir = this.externalFileAttributes & 0x0010 ? true : false;
  
          if(madeBy === MADE_BY_DOS) {
              this.dosPermissions = this.externalFileAttributes & 0x3F;
          }
  
          if(madeBy === MADE_BY_UNIX) {
              this.unixPermissions = (this.externalFileAttributes >> 16) & 0xFFFF;
          }
          if (!this.dir && this.fileNameStr.slice(-1) === '/') {
              this.dir = true;
          }
      },
      parseZIP64ExtraField: function(reader) {
  
          if (!this.extraFields[0x0001]) {
              return;
          }
          var extraReader = readerFor(this.extraFields[0x0001].value);
          // won't let us have more.
          if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {
              this.uncompressedSize = extraReader.readInt(8);
          }
          if (this.compressedSize === utils.MAX_VALUE_32BITS) {
              this.compressedSize = extraReader.readInt(8);
          }
          if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {
              this.localHeaderOffset = extraReader.readInt(8);
          }
          if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {
              this.diskNumberStart = extraReader.readInt(4);
          }
      },
      readExtraFields: function(reader) {
          var end = reader.index + this.extraFieldsLength,
              extraFieldId,
              extraFieldLength,
              extraFieldValue;
  
          if (!this.extraFields) {
              this.extraFields = {};
          }
  
          while (reader.index + 4 < end) {
              extraFieldId = reader.readInt(2);
              extraFieldLength = reader.readInt(2);
              extraFieldValue = reader.readData(extraFieldLength);
  
              this.extraFields[extraFieldId] = {
                  id: extraFieldId,
                  length: extraFieldLength,
                  value: extraFieldValue
              };
          }
  
          reader.setIndex(end);
      },
      handleUTF8: function() {
          var decodeParamType = support.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) {
              this.fileNameStr = utf8.utf8decode(this.fileName);
              this.fileCommentStr = utf8.utf8decode(this.fileComment);
          } else {
              var upath = this.findExtraFieldUnicodePath();
              if (upath !== null) {
                  this.fileNameStr = upath;
              } else {
                  var fileNameByteArray =  utils.transformTo(decodeParamType, this.fileName);
                  this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
              }
  
              var ucomment = this.findExtraFieldUnicodeComment();
              if (ucomment !== null) {
                  this.fileCommentStr = ucomment;
              } else {
                  var commentByteArray =  utils.transformTo(decodeParamType, this.fileComment);
                  this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
              }
          }
      },
      findExtraFieldUnicodePath: function() {
          var upathField = this.extraFields[0x7075];
          if (upathField) {
              var extraReader = readerFor(upathField.value);
              if (extraReader.readInt(1) !== 1) {
                  return null;
              }
              if (crc32fn(this.fileName) !== extraReader.readInt(4)) {
                  return null;
              }
  
              return utf8.utf8decode(extraReader.readData(upathField.length - 5));
          }
          return null;
      },
      findExtraFieldUnicodeComment: function() {
          var ucommentField = this.extraFields[0x6375];
          if (ucommentField) {
              var extraReader = readerFor(ucommentField.value);
              if (extraReader.readInt(1) !== 1) {
                  return null;
              }
              if (crc32fn(this.fileComment) !== extraReader.readInt(4)) {
                  return null;
              }
  
              return utf8.utf8decode(extraReader.readData(ucommentField.length - 5));
          }
          return null;
      }
  };
  module.exports = ZipEntry;
  
  },{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(require,module,exports){
  'use strict';
  
  var StreamHelper = require('./stream/StreamHelper');
  var DataWorker = require('./stream/DataWorker');
  var utf8 = require('./utf8');
  var CompressedObject = require('./compressedObject');
  var GenericWorker = require('./stream/GenericWorker');
  var ZipObject = function(name, data, options) {
      this.name = name;
      this.dir = options.dir;
      this.date = options.date;
      this.comment = options.comment;
      this.unixPermissions = options.unixPermissions;
      this.dosPermissions = options.dosPermissions;
  
      this._data = data;
      this._dataBinary = options.binary;
      this.options = {
          compression : options.compression,
          compressionOptions : options.compressionOptions
      };
  };
  
  ZipObject.prototype = {
      internalStream: function (type) {
          var result = null, outputType = "string";
          try {
              if (!type) {
                  throw new Error("No output type specified.");
              }
              outputType = type.toLowerCase();
              var askUnicodeString = outputType === "string" || outputType === "text";
              if (outputType === "binarystring" || outputType === "text") {
                  outputType = "string";
              }
              result = this._decompressWorker();
  
              var isUnicodeString = !this._dataBinary;
  
              if (isUnicodeString && !askUnicodeString) {
                  result = result.pipe(new utf8.Utf8EncodeWorker());
              }
              if (!isUnicodeString && askUnicodeString) {
                  result = result.pipe(new utf8.Utf8DecodeWorker());
              }
          } catch (e) {
              result = new GenericWorker("error");
              result.error(e);
          }
  
          return new StreamHelper(result, outputType, "");
      },
      async: function (type, onUpdate) {
          return this.internalStream(type).accumulate(onUpdate);
      },
      nodeStream: function (type, onUpdate) {
          return this.internalStream(type || "nodebuffer").toNodejsStream(onUpdate);
      },
      _compressWorker: function (compression, compressionOptions) {
          if (
              this._data instanceof CompressedObject &&
              this._data.compression.magic === compression.magic
          ) {
              return this._data.getCompressedWorker();
          } else {
              var result = this._decompressWorker();
              if(!this._dataBinary) {
                  result = result.pipe(new utf8.Utf8EncodeWorker());
              }
              return CompressedObject.createWorkerFrom(result, compression, compressionOptions);
          }
      },
      _decompressWorker : function () {
          if (this._data instanceof CompressedObject) {
              return this._data.getContentWorker();
          } else if (this._data instanceof GenericWorker) {
              return this._data;
          } else {
              return new DataWorker(this._data);
          }
      }
  };
  
  var removedMethods = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"];
  var removedFn = function () {
      throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
  };
  
  for(var i = 0; i < removedMethods.length; i++) {
      ZipObject.prototype[removedMethods[i]] = removedFn;
  }
  module.exports = ZipObject;
  
  },{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(require,module,exports){
  (function (global){
  'use strict';
  var Mutation = global.MutationObserver || global.WebKitMutationObserver;
  
  var scheduleDrain;
  
  {
    if (Mutation) {
      var called = 0;
      var observer = new Mutation(nextTick);
      var element = global.document.createTextNode('');
      observer.observe(element, {
        characterData: true
      });
      scheduleDrain = function () {
        element.data = (called = ++called % 2);
      };
    } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
      var channel = new global.MessageChannel();
      channel.port1.onmessage = nextTick;
      scheduleDrain = function () {
        channel.port2.postMessage(0);
      };
    } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
      scheduleDrain = function () {
        // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
        var scriptEl = global.document.createElement('script');
        scriptEl.onreadystatechange = function () {
          nextTick();
  
          scriptEl.onreadystatechange = null;
          scriptEl.parentNode.removeChild(scriptEl);
          scriptEl = null;
        };
        global.document.documentElement.appendChild(scriptEl);
      };
    } else {
      scheduleDrain = function () {
        setTimeout(nextTick, 0);
      };
    }
  }
  
  var draining;
  var queue = [];
  function nextTick() {
    draining = true;
    var i, oldQueue;
    var len = queue.length;
    while (len) {
      oldQueue = queue;
      queue = [];
      i = -1;
      while (++i < len) {
        oldQueue[i]();
      }
      len = queue.length;
    }
    draining = false;
  }
  
  module.exports = immediate;
  function immediate(task) {
    if (queue.push(task) === 1 && !draining) {
      scheduleDrain();
    }
  }
  
  }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  },{}],37:[function(require,module,exports){
  'use strict';
  var immediate = require('immediate');
  function INTERNAL() {}
  
  var handlers = {};
  
  var REJECTED = ['REJECTED'];
  var FULFILLED = ['FULFILLED'];
  var PENDING = ['PENDING'];
  
  module.exports = Promise;
  
  function Promise(resolver) {
    if (typeof resolver !== 'function') {
      throw new TypeError('resolver must be a function');
    }
    this.state = PENDING;
    this.queue = [];
    this.outcome = void 0;
    if (resolver !== INTERNAL) {
      safelyResolveThenable(this, resolver);
    }
  }
  
  Promise.prototype["finally"] = function (callback) {
    if (typeof callback !== 'function') {
      return this;
    }
    var p = this.constructor;
    return this.then(resolve, reject);
  
    function resolve(value) {
      function yes () {
        return value;
      }
      return p.resolve(callback()).then(yes);
    }
    function reject(reason) {
      function no () {
        throw reason;
      }
      return p.resolve(callback()).then(no);
    }
  };
  Promise.prototype["catch"] = function (onRejected) {
    return this.then(null, onRejected);
  };
  Promise.prototype.then = function (onFulfilled, onRejected) {
    if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
      typeof onRejected !== 'function' && this.state === REJECTED) {
      return this;
    }
    var promise = new this.constructor(INTERNAL);
    if (this.state !== PENDING) {
      var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
      unwrap(promise, resolver, this.outcome);
    } else {
      this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
    }
  
    return promise;
  };
  function QueueItem(promise, onFulfilled, onRejected) {
    this.promise = promise;
    if (typeof onFulfilled === 'function') {
      this.onFulfilled = onFulfilled;
      this.callFulfilled = this.otherCallFulfilled;
    }
    if (typeof onRejected === 'function') {
      this.onRejected = onRejected;
      this.callRejected = this.otherCallRejected;
    }
  }
  QueueItem.prototype.callFulfilled = function (value) {
    handlers.resolve(this.promise, value);
  };
  QueueItem.prototype.otherCallFulfilled = function (value) {
    unwrap(this.promise, this.onFulfilled, value);
  };
  QueueItem.prototype.callRejected = function (value) {
    handlers.reject(this.promise, value);
  };
  QueueItem.prototype.otherCallRejected = function (value) {
    unwrap(this.promise, this.onRejected, value);
  };
  
  function unwrap(promise, func, value) {
    immediate(function () {
      var returnValue;
      try {
        returnValue = func(value);
      } catch (e) {
        return handlers.reject(promise, e);
      }
      if (returnValue === promise) {
        handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
      } else {
        handlers.resolve(promise, returnValue);
      }
    });
  }
  
  handlers.resolve = function (self, value) {
    var result = tryCatch(getThen, value);
    if (result.status === 'error') {
      return handlers.reject(self, result.value);
    }
    var thenable = result.value;
  
    if (thenable) {
      safelyResolveThenable(self, thenable);
    } else {
      self.state = FULFILLED;
      self.outcome = value;
      var i = -1;
      var len = self.queue.length;
      while (++i < len) {
        self.queue[i].callFulfilled(value);
      }
    }
    return self;
  };
  handlers.reject = function (self, error) {
    self.state = REJECTED;
    self.outcome = error;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callRejected(error);
    }
    return self;
  };
  
  function getThen(obj) {
    var then = obj && obj.then;
    if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
      return function appyThen() {
        then.apply(obj, arguments);
      };
    }
  }
  
  function safelyResolveThenable(self, thenable) {
    var called = false;
    function onError(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.reject(self, value);
    }
  
    function onSuccess(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.resolve(self, value);
    }
  
    function tryToUnwrap() {
      thenable(onSuccess, onError);
    }
  
    var result = tryCatch(tryToUnwrap);
    if (result.status === 'error') {
      onError(result.value);
    }
  }
  
  function tryCatch(func, value) {
    var out = {};
    try {
      out.value = func(value);
      out.status = 'success';
    } catch (e) {
      out.status = 'error';
      out.value = e;
    }
    return out;
  }
  
  Promise.resolve = resolve;
  function resolve(value) {
    if (value instanceof this) {
      return value;
    }
    return handlers.resolve(new this(INTERNAL), value);
  }
  
  Promise.reject = reject;
  function reject(reason) {
    var promise = new this(INTERNAL);
    return handlers.reject(promise, reason);
  }
  
  Promise.all = all;
  function all(iterable) {
    var self = this;
    if (Object.prototype.toString.call(iterable) !== '[object Array]') {
      return this.reject(new TypeError('must be an array'));
    }
  
    var len = iterable.length;
    var called = false;
    if (!len) {
      return this.resolve([]);
    }
  
    var values = new Array(len);
    var resolved = 0;
    var i = -1;
    var promise = new this(INTERNAL);
  
    while (++i < len) {
      allResolver(iterable[i], i);
    }
    return promise;
    function allResolver(value, i) {
      self.resolve(value).then(resolveFromAll, function (error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
      function resolveFromAll(outValue) {
        values[i] = outValue;
        if (++resolved === len && !called) {
          called = true;
          handlers.resolve(promise, values);
        }
      }
    }
  }
  
  Promise.race = race;
  function race(iterable) {
    var self = this;
    if (Object.prototype.toString.call(iterable) !== '[object Array]') {
      return this.reject(new TypeError('must be an array'));
    }
  
    var len = iterable.length;
    var called = false;
    if (!len) {
      return this.resolve([]);
    }
  
    var i = -1;
    var promise = new this(INTERNAL);
  
    while (++i < len) {
      resolver(iterable[i]);
    }
    return promise;
    function resolver(value) {
      self.resolve(value).then(function (response) {
        if (!called) {
          called = true;
          handlers.resolve(promise, response);
        }
      }, function (error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
    }
  }
  
  },{"immediate":36}],38:[function(require,module,exports){
  'use strict';
  
  var assign    = require('./lib/utils/common').assign;
  
  var deflate   = require('./lib/deflate');
  var inflate   = require('./lib/inflate');
  var constants = require('./lib/zlib/constants');
  
  var pako = {};
  
  assign(pako, deflate, inflate, constants);
  
  module.exports = pako;
  
  },{"./lib/deflate":39,"./lib/inflate":40,"./lib/utils/common":41,"./lib/zlib/constants":44}],39:[function(require,module,exports){
  'use strict';
  
  
  var zlib_deflate = require('./zlib/deflate');
  var utils        = require('./utils/common');
  var strings      = require('./utils/strings');
  var msg          = require('./zlib/messages');
  var ZStream      = require('./zlib/zstream');
  
  var toString = Object.prototype.toString;
  /* ===========================================================================*/
  
  var Z_NO_FLUSH      = 0;
  var Z_FINISH        = 4;
  
  var Z_OK            = 0;
  var Z_STREAM_END    = 1;
  var Z_SYNC_FLUSH    = 2;
  
  var Z_DEFAULT_COMPRESSION = -1;
  
  var Z_DEFAULT_STRATEGY    = 0;
  
  var Z_DEFLATED  = 8;
  /**
   * class Deflate
   *
   * Generic JS-style wrapper for zlib calls. If you don't need
   * streaming behaviour - use more simple functions: [[deflate]],
   * [[deflateRaw]] and [[gzip]].
   **/
  /**
   * Deflate.result -> Uint8Array|Array
   *
   * Compressed result, generated by default [[Deflate#onData]]
   * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
   * (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
   * push a chunk with explicit flush (call [[Deflate#push]] with
   * `Z_SYNC_FLUSH` param).
   **/
  /**
   * Deflate.msg -> String
   *
   * Error message, if [[Deflate.err]] != 0
   **/
  function Deflate(options) {
    if (!(this instanceof Deflate)) return new Deflate(options);
  
    this.options = utils.assign({
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY,
      to: ''
    }, options || {});
  
    var opt = this.options;
  
    if (opt.raw && (opt.windowBits > 0)) {
      opt.windowBits = -opt.windowBits;
    }
  
    else if (opt.gzip && (opt.windowBits > 0) && (opt.windowBits < 16)) {
      opt.windowBits += 16;
    }
  
    this.err    = 0;      // error code, if happens (0 = Z_OK)
    this.msg    = '';     // error message
    this.ended  = false;  // used to avoid multiple onEnd() calls
    this.chunks = [];     // chunks of compressed data
  
    this.strm = new ZStream();
    this.strm.avail_out = 0;
  
    var status = zlib_deflate.deflateInit2(
      this.strm,
      opt.level,
      opt.method,
      opt.windowBits,
      opt.memLevel,
      opt.strategy
    );
  
    if (status !== Z_OK) {
      throw new Error(msg[status]);
    }
  
    if (opt.header) {
      zlib_deflate.deflateSetHeader(this.strm, opt.header);
    }
  
    if (opt.dictionary) {
      var dict;
      if (typeof opt.dictionary === 'string') {
        dict = strings.string2buf(opt.dictionary);
      } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
        dict = new Uint8Array(opt.dictionary);
      } else {
        dict = opt.dictionary;
      }
  
      status = zlib_deflate.deflateSetDictionary(this.strm, dict);
  
      if (status !== Z_OK) {
        throw new Error(msg[status]);
      }
  
      this._dict_set = true;
    }
  }
  Deflate.prototype.push = function (data, mode) {
    var strm = this.strm;
    var chunkSize = this.options.chunkSize;
    var status, _mode;
  
    if (this.ended) { return false; }
  
    _mode = (mode === ~~mode) ? mode : ((mode === true) ? Z_FINISH : Z_NO_FLUSH);
    if (typeof data === 'string') {
      strm.input = strings.string2buf(data);
    } else if (toString.call(data) === '[object ArrayBuffer]') {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
  
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
  
    do {
      if (strm.avail_out === 0) {
        strm.output = new utils.Buf8(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = zlib_deflate.deflate(strm, _mode);    /* no bad return value */
  
      if (status !== Z_STREAM_END && status !== Z_OK) {
        this.onEnd(status);
        this.ended = true;
        return false;
      }
      if (strm.avail_out === 0 || (strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH))) {
        if (this.options.to === 'string') {
          this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);
    if (_mode === Z_FINISH) {
      status = zlib_deflate.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK;
    }
    if (_mode === Z_SYNC_FLUSH) {
      this.onEnd(Z_OK);
      strm.avail_out = 0;
      return true;
    }
  
    return true;
  };
  Deflate.prototype.onData = function (chunk) {
    this.chunks.push(chunk);
  };
  Deflate.prototype.onEnd = function (status) {
    if (status === Z_OK) {
      if (this.options.to === 'string') {
        this.result = this.chunks.join('');
      } else {
        this.result = utils.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function deflate(input, options) {
    var deflator = new Deflate(options);
  
    deflator.push(input, true);
    if (deflator.err) { throw deflator.msg || msg[deflator.err]; }
  
    return deflator.result;
  }
  function deflateRaw(input, options) {
    options = options || {};
    options.raw = true;
    return deflate(input, options);
  }
  function gzip(input, options) {
    options = options || {};
    options.gzip = true;
    return deflate(input, options);
  }
  
  
  exports.Deflate = Deflate;
  exports.deflate = deflate;
  exports.deflateRaw = deflateRaw;
  exports.gzip = gzip;
  
  },{"./utils/common":41,"./utils/strings":42,"./zlib/deflate":46,"./zlib/messages":51,"./zlib/zstream":53}],40:[function(require,module,exports){
  'use strict';
  
  
  var zlib_inflate = require('./zlib/inflate');
  var utils        = require('./utils/common');
  var strings      = require('./utils/strings');
  var c            = require('./zlib/constants');
  var msg          = require('./zlib/messages');
  var ZStream      = require('./zlib/zstream');
  var GZheader     = require('./zlib/gzheader');
  
  var toString = Object.prototype.toString;
  /* internal
   * inflate.chunks -> Array
   *
   * Chunks of output data, if [[Inflate#onData]] not overriden.
   **/
  /**
   * Inflate.err -> Number
   *
   * Error code after inflate finished. 0 (Z_OK) on success.
   * Should be checked if broken data possible.
   **/
  /**
   * new Inflate(options)
   * - options (Object): zlib inflate options.
   *
   * Creates new inflator instance with specified params. Throws exception
   * on bad params. Supported options:
   *
   * - `windowBits`
   * - `dictionary`
   *
   * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
   * for more information on these.
   *
   * Additional options, for internal needs:
   *
   * - `chunkSize` - size of generated data chunks (16K by default)
   * - `raw` (Boolean) - do raw inflate
   * - `to` (String) - if equal to 'string', then result will be converted
   *   from utf8 to utf16 (javascript) string. When string output requested,
   *   chunk length can differ from `chunkSize`, depending on content.
   *
   * By default, when no options set, autodetect deflate/gzip data format via
   * wrapper header.
   *
   * ##### Example:
   *
   * ```javascript
   * var pako = require('pako')
   *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
   *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
   *
   * var inflate = new pako.Inflate({ level: 3});
   *
   * inflate.push(chunk1, false);
   * inflate.push(chunk2, true);  // true -> last chunk
   *
   * if (inflate.err) { throw new Error(inflate.err); }
   *
   * console.log(inflate.result);
   * ```
   **/
  function Inflate(options) {
    if (!(this instanceof Inflate)) return new Inflate(options);
  
    this.options = utils.assign({
      chunkSize: 16384,
      windowBits: 0,
      to: ''
    }, options || {});
  
    var opt = this.options;
    // because we have no header for autodetect.
    if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) { opt.windowBits = -15; }
    }
    if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
        !(options && options.windowBits)) {
      opt.windowBits += 32;
    }
    // for deflate. So, if window size not set, force it to max when gzip possible
    if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
      // bit 4 (32) -> autodetect gzip/deflate
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15;
      }
    }
  
    this.err    = 0;      // error code, if happens (0 = Z_OK)
    this.msg    = '';     // error message
    this.ended  = false;  // used to avoid multiple onEnd() calls
    this.chunks = [];     // chunks of compressed data
  
    this.strm   = new ZStream();
    this.strm.avail_out = 0;
  
    var status  = zlib_inflate.inflateInit2(
      this.strm,
      opt.windowBits
    );
  
    if (status !== c.Z_OK) {
      throw new Error(msg[status]);
    }
  
    this.header = new GZheader();
  
    zlib_inflate.inflateGetHeader(this.strm, this.header);
  }
  Inflate.prototype.push = function (data, mode) {
    var strm = this.strm;
    var chunkSize = this.options.chunkSize;
    var dictionary = this.options.dictionary;
    var status, _mode;
    var next_out_utf8, tail, utf8str;
    var dict;
    // when we check that all output data was flushed.
    var allowBufError = false;
  
    if (this.ended) { return false; }
    _mode = (mode === ~~mode) ? mode : ((mode === true) ? c.Z_FINISH : c.Z_NO_FLUSH);
    if (typeof data === 'string') {
      strm.input = strings.binstring2buf(data);
    } else if (toString.call(data) === '[object ArrayBuffer]') {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
  
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
  
    do {
      if (strm.avail_out === 0) {
        strm.output = new utils.Buf8(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
  
      status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);    /* no bad return value */
  
      if (status === c.Z_NEED_DICT && dictionary) {
        if (typeof dictionary === 'string') {
          dict = strings.string2buf(dictionary);
        } else if (toString.call(dictionary) === '[object ArrayBuffer]') {
          dict = new Uint8Array(dictionary);
        } else {
          dict = dictionary;
        }
  
        status = zlib_inflate.inflateSetDictionary(this.strm, dict);
  
      }
  
      if (status === c.Z_BUF_ERROR && allowBufError === true) {
        status = c.Z_OK;
        allowBufError = false;
      }
  
      if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
        this.onEnd(status);
        this.ended = true;
        return false;
      }
  
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === c.Z_STREAM_END || (strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH))) {
  
          if (this.options.to === 'string') {
  
            next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
  
            tail = strm.next_out - next_out_utf8;
            utf8str = strings.buf2string(strm.output, next_out_utf8);
            strm.next_out = tail;
            strm.avail_out = chunkSize - tail;
            if (tail) { utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0); }
  
            this.onData(utf8str);
  
          } else {
            this.onData(utils.shrinkBuf(strm.output, strm.next_out));
          }
        }
      }
      // are flushed. The only way to do it when avail_out = 0 - run one more
      // Here we set flag to process this error properly.
      // NOTE. Deflate does not return error in this case and does not needs such
      if (strm.avail_in === 0 && strm.avail_out === 0) {
        allowBufError = true;
      }
  
    } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
  
    if (status === c.Z_STREAM_END) {
      _mode = c.Z_FINISH;
    }
    if (_mode === c.Z_FINISH) {
      status = zlib_inflate.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === c.Z_OK;
    }
    if (_mode === c.Z_SYNC_FLUSH) {
      this.onEnd(c.Z_OK);
      strm.avail_out = 0;
      return true;
    }
  
    return true;
  };
  Inflate.prototype.onData = function (chunk) {
    this.chunks.push(chunk);
  };
  Inflate.prototype.onEnd = function (status) {
    if (status === c.Z_OK) {
      if (this.options.to === 'string') {
        // utf8 alligned strings to onData
        this.result = this.chunks.join('');
      } else {
        this.result = utils.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function inflate(input, options) {
    var inflator = new Inflate(options);
  
    inflator.push(input, true);
    if (inflator.err) { throw inflator.msg || msg[inflator.err]; }
  
    return inflator.result;
  }
  function inflateRaw(input, options) {
    options = options || {};
    options.raw = true;
    return inflate(input, options);
  }
  exports.Inflate = Inflate;
  exports.inflate = inflate;
  exports.inflateRaw = inflateRaw;
  exports.ungzip  = inflate;
  
  },{"./utils/common":41,"./utils/strings":42,"./zlib/constants":44,"./zlib/gzheader":47,"./zlib/inflate":49,"./zlib/messages":51,"./zlib/zstream":53}],41:[function(require,module,exports){
  'use strict';
  
  
  var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
                  (typeof Uint16Array !== 'undefined') &&
                  (typeof Int32Array !== 'undefined');
  
  
  exports.assign = function (obj /*from1, from2, from3, ...*/) {
    var sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      var source = sources.shift();
      if (!source) { continue; }
  
      if (typeof source !== 'object') {
        throw new TypeError(source + 'must be non-object');
      }
  
      for (var p in source) {
        if (source.hasOwnProperty(p)) {
          obj[p] = source[p];
        }
      }
    }
  
    return obj;
  };
  exports.shrinkBuf = function (buf, size) {
    if (buf.length === size) { return buf; }
    if (buf.subarray) { return buf.subarray(0, size); }
    buf.length = size;
    return buf;
  };
  
  
  var fnTyped = {
    arraySet: function (dest, src, src_offs, len, dest_offs) {
      if (src.subarray && dest.subarray) {
        dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
        return;
      }
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src[src_offs + i];
      }
    },
    flattenChunks: function (chunks) {
      var i, l, len, pos, chunk, result;
      len = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        len += chunks[i].length;
      }
      result = new Uint8Array(len);
      pos = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        chunk = chunks[i];
        result.set(chunk, pos);
        pos += chunk.length;
      }
  
      return result;
    }
  };
  
  var fnUntyped = {
    arraySet: function (dest, src, src_offs, len, dest_offs) {
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src[src_offs + i];
      }
    },
    flattenChunks: function (chunks) {
      return [].concat.apply([], chunks);
    }
  };
  //
  exports.setTyped = function (on) {
    if (on) {
      exports.Buf8  = Uint8Array;
      exports.Buf16 = Uint16Array;
      exports.Buf32 = Int32Array;
      exports.assign(exports, fnTyped);
    } else {
      exports.Buf8  = Array;
      exports.Buf16 = Array;
      exports.Buf32 = Array;
      exports.assign(exports, fnUntyped);
    }
  };
  
  exports.setTyped(TYPED_OK);
  
  },{}],42:[function(require,module,exports){
  'use strict';
  
  
  var utils = require('./common');
  //
  // - apply(Uint8Array) can fail on iOS 5.1 Safary
  var STR_APPLY_OK = true;
  var STR_APPLY_UIA_OK = true;
  
  try { String.fromCharCode.apply(null, [ 0 ]); } catch (__) { STR_APPLY_OK = false; }
  try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch (__) { STR_APPLY_UIA_OK = false; }
  // Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
  var _utf8len = new utils.Buf8(256);
  for (var q = 0; q < 256; q++) {
    _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
  }
  _utf8len[254] = _utf8len[254] = 1; // Invalid sequence start
  exports.string2buf = function (str) {
    var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 0xfc00) === 0xdc00) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          m_pos++;
        }
      }
      buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    buf = new utils.Buf8(buf_len);
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 0xfc00) === 0xdc00) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          m_pos++;
        }
      }
      if (c < 0x80) {
        buf[i++] = c;
      } else if (c < 0x800) {
        buf[i++] = 0xC0 | (c >>> 6);
        buf[i++] = 0x80 | (c & 0x3f);
      } else if (c < 0x10000) {
        buf[i++] = 0xE0 | (c >>> 12);
        buf[i++] = 0x80 | (c >>> 6 & 0x3f);
        buf[i++] = 0x80 | (c & 0x3f);
      } else {
        buf[i++] = 0xf0 | (c >>> 18);
        buf[i++] = 0x80 | (c >>> 12 & 0x3f);
        buf[i++] = 0x80 | (c >>> 6 & 0x3f);
        buf[i++] = 0x80 | (c & 0x3f);
      }
    }
  
    return buf;
  };
  function buf2binstring(buf, len) {
    if (len < 65537) {
      if ((buf.subarray && STR_APPLY_UIA_OK) || (!buf.subarray && STR_APPLY_OK)) {
        return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
      }
    }
  
    var result = '';
    for (var i = 0; i < len; i++) {
      result += String.fromCharCode(buf[i]);
    }
    return result;
  }
  exports.buf2binstring = function (buf) {
    return buf2binstring(buf, buf.length);
  };
  exports.binstring2buf = function (str) {
    var buf = new utils.Buf8(str.length);
    for (var i = 0, len = buf.length; i < len; i++) {
      buf[i] = str.charCodeAt(i);
    }
    return buf;
  };
  exports.buf2string = function (buf, max) {
    var i, out, c, c_len;
    var len = max || buf.length;
    // NB: by unknown reasons, Array is significantly faster for
    var utf16buf = new Array(len * 2);
  
    for (out = 0, i = 0; i < len;) {
      c = buf[i++];
      if (c < 0x80) { utf16buf[out++] = c; continue; }
  
      c_len = _utf8len[c];
      if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len - 1; continue; }
      c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
      while (c_len > 1 && i < len) {
        c = (c << 6) | (buf[i++] & 0x3f);
        c_len--;
      }
      if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }
  
      if (c < 0x10000) {
        utf16buf[out++] = c;
      } else {
        c -= 0x10000;
        utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
        utf16buf[out++] = 0xdc00 | (c & 0x3ff);
      }
    }
  
    return buf2binstring(utf16buf, out);
  };
  // that will not break sequence. If that's not possible
  //
  // max   - length limit (mandatory);
  exports.utf8border = function (buf, max) {
    var pos;
  
    max = max || buf.length;
    if (max > buf.length) { max = buf.length; }
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }
    // return max, because we should return something anyway.
    if (pos < 0) { return max; }
    // return max too.
    if (pos === 0) { return max; }
  
    return (pos + _utf8len[buf[pos]] > max) ? pos : max;
  };
  
  },{"./common":41}],43:[function(require,module,exports){
  'use strict';
  // It doesn't worth to make additional optimizationa as in original.
  
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  function adler32(adler, buf, len, pos) {
    var s1 = (adler & 0xffff) |0,
        s2 = ((adler >>> 16) & 0xffff) |0,
        n = 0;
  
    while (len !== 0) {
      // s2 in 31-bits, because we force signed ints.
      n = len > 2000 ? 2000 : len;
      len -= n;
  
      do {
        s1 = (s1 + buf[pos++]) |0;
        s2 = (s2 + s1) |0;
      } while (--n);
  
      s1 %= 65521;
      s2 %= 65521;
    }
  
    return (s1 | (s2 << 16)) |0;
  }
  
  
  module.exports = adler32;
  
  },{}],44:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  module.exports = {
    Z_NO_FLUSH:         0,
    Z_PARTIAL_FLUSH:    1,
    Z_SYNC_FLUSH:       2,
    Z_FULL_FLUSH:       3,
    Z_FINISH:           4,
    Z_BLOCK:            5,
    Z_TREES:            6,
    Z_OK:               0,
    Z_STREAM_END:       1,
    Z_NEED_DICT:        2,
    Z_ERRNO:           -1,
    Z_STREAM_ERROR:    -2,
    Z_DATA_ERROR:      -3,
    Z_BUF_ERROR:       -5,
    Z_NO_COMPRESSION:         0,
    Z_BEST_SPEED:             1,
    Z_BEST_COMPRESSION:       9,
    Z_DEFAULT_COMPRESSION:   -1,
  
  
    Z_FILTERED:               1,
    Z_HUFFMAN_ONLY:           2,
    Z_RLE:                    3,
    Z_FIXED:                  4,
    Z_DEFAULT_STRATEGY:       0,
    Z_BINARY:                 0,
    Z_TEXT:                   1,
    Z_UNKNOWN:                2,
    Z_DEFLATED:               8
  };
  
  },{}],45:[function(require,module,exports){
  'use strict';
  // So write code to minimize size - no pregenerated tables
  
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  function makeTable() {
    var c, table = [];
  
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c;
    }
  
    return table;
  }
  var crcTable = makeTable();
  
  
  function crc32(crc, buf, len, pos) {
    var t = crcTable,
        end = pos + len;
  
    crc ^= -1;
  
    for (var i = pos; i < end; i++) {
      crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    }
  
    return (crc ^ (-1)); // >>> 0;
  }
  
  
  module.exports = crc32;
  
  },{}],46:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  var utils   = require('../utils/common');
  var trees   = require('./trees');
  var adler32 = require('./adler32');
  var crc32   = require('./crc32');
  var msg     = require('./messages');
  /* ===========================================================================*/
  var Z_NO_FLUSH      = 0;
  var Z_PARTIAL_FLUSH = 1;
  var Z_FULL_FLUSH    = 3;
  var Z_FINISH        = 4;
  var Z_BLOCK         = 5;
  var Z_OK            = 0;
  var Z_STREAM_END    = 1;
  //var Z_ERRNO         = -1;
  var Z_STREAM_ERROR  = -2;
  var Z_DATA_ERROR    = -3;
  var Z_BUF_ERROR     = -5;
  //var Z_NO_COMPRESSION      = 0;
  //var Z_BEST_COMPRESSION    = 9;
  var Z_DEFAULT_COMPRESSION = -1;
  
  
  var Z_FILTERED            = 1;
  var Z_HUFFMAN_ONLY        = 2;
  var Z_RLE                 = 3;
  var Z_FIXED               = 4;
  var Z_DEFAULT_STRATEGY    = 0;
  //var Z_TEXT                = 1;
  var Z_UNKNOWN             = 2;
  var Z_DEFLATED  = 8;
  var MAX_MEM_LEVEL = 9;
  var MAX_WBITS = 15;
  var DEF_MEM_LEVEL = 8;
  
  
  var LENGTH_CODES  = 29;
  var LITERALS      = 256;
  var L_CODES       = LITERALS + 1 + LENGTH_CODES;
  var D_CODES       = 30;
  var BL_CODES      = 19;
  var HEAP_SIZE     = 2 * L_CODES + 1;
  var MAX_BITS  = 15;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);
  
  var PRESET_DICT = 0x20;
  
  var INIT_STATE = 42;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;
  
  var BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
  var BS_BLOCK_DONE     = 2; /* block flush performed */
  var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
  var BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */
  
  var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.
  
  function err(strm, errorCode) {
    strm.msg = msg[errorCode];
    return errorCode;
  }
  
  function rank(f) {
    return ((f) << 1) - ((f) > 4 ? 9 : 0);
  }
  
  function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }
  function flush_pending(strm) {
    var s = strm.state;
    var len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) { return; }
  
    utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  }
  
  
  function flush_block_only(s, last) {
    trees._tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  }
  
  
  function put_byte(s, b) {
    s.pending_buf[s.pending++] = b;
  }
  function putShortMSB(s, b) {
  //  put_byte(s, (Byte)(b & 0xff));
    s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
    s.pending_buf[s.pending++] = b & 0xff;
  }
  function read_buf(strm, buf, start, size) {
    var len = strm.avail_in;
  
    if (len > size) { len = size; }
    if (len === 0) { return 0; }
  
    strm.avail_in -= len;
    utils.arraySet(buf, strm.input, strm.next_in, len, start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32(strm.adler, buf, len, start);
    }
  
    else if (strm.state.wrap === 2) {
      strm.adler = crc32(strm.adler, buf, len, start);
    }
  
    strm.next_in += len;
    strm.total_in += len;
  
    return len;
  }
  function longest_match(s, cur_match) {
    var chain_length = s.max_chain_length;      /* max hash chain length */
    var scan = s.strstart; /* current string */
    var match;                       /* matched string */
    var len;                           /* length of current match */
    var best_len = s.prev_length;              /* best match length so far */
    var nice_match = s.nice_match;             /* stop if match long enough */
    var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
        s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;
  
    var _win = s.window; // shortcut
  
    var wmask = s.w_mask;
    var prev  = s.prev;
    var strend = s.strstart + MAX_MATCH;
    var scan_end1  = _win[scan + best_len - 1];
    var scan_end   = _win[scan + best_len];
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    if (nice_match > s.lookahead) { nice_match = s.lookahead; }
  
    do {
      match = cur_match;
      if (_win[match + best_len]     !== scan_end  ||
          _win[match + best_len - 1] !== scan_end1 ||
          _win[match]                !== _win[scan] ||
          _win[++match]              !== _win[scan + 1]) {
        continue;
      }
      scan += 2;
      match++;
      do {
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
               _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
               _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
               _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
               scan < strend);
  
      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;
  
      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1  = _win[scan + best_len - 1];
        scan_end   = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  
    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  }
  function fill_window(s) {
    var _w_size = s.w_size;
    var p, n, m, more, str;
  
    do {
      more = s.window_size - s.lookahead - s.strstart;
      //if (sizeof(int) <= 2) {
      //        more = wsize;
      //  } else if (more == (unsigned)(-1)) {
      //         * strstart == 0 && lookahead == 1 (input done a byte at time)
      //        more--;
      //}
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
  
        utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        s.block_start -= _w_size;
        n = s.hash_size;
        p = n;
        do {
          m = s.head[--p];
          s.head[p] = (m >= _w_size ? m - _w_size : 0);
        } while (--n);
  
        n = _w_size;
        p = n;
        do {
          m = s.prev[--p];
          s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        } while (--n);
  
        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n;
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
  //        Call update_hash() MIN_MATCH-3 more times
        while (s.insert) {
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
  
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
  //    var curr = s.strstart + s.lookahead;
  //
  //      /* Previous high water mark below current data -- zero WIN_INIT
  //       */
  //      if (init > WIN_INIT)
  //      zmemzero(s->window + curr, (unsigned)init);
  //    }
  //      /* High water mark at or above current data, but below current data
  //       * to end of window, whichever is less.
  //      init = (ulg)curr + WIN_INIT - s->high_water;
  //        init = s->window_size - s->high_water;
  //      s->high_water += init;
  //  }
  //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
  }
  function deflate_stored(s, flush) {
    var max_block_size = 0xffff;
  
    if (max_block_size > s.pending_buf_size - 5) {
      max_block_size = s.pending_buf_size - 5;
    }
    for (;;) {
      if (s.lookahead <= 1) {
        //  s->block_start >= (long)s->w_size, "slide too late");
  //        s.block_start >= s.w_size)) {
  //      }
  
        fill_window(s);
        if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
  
        if (s.lookahead === 0) {
          break;
        }
      }
  //    if (s.block_start < 0) throw new Error("block gone");
  
      s.strstart += s.lookahead;
      s.lookahead = 0;
      var max_start = s.block_start + max_block_size;
  
      if (s.strstart === 0 || s.strstart >= max_start) {
        s.lookahead = s.strstart - max_start;
        s.strstart = max_start;
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
  
    s.insert = 0;
  
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
  
    if (s.strstart > s.block_start) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  
    return BS_NEED_MORE;
  }
  function deflate_fast(s, flush) {
    var hash_head;        /* head of the hash chain */
    var bflush;           /* set if current block must be flushed */
  
    for (;;) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break; /* flush the current block */
        }
      }
      hash_head = 0/*NIL*/;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
        s.match_length = longest_match(s, hash_head);
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
  
        s.lookahead -= s.match_length;
        if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
          s.match_length--; /* string at strstart already in table */
          do {
            s.strstart++;
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
            /* strstart never exceeds WSIZE-MAX_MATCH, so there are
             * always MIN_MATCH bytes ahead.
             */
          } while (--s.match_length !== 0);
          s.strstart++;
        } else
        {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;
  //                Call UPDATE_HASH() MIN_MATCH-3 more times
        }
      } else {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
  
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function deflate_slow(s, flush) {
    var hash_head;          /* head of hash chain */
    var bflush;              /* set if current block must be flushed */
  
    var max_insert;
    for (;;) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) { break; } /* flush the current block */
      }
      hash_head = 0/*NIL*/;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;
  
      if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
          s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
        s.match_length = longest_match(s, hash_head);
        if (s.match_length <= 5 &&
           (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {
          s.match_length = MIN_MATCH - 1;
        }
      }
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;
  
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
  
      } else if (s.match_available) {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
  
        if (bflush) {
          flush_block_only(s, false);
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    if (s.match_available) {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
  
      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  
    return BS_BLOCK_DONE;
  }
  function deflate_rle(s, flush) {
    var bflush;            /* set if current block must be flushed */
    var prev;              /* byte at distance one to match */
    var scan, strend;      /* scan goes up to strend for length of run */
  
    var _win = s.window;
  
    for (;;) {
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) { break; } /* flush the current block */
      }
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
          } while (prev === _win[++scan] && prev === _win[++scan] &&
                   prev === _win[++scan] && prev === _win[++scan] &&
                   prev === _win[++scan] && prev === _win[++scan] &&
                   prev === _win[++scan] && prev === _win[++scan] &&
                   scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
  
        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
  
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function deflate_huff(s, flush) {
    var bflush;             /* set if current block must be flushed */
  
    for (;;) {
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          break;      /* flush the current block */
        }
      }
      s.match_length = 0;
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
  
  var configuration_table;
  
  configuration_table = [
    new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
    new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
    new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
    new Config(4, 6, 32, 32, deflate_fast),          /* 3 */
  
    new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
    new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
    new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
    new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
    new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
    new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
  ];
  function lm_init(s) {
    s.window_size = 2 * s.w_size;
    zero(s.head); // Fill with NIL (= 0);
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;
  
    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  }
  
  
  function DeflateState() {
    this.strm = null;            /* pointer back to this zlib stream */
    this.status = 0;            /* as the name implies */
    this.pending_buf = null;      /* output still pending */
    this.pending_buf_size = 0;  /* size of pending_buf */
    this.pending_out = 0;       /* next pending byte to output to the stream */
    this.pending = 0;           /* nb of bytes in the pending buffer */
    this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
    this.gzhead = null;         /* gzip header information to write */
    this.gzindex = 0;           /* where in extra, name, or comment */
    this.method = Z_DEFLATED; /* can only be DEFLATED */
    this.last_flush = -1;   /* value of flush param for previous deflate call */
  
    this.w_size = 0;  /* LZ77 window size (32K by default) */
    this.w_bits = 0;  /* log2(w_size)  (8..16) */
    this.w_mask = 0;  /* w_size - 1 */
  
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;   /* Heads of the hash chains or NIL. */
  
    this.ins_h = 0;       /* hash index of string to be inserted */
    this.hash_size = 0;   /* number of elements in hash table */
    this.hash_bits = 0;   /* log2(hash_size) */
    this.hash_mask = 0;   /* hash_size-1 */
  
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;      /* length of best match */
    this.prev_match = 0;        /* previous match */
    this.match_available = 0;   /* set if previous match exists */
    this.strstart = 0;          /* start of string to insert */
    this.match_start = 0;       /* start of matching string */
    this.lookahead = 0;         /* number of valid bytes ahead in window */
  
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    //this.max_insert_length = 0;
    this.level = 0;     /* compression level (1..9) */
    this.strategy = 0;  /* favor or force Huffman coding*/
  
    this.good_match = 0;
    this.nice_match = 0; /* Stop searching when current match exceeds this */
    /* Didn't use ct_data typedef below to suppress compiler warning */
    // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  
    // because JS does not support effective
    this.dyn_ltree  = new utils.Buf16(HEAP_SIZE * 2);
    this.dyn_dtree  = new utils.Buf16((2 * D_CODES + 1) * 2);
    this.bl_tree    = new utils.Buf16((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
  
    this.l_desc   = null;         /* desc. for literal tree */
    this.d_desc   = null;         /* desc. for distance tree */
    this.bl_desc  = null;         /* desc. for bit length tree */
    this.bl_count = new utils.Buf16(MAX_BITS + 1);
    this.heap = new utils.Buf16(2 * L_CODES + 1);  /* heap used to build the Huffman trees */
    zero(this.heap);
  
    this.heap_len = 0;               /* number of elements in the heap */
    this.heap_max = 0;               /* element of largest frequency */
    this.depth = new utils.Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
    zero(this.depth);
    this.l_buf = 0;          /* buffer index for literals or lengths */
  
    this.lit_bufsize = 0;
    this.last_lit = 0;      /* running index in l_buf */
  
    this.d_buf = 0;
    this.opt_len = 0;       /* bit length of current block with optimal trees */
    this.static_len = 0;    /* bit length of current block with static trees */
    this.matches = 0;       /* number of string matches in current block */
    this.insert = 0;        /* bytes at end of window left to insert */
  
  
    this.bi_buf = 0;
    this.bi_valid = 0;
    // sense only for pointers and memory check tools.
  }
  
  
  function deflateResetKeep(strm) {
    var s;
  
    if (!strm || !strm.state) {
      return err(strm, Z_STREAM_ERROR);
    }
  
    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN;
  
    s = strm.state;
    s.pending = 0;
    s.pending_out = 0;
  
    if (s.wrap < 0) {
      s.wrap = -s.wrap;
    }
    s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
    strm.adler = (s.wrap === 2) ?
      0  // crc32(0, Z_NULL, 0)
    :
      1; // adler32(0, Z_NULL, 0)
    s.last_flush = Z_NO_FLUSH;
    trees._tr_init(s);
    return Z_OK;
  }
  
  
  function deflateReset(strm) {
    var ret = deflateResetKeep(strm);
    if (ret === Z_OK) {
      lm_init(strm.state);
    }
    return ret;
  }
  
  
  function deflateSetHeader(strm, head) {
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    if (strm.state.wrap !== 2) { return Z_STREAM_ERROR; }
    strm.state.gzhead = head;
    return Z_OK;
  }
  
  
  function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
    if (!strm) { // === Z_NULL
      return Z_STREAM_ERROR;
    }
    var wrap = 1;
  
    if (level === Z_DEFAULT_COMPRESSION) {
      level = 6;
    }
  
    if (windowBits < 0) { /* suppress zlib wrapper */
      wrap = 0;
      windowBits = -windowBits;
    }
  
    else if (windowBits > 15) {
      wrap = 2;           /* write gzip wrapper instead */
      windowBits -= 16;
    }
  
  
    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED ||
      windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
      strategy < 0 || strategy > Z_FIXED) {
      return err(strm, Z_STREAM_ERROR);
    }
  
  
    if (windowBits === 8) {
      windowBits = 9;
    }
    var s = new DeflateState();
  
    strm.state = s;
    s.strm = strm;
  
    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;
  
    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  
    s.window = new utils.Buf8(s.w_size * 2);
    s.head = new utils.Buf16(s.hash_size);
    s.prev = new utils.Buf16(s.w_size);
    //s.high_water = 0;  /* nothing written to s->window yet */
  
    s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */
  
    s.pending_buf_size = s.lit_bufsize * 4;
    //s->pending_buf = (uchf *) overlay;
    s.pending_buf = new utils.Buf8(s.pending_buf_size);
    //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
    s.d_buf = 1 * s.lit_bufsize;
    s.l_buf = (1 + 2) * s.lit_bufsize;
  
    s.level = level;
    s.strategy = strategy;
    s.method = method;
  
    return deflateReset(strm);
  }
  
  function deflateInit(strm, level) {
    return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
  }
  
  
  function deflate(strm, flush) {
    var old_flush, s;
    var beg, val; // for gzip header write only
  
    if (!strm || !strm.state ||
      flush > Z_BLOCK || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
    }
  
    s = strm.state;
  
    if (!strm.output ||
        (!strm.input && strm.avail_in !== 0) ||
        (s.status === FINISH_STATE && flush !== Z_FINISH)) {
      return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR : Z_STREAM_ERROR);
    }
  
    s.strm = strm; /* just in case */
    old_flush = s.last_flush;
    s.last_flush = flush;
    if (s.status === INIT_STATE) {
  
      if (s.wrap === 2) { // GZIP header
        strm.adler = 0;  //crc32(0L, Z_NULL, 0);
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) { // s->gzhead == Z_NULL
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 :
                      (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                       4 : 0));
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
        }
        else {
          put_byte(s, (s.gzhead.text ? 1 : 0) +
                      (s.gzhead.hcrc ? 2 : 0) +
                      (!s.gzhead.extra ? 0 : 4) +
                      (!s.gzhead.name ? 0 : 8) +
                      (!s.gzhead.comment ? 0 : 16)
                  );
          put_byte(s, s.gzhead.time & 0xff);
          put_byte(s, (s.gzhead.time >> 8) & 0xff);
          put_byte(s, (s.gzhead.time >> 16) & 0xff);
          put_byte(s, (s.gzhead.time >> 24) & 0xff);
          put_byte(s, s.level === 9 ? 2 :
                      (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                       4 : 0));
          put_byte(s, s.gzhead.os & 0xff);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 0xff);
            put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
          }
          if (s.gzhead.hcrc) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
          }
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      }
      else // DEFLATE header
      {
        var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8;
        var level_flags = -1;
  
        if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= (level_flags << 6);
        if (s.strstart !== 0) { header |= PRESET_DICT; }
        header += 31 - (header % 31);
  
        s.status = BUSY_STATE;
        putShortMSB(s, header);
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 0xffff);
        }
        strm.adler = 1; // adler32(0L, Z_NULL, 0);
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra/* != Z_NULL*/) {
        beg = s.pending;  /* start of bytes to update crc */
  
        while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      }
      else {
        s.status = NAME_STATE;
      }
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name/* != Z_NULL*/) {
        beg = s.pending;  /* start of bytes to update crc */
  
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
  
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      }
      else {
        s.status = COMMENT_STATE;
      }
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment/* != Z_NULL*/) {
        beg = s.pending;  /* start of bytes to update crc */
  
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
  
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      }
      else {
        s.status = HCRC_STATE;
      }
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
        }
        if (s.pending + 2 <= s.pending_buf_size) {
          put_byte(s, strm.adler & 0xff);
          put_byte(s, (strm.adler >> 8) & 0xff);
          strm.adler = 0; //crc32(0L, Z_NULL, 0);
          s.status = BUSY_STATE;
        }
      }
      else {
        s.status = BUSY_STATE;
      }
    }
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK;
      }
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
      flush !== Z_FINISH) {
      return err(strm, Z_BUF_ERROR);
    }
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR);
    }
    if (strm.avail_in !== 0 || s.lookahead !== 0 ||
      (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
      var bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
        (s.strategy === Z_RLE ? deflate_rle(s, flush) :
          configuration_table[s.level].func(s, flush));
  
      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
        }
        return Z_OK;
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH) {
          trees._tr_align(s);
        }
        else if (flush !== Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */
  
          trees._tr_stored_block(s, 0, 0, false);
          if (flush === Z_FULL_FLUSH) {
            zero(s.head); // Fill with NIL (= 0);
  
            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
          return Z_OK;
        }
      }
    }
    //if (strm.avail_out <= 0) { throw new Error("bug2");}
  
    if (flush !== Z_FINISH) { return Z_OK; }
    if (s.wrap <= 0) { return Z_STREAM_END; }
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 0xff);
      put_byte(s, (strm.adler >> 8) & 0xff);
      put_byte(s, (strm.adler >> 16) & 0xff);
      put_byte(s, (strm.adler >> 24) & 0xff);
      put_byte(s, strm.total_in & 0xff);
      put_byte(s, (strm.total_in >> 8) & 0xff);
      put_byte(s, (strm.total_in >> 16) & 0xff);
      put_byte(s, (strm.total_in >> 24) & 0xff);
    }
    else
    {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 0xffff);
    }
  
    flush_pending(strm);
    if (s.wrap > 0) { s.wrap = -s.wrap; }
    return s.pending !== 0 ? Z_OK : Z_STREAM_END;
  }
  
  function deflateEnd(strm) {
    var status;
  
    if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
      return Z_STREAM_ERROR;
    }
  
    status = strm.state.status;
    if (status !== INIT_STATE &&
      status !== EXTRA_STATE &&
      status !== NAME_STATE &&
      status !== COMMENT_STATE &&
      status !== HCRC_STATE &&
      status !== BUSY_STATE &&
      status !== FINISH_STATE
    ) {
      return err(strm, Z_STREAM_ERROR);
    }
  
    strm.state = null;
  
    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
  }
  function deflateSetDictionary(strm, dictionary) {
    var dictLength = dictionary.length;
  
    var s;
    var str, n;
    var wrap;
    var avail;
    var next;
    var input;
    var tmpDict;
  
    if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
      return Z_STREAM_ERROR;
    }
  
    s = strm.state;
    wrap = s.wrap;
  
    if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
      return Z_STREAM_ERROR;
    }
    if (wrap === 1) {
      strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
    }
  
    s.wrap = 0;   /* avoid computing Adler-32 in read_buf */
    if (dictLength >= s.w_size) {
      if (wrap === 0) {            /* already empty otherwise */
        zero(s.head); // Fill with NIL (= 0);
        s.strstart = 0;
        s.block_start = 0;
        s.insert = 0;
      }
      tmpDict = new utils.Buf8(s.w_size);
      utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
      dictionary = tmpDict;
      dictLength = s.w_size;
    }
    avail = strm.avail_in;
    next = strm.next_in;
    input = strm.input;
    strm.avail_in = dictLength;
    strm.next_in = 0;
    strm.input = dictionary;
    fill_window(s);
    while (s.lookahead >= MIN_MATCH) {
      str = s.strstart;
      n = s.lookahead - (MIN_MATCH - 1);
      do {
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
  
        s.prev[str & s.w_mask] = s.head[s.ins_h];
  
        s.head[s.ins_h] = str;
        str++;
      } while (--n);
      s.strstart = str;
      s.lookahead = MIN_MATCH - 1;
      fill_window(s);
    }
    s.strstart += s.lookahead;
    s.block_start = s.strstart;
    s.insert = s.lookahead;
    s.lookahead = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    strm.next_in = next;
    strm.input = input;
    strm.avail_in = avail;
    s.wrap = wrap;
    return Z_OK;
  }
  
  
  exports.deflateInit = deflateInit;
  exports.deflateInit2 = deflateInit2;
  exports.deflateReset = deflateReset;
  exports.deflateResetKeep = deflateResetKeep;
  exports.deflateSetHeader = deflateSetHeader;
  exports.deflate = deflate;
  exports.deflateEnd = deflateEnd;
  exports.deflateSetDictionary = deflateSetDictionary;
  exports.deflateInfo = 'pako deflate (from Nodeca project)';
  },{"../utils/common":41,"./adler32":43,"./crc32":45,"./messages":51,"./trees":52}],47:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  function GZheader() {
    this.text       = 0;
    this.time       = 0;
    this.xflags     = 0;
    this.os         = 0;
    this.extra      = null;
    this.extra_len  = 0; // Actually, we don't need it in JS,
  
    // Setup limits is not necessary because in js we should not preallocate memory
    //
    this.name       = '';
    this.comment    = '';
    this.hcrc       = 0;
    this.done       = false;
  }
  
  module.exports = GZheader;
  
  },{}],48:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  var BAD = 30;       /* got a data error -- remain here until reset */
  var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
  module.exports = function inflate_fast(strm, start) {
    var state;
    var _in;                    /* local strm.input */
    var last;                   /* have enough input while in < last */
    var _out;                   /* local strm.output */
    var beg;                    /* inflate()'s initial strm.output */
    var end;                    /* while out < end, enough space available */
    var dmax;                   /* maximum distance from zlib header */
    var wsize;                  /* window size or zero if not using window */
    var whave;                  /* valid bytes in the window */
    var wnext;                  /* window write index */
    var s_window;               /* allocated sliding window, if wsize != 0 */
    var hold;                   /* local strm.hold */
    var bits;                   /* local strm.bits */
    var lcode;                  /* local strm.lencode */
    var dcode;                  /* local strm.distcode */
    var lmask;                  /* mask for first level of length codes */
    var dmask;                  /* mask for first level of distance codes */
    var here;                   /* retrieved table entry */
    var op;                     /* code bits, operation, extra bits, or */
    var len;                    /* match length, unused bytes */
    var dist;                   /* match distance */
    var from;                   /* where to copy match from */
    var from_source;
  
  
    var input, output; // JS specific, because we have no pointers
    state = strm.state;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    dmax = state.dmax;
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;
    top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
  
      here = lcode[hold & lmask];
  
      dolen:
      for (;;) { // Goto emulation
        op = here >>> 24/*here.bits*/;
        hold >>>= op;
        bits -= op;
        op = (here >>> 16) & 0xff/*here.op*/;
        if (op === 0) {                          /* literal */
          //        "inflate:         literal '%c'\n" :
          output[_out++] = here & 0xffff/*here.val*/;
        }
        else if (op & 16) {                     /* length base */
          len = here & 0xffff/*here.val*/;
          op &= 15;                           /* number of extra bits */
          if (op) {
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
            }
            len += hold & ((1 << op) - 1);
            hold >>>= op;
            bits -= op;
          }
          if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
          }
          here = dcode[hold & dmask];
  
          dodist:
          for (;;) { // goto emulation
            op = here >>> 24/*here.bits*/;
            hold >>>= op;
            bits -= op;
            op = (here >>> 16) & 0xff/*here.op*/;
  
            if (op & 16) {                      /* distance base */
              dist = here & 0xffff/*here.val*/;
              op &= 15;                       /* number of extra bits */
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
              }
              dist += hold & ((1 << op) - 1);
              if (dist > dmax) {
                strm.msg = 'invalid distance too far back';
                state.mode = BAD;
                break top;
              }
              hold >>>= op;
              bits -= op;
              op = _out - beg;                /* max distance in output */
              if (dist > op) {                /* see if copy from window */
                op = dist - op;               /* distance back in window */
                if (op > whave) {
                  if (state.sane) {
                    strm.msg = 'invalid distance too far back';
                    state.mode = BAD;
                    break top;
                  }
  // don't enable it for binary compatibility
  //                if (len <= op - whave) {
  //                    output[_out++] = 0;
  //                  continue top;
  //                len -= op - whave;
  //                  output[_out++] = 0;
  //                if (op === 0) {
  //                  do {
  //                  } while (--len);
  //                }
                }
                from = 0; // window index
                from_source = s_window;
                if (wnext === 0) {           /* very common case */
                  from += wsize - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                else if (wnext < op) {      /* wrap around window */
                  from += wsize + wnext - op;
                  op -= wnext;
                  if (op < len) {         /* some from end of window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = 0;
                    if (wnext < len) {  /* some from start of window */
                      op = wnext;
                      len -= op;
                      do {
                        output[_out++] = s_window[from++];
                      } while (--op);
                      from = _out - dist;      /* rest from output */
                      from_source = output;
                    }
                  }
                }
                else {                      /* contiguous in window */
                  from += wnext - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                while (len > 2) {
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  len -= 3;
                }
                if (len) {
                  output[_out++] = from_source[from++];
                  if (len > 1) {
                    output[_out++] = from_source[from++];
                  }
                }
              }
              else {
                from = _out - dist;          /* copy direct from output */
                do {                        /* minimum length is three */
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  len -= 3;
                } while (len > 2);
                if (len) {
                  output[_out++] = output[from++];
                  if (len > 1) {
                    output[_out++] = output[from++];
                  }
                }
              }
            }
            else if ((op & 64) === 0) {          /* 2nd level distance code */
              here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
              continue dodist;
            }
            else {
              strm.msg = 'invalid distance code';
              state.mode = BAD;
              break top;
            }
  
            break; // need to emulate goto via "continue"
          }
        }
        else if ((op & 64) === 0) {              /* 2nd level length code */
          here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
          continue dolen;
        }
        else if (op & 32) {                     /* end-of-block */
          state.mode = TYPE;
          break top;
        }
        else {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break top;
        }
  
        break; // need to emulate goto via "continue"
      }
    } while (_in < last && _out < end);
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
    strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
    state.hold = hold;
    state.bits = bits;
    return;
  };
  
  },{}],49:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  var utils         = require('../utils/common');
  var adler32       = require('./adler32');
  var crc32         = require('./crc32');
  var inflate_fast  = require('./inffast');
  var inflate_table = require('./inftrees');
  
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  /* ===========================================================================*/
  //var Z_PARTIAL_FLUSH = 1;
  //var Z_FULL_FLUSH    = 3;
  var Z_FINISH        = 4;
  var Z_BLOCK         = 5;
  var Z_TREES         = 6;
  var Z_OK            = 0;
  var Z_STREAM_END    = 1;
  var Z_NEED_DICT     = 2;
  var Z_STREAM_ERROR  = -2;
  var Z_DATA_ERROR    = -3;
  var Z_MEM_ERROR     = -4;
  var Z_BUF_ERROR     = -5;
  var Z_DEFLATED  = 8;
  /* ===========================================================================*/
  
  
  var    HEAD = 1;       /* i: waiting for magic header */
  var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
  var    TIME = 3;       /* i: waiting for modification time (gzip) */
  var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
  var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
  var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
  var    NAME = 7;       /* i: waiting for end of file name (gzip) */
  var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
  var    HCRC = 9;       /* i: waiting for header crc (gzip) */
  var    DICTID = 10;    /* i: waiting for dictionary check value */
  var    DICT = 11;      /* waiting for inflateSetDictionary() call */
  var        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
  var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
  var        STORED = 14;    /* i: waiting for stored size (length and complement) */
  var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
  var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
  var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
  var        LENLENS = 18;   /* i: waiting for code length code lengths */
  var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
  var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
  var            LEN = 21;       /* i: waiting for length/lit/eob code */
  var            LENEXT = 22;    /* i: waiting for length extra bits */
  var            DIST = 23;      /* i: waiting for distance code */
  var            DISTEXT = 24;   /* i: waiting for distance extra bits */
  var            MATCH = 25;     /* o: waiting for output space to copy string */
  var            LIT = 26;       /* o: waiting for output space to write literal */
  var    CHECK = 27;     /* i: waiting for 32-bit check value */
  var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
  var    DONE = 29;      /* finished check, done -- remain here until reset */
  var    BAD = 30;       /* got a data error -- remain here until reset */
  var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
  var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  
  var MAX_WBITS = 15;
  var DEF_WBITS = MAX_WBITS;
  
  
  function zswap32(q) {
    return  (((q >>> 24) & 0xff) +
            ((q >>> 8) & 0xff00) +
            ((q & 0xff00) << 8) +
            ((q & 0xff) << 24));
  }
  
  
  function InflateState() {
    this.mode = 0;             /* current inflate mode */
    this.last = false;          /* true if processing last block */
    this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
    this.havedict = false;      /* true if dictionary provided */
    this.flags = 0;             /* gzip header method and flags (0 if zlib) */
    this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
    this.check = 0;             /* protected copy of check value */
    this.total = 0;             /* protected copy of output count */
    this.head = null;           /* where to save gzip header information */
    this.wbits = 0;             /* log base 2 of requested window size */
    this.wsize = 0;             /* window size or zero if not using window */
    this.whave = 0;             /* valid bytes in the window */
    this.wnext = 0;             /* window write index */
    this.window = null;         /* allocated sliding window, if needed */
    this.hold = 0;              /* input bit accumulator */
    this.bits = 0;              /* number of bits in "in" */
    this.length = 0;            /* literal or length of data to copy */
    this.offset = 0;            /* distance back to copy string from */
    this.extra = 0;             /* extra bits needed */
    this.lencode = null;          /* starting table for length/literal codes */
    this.distcode = null;         /* starting table for distance codes */
    this.lenbits = 0;           /* index bits for lencode */
    this.distbits = 0;          /* index bits for distcode */
    this.ncode = 0;             /* number of code length code lengths */
    this.nlen = 0;              /* number of length code lengths */
    this.ndist = 0;             /* number of distance code lengths */
    this.have = 0;              /* number of code lengths in lens[] */
    this.next = null;              /* next available space in codes[] */
  
    this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
    this.work = new utils.Buf16(288); /* work area for code table building */
    this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
    this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
    this.sane = 0;                   /* if false, allow invalid distance too far */
    this.back = 0;                   /* bits back of last unprocessed length/lit */
    this.was = 0;                    /* initial length of match */
  }
  
  function inflateResetKeep(strm) {
    var state;
  
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = ''; /*Z_NULL*/
    if (state.wrap) {       /* to support ill-conceived Java test suite */
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null/*Z_NULL*/;
    state.hold = 0;
    state.bits = 0;
    state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
    state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
  
    state.sane = 1;
    state.back = -1;
    return Z_OK;
  }
  
  function inflateReset(strm) {
    var state;
  
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);
  
  }
  
  function inflateReset2(strm, windowBits) {
    var wrap;
    var state;
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    }
    else {
      wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  }
  
  function inflateInit2(strm, windowBits) {
    var ret;
    var state;
  
    if (!strm) { return Z_STREAM_ERROR; }
  
    state = new InflateState();
    //Tracev((stderr, "inflate: allocated\n"));
    strm.state = state;
    state.window = null/*Z_NULL*/;
    ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK) {
      strm.state = null/*Z_NULL*/;
    }
    return ret;
  }
  
  function inflateInit(strm) {
    return inflateInit2(strm, DEF_WBITS);
  }
  var virgin = true;
  
  var lenfix, distfix; // We have no pointers in JS, so keep tables separate
  
  function fixedtables(state) {
    if (virgin) {
      var sym;
  
      lenfix = new utils.Buf32(512);
      distfix = new utils.Buf32(32);
      sym = 0;
      while (sym < 144) { state.lens[sym++] = 8; }
      while (sym < 256) { state.lens[sym++] = 9; }
      while (sym < 280) { state.lens[sym++] = 7; }
      while (sym < 288) { state.lens[sym++] = 8; }
  
      inflate_table(LENS,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });
      sym = 0;
      while (sym < 32) { state.lens[sym++] = 5; }
  
      inflate_table(DISTS, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });
      virgin = false;
    }
  
    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  }
  function updatewindow(strm, src, end, copy) {
    var dist;
    var state = strm.state;
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;
  
      state.window = new utils.Buf8(state.wsize);
    }
    if (copy >= state.wsize) {
      utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
      state.wnext = 0;
      state.whave = state.wsize;
    }
    else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      utils.arraySet(state.window, src, end - copy, dist, state.wnext);
      copy -= dist;
      if (copy) {
        utils.arraySet(state.window, src, end - copy, copy, 0);
        state.wnext = copy;
        state.whave = state.wsize;
      }
      else {
        state.wnext += dist;
        if (state.wnext === state.wsize) { state.wnext = 0; }
        if (state.whave < state.wsize) { state.whave += dist; }
      }
    }
    return 0;
  }
  
  function inflate(strm, flush) {
    var state;
    var input, output;          // input/output buffers
    var next;                   /* next input INDEX */
    var put;                    /* next output INDEX */
    var have, left;             /* available input and output */
    var hold;                   /* bit buffer */
    var bits;                   /* bits in bit buffer */
    var _in, _out;              /* save starting available input and output */
    var copy;                   /* number of stored or match bytes to copy */
    var from;                   /* where to copy match bytes from */
    var from_source;
    var here = 0;               /* current decoding table entry */
    var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
    var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
    var len;                    /* length to copy for repeats, bits to drop */
    var ret;                    /* return code */
    var hbuf = new utils.Buf8(4);    /* buffer for gzip header crc calculation */
    var opts;
  
    var n; // temporary var for NEED_BITS
  
    var order = /* permutation of code lengths */
      [ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ];
  
  
    if (!strm || !strm.state || !strm.output ||
        (!strm.input && strm.avail_in !== 0)) {
      return Z_STREAM_ERROR;
    }
  
    state = strm.state;
    if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
  
    _in = have;
    _out = left;
    ret = Z_OK;
  
    inf_leave: // goto emulation
    for (;;) {
      switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
          state.check = 0/*crc32(0L, Z_NULL, 0)*/;
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
  
          hold = 0;
          bits = 0;
          state.mode = FLAGS;
          break;
        }
        state.flags = 0;           /* expect zlib header */
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) ||   /* check if zlib header allowed */
          (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        hold >>>= 4;
        bits -= 4;
        len = (hold & 0x0f)/*BITS(4)*/ + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        else if (len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }
        state.dmax = 1 << len;
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        hold = 0;
        bits = 0;
        break;
      case FLAGS:
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = ((hold >> 8) & 1);
        }
        if (state.flags & 0x0200) {
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = TIME;
      case TIME:
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 0x0200) {
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          hbuf[2] = (hold >>> 16) & 0xff;
          hbuf[3] = (hold >>> 24) & 0xff;
          state.check = crc32(state.check, hbuf, 4, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = OS;
      case OS:
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (state.head) {
          state.head.xflags = (hold & 0xff);
          state.head.os = (hold >> 8);
        }
        if (state.flags & 0x0200) {
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
        state.mode = EXLEN;
      case EXLEN:
        if (state.flags & 0x0400) {
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 0x0200) {
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
        }
        else if (state.head) {
          state.head.extra = null/*Z_NULL*/;
        }
        state.mode = EXTRA;
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) { copy = have; }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                state.head.extra = new Array(state.head.extra_len);
              }
              utils.arraySet(
                state.head.extra,
                input,
                next,
                // - no need for additional size check
                copy,
                len
              );
              //        len + copy > state.head.extra_max ?
            }
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) { break inf_leave; }
        }
        state.length = 0;
        state.mode = NAME;
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/)) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);
  
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/)) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
      case HCRC:
        if (state.flags & 0x0200) {
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
        }
        if (state.head) {
          state.head.hcrc = ((state.flags >> 9) & 1);
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        strm.adler = state.check = zswap32(hold);
        hold = 0;
        bits = 0;
        state.mode = DICT;
      case DICT:
        if (state.havedict === 0) {
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          return Z_NEED_DICT;
        }
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
      case TYPEDO:
        if (state.last) {
          hold >>>= bits & 7;
          bits -= bits & 7;
          state.mode = CHECK;
          break;
        }
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.last = (hold & 0x01)/*BITS(1)*/;
        hold >>>= 1;
        bits -= 1;
  
        switch ((hold & 0x03)/*BITS(2)*/) {
        case 0:                             /* stored block */
          //        state.last ? " (last)" : ""));
          state.mode = STORED;
          break;
        case 1:                             /* fixed block */
          fixedtables(state);
          //        state.last ? " (last)" : ""));
          state.mode = LEN_;             /* decode codes */
          if (flush === Z_TREES) {
            hold >>>= 2;
            bits -= 2;
            break inf_leave;
          }
          break;
        case 2:                             /* dynamic block */
          //        state.last ? " (last)" : ""));
          state.mode = TABLE;
          break;
        case 3:
          strm.msg = 'invalid block type';
          state.mode = BAD;
        }
        hold >>>= 2;
        bits -= 2;
        break;
      case STORED:
        hold >>>= bits & 7;
        bits -= bits & 7;
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //        state.length));
        hold = 0;
        bits = 0;
        state.mode = COPY_;
        if (flush === Z_TREES) { break inf_leave; }
      case COPY_:
        state.mode = COPY;
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) { copy = have; }
          if (copy > left) { copy = left; }
          if (copy === 0) { break inf_leave; }
          utils.arraySet(output, input, next, copy, put);
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        state.mode = TYPE;
        break;
      case TABLE:
        while (bits < 14) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
        hold >>>= 5;
        bits -= 5;
        state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
        hold >>>= 5;
        bits -= 5;
        state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
        hold >>>= 4;
        bits -= 4;
  //#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
      case LENLENS:
        while (state.have < state.ncode) {
          while (bits < 3) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
          hold >>>= 3;
          bits -= 3;
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        //state.next = state.codes;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;
  
        opts = { bits: state.lenbits };
        ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;
  
        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        state.have = 0;
        state.mode = CODELENS;
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;
  
            if ((here_bits) <= bits) { break; }
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_val < 16) {
            hold >>>= here_bits;
            bits -= here_bits;
            state.lens[state.have++] = here_val;
          }
          else {
            if (here_val === 16) {
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03);//BITS(2);
              hold >>>= 2;
              bits -= 2;
            }
            else if (here_val === 17) {
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              len = 0;
              copy = 3 + (hold & 0x07);//BITS(3);
              hold >>>= 3;
              bits -= 3;
            }
            else {
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              len = 0;
              copy = 11 + (hold & 0x7f);//BITS(7);
              hold >>>= 7;
              bits -= 7;
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }
        if (state.mode === BAD) { break; }
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }
        state.lenbits = 9;
  
        opts = { bits: state.lenbits };
        ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
  
        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }
  
        state.distbits = 6;
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
  
        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        state.mode = LEN_;
        if (flush === Z_TREES) { break inf_leave; }
      case LEN_:
        state.mode = LEN;
      case LEN:
        if (have >= 6 && left >= 258) {
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          inflate_fast(strm, _out);
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
  
          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;
  
          if (here_bits <= bits) { break; }
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;
  
            if ((last_bits + here_bits) <= bits) { break; }
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          hold >>>= last_bits;
          bits -= last_bits;
          state.back += last_bits;
        }
        hold >>>= here_bits;
        bits -= here_bits;
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //        "inflate:         literal '%c'\n" :
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
      case LENEXT:
        if (state.extra) {
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          hold >>>= state.extra;
          bits -= state.extra;
          state.back += state.extra;
        }
        state.was = state.length;
        state.mode = DIST;
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;
  
          if ((here_bits) <= bits) { break; }
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;
  
            if ((last_bits + here_bits) <= bits) { break; }
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          hold >>>= last_bits;
          bits -= last_bits;
          state.back += last_bits;
        }
        hold >>>= here_bits;
        bits -= here_bits;
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = (here_op) & 15;
        state.mode = DISTEXT;
      case DISTEXT:
        if (state.extra) {
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          hold >>>= state.extra;
          bits -= state.extra;
          state.back += state.extra;
        }
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
      case MATCH:
        if (left === 0) { break inf_leave; }
        copy = _out - left;
        if (state.offset > copy) {         /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
  // don't enable it for binary compatibility
  //          Trace((stderr, "inflate.c too far\n"));
  //          if (copy > state.length) { copy = state.length; }
  //          left -= copy;
  //          do {
  //          } while (--copy);
  //          break;
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          }
          else {
            from = state.wnext - copy;
          }
          if (copy > state.length) { copy = state.length; }
          from_source = state.window;
        }
        else {                              /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) { copy = left; }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) { state.mode = LEN; }
        break;
      case LIT:
        if (left === 0) { break inf_leave; }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold |= input[next++] << bits;
            bits += 8;
          }
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (_out) {
            strm.adler = state.check =
                (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));
  
          }
          _out = left;
          if ((state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH;
      case LENGTH:
        if (state.wrap && state.flags) {
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          hold = 0;
          bits = 0;
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
      case DONE:
        ret = Z_STREAM_END;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR;
      case SYNC:
      default:
        return Z_STREAM_ERROR;
      }
    }
    //--- RESTORE() ---
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
  
    if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                        (state.mode < CHECK || flush !== Z_FINISH))) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
        state.mode = MEM;
        return Z_MEM_ERROR;
      }
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
      strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) +
                      (state.mode === TYPE ? 128 : 0) +
                      (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
      ret = Z_BUF_ERROR;
    }
    return ret;
  }
  
  function inflateEnd(strm) {
  
    if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
      return Z_STREAM_ERROR;
    }
  
    var state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK;
  }
  
  function inflateGetHeader(strm, head) {
    var state;
    if (!strm || !strm.state) { return Z_STREAM_ERROR; }
    state = strm.state;
    if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }
    state.head = head;
    head.done = false;
    return Z_OK;
  }
  
  function inflateSetDictionary(strm, dictionary) {
    var dictLength = dictionary.length;
  
    var state;
    var dictid;
    var ret;
    if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) { return Z_STREAM_ERROR; }
    state = strm.state;
  
    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR;
    }
    if (state.mode === DICT) {
      dictid = 1; /* adler32(0, null, 0)*/
      dictid = adler32(dictid, dictionary, dictLength, 0);
      if (dictid !== state.check) {
        return Z_DATA_ERROR;
      }
    }
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
    state.havedict = 1;
    return Z_OK;
  }
  
  exports.inflateReset = inflateReset;
  exports.inflateReset2 = inflateReset2;
  exports.inflateResetKeep = inflateResetKeep;
  exports.inflateInit = inflateInit;
  exports.inflateInit2 = inflateInit2;
  exports.inflate = inflate;
  exports.inflateEnd = inflateEnd;
  exports.inflateGetHeader = inflateGetHeader;
  exports.inflateSetDictionary = inflateSetDictionary;
  exports.inflateInfo = 'pako inflate (from Nodeca project)';
  },{"../utils/common":41,"./adler32":43,"./crc32":45,"./inffast":48,"./inftrees":50}],50:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  var utils = require('../utils/common');
  
  var MAXBITS = 15;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  
  var lbase = [ /* Length codes 257..285 base */
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
  ];
  
  var lext = [ /* Length codes 257..285 extra */
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
    19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
  ];
  
  var dbase = [ /* Distance codes 0..29 base */
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577, 0, 0
  ];
  
  var dext = [ /* Distance codes 0..29 extra */
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
    23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
    28, 28, 29, 29, 64, 64
  ];
  
  module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
  {
    var bits = opts.bits;
  
    var len = 0;               /* a code's length in bits */
    var sym = 0;               /* index of code symbols */
    var min = 0, max = 0;          /* minimum and maximum code lengths */
    var root = 0;              /* number of index bits for root table */
    var curr = 0;              /* number of index bits for current table */
    var drop = 0;              /* code bits to drop for sub-table */
    var left = 0;                   /* number of prefix codes available */
    var used = 0;              /* code entries in table used */
    var huff = 0;              /* Huffman code */
    var incr;              /* for incrementing code, index */
    var fill;              /* index for replicating entries */
    var low;               /* low bits for current root entry */
    var mask;              /* mask for low root bits */
    var next;             /* next available space in table */
    var base = null;     /* base value table to use */
    var base_index = 0;
    var end;                    /* use base and extra for symbol > end */
    var count = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
    var offs = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
    var extra = null;
    var extra_index = 0;
  
    var here_bits, here_op, here_val;
    /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) { break; }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) {                     /* no symbols to code at all */
      //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;
      //table.bits[opts.table_index] = 1;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;
  
      opts.bits = 1;
      return 0;     /* no symbols, but wait for decoding to report error */
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) { break; }
    }
    if (root < min) {
      root = min;
    }
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        return -1;
      }        /* over-subscribed */
    }
    if (left > 0 && (type === CODES || max !== 1)) {
      return -1;                      /* incomplete set */
    }
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len];
    }
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }
    /* set up for code type */
    // to avoid deopts in old v8
    if (type === CODES) {
      base = extra = work;    /* dummy value--not used */
      end = 19;
  
    } else if (type === LENS) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;
  
    } else {                    /* DISTS */
      base = dbase;
      extra = dext;
      end = -1;
    }
    huff = 0;                   /* starting code */
    sym = 0;                    /* starting code symbol */
    len = min;                  /* starting code length */
    next = table_index;              /* current table to fill in */
    curr = root;                /* current table index bits */
    drop = 0;                   /* current bits to drop from code for index */
    low = -1;                   /* trigger new sub-table when len > root */
    used = 1 << root;          /* use root table entries */
    mask = used - 1;            /* mask for comparing low */
    if ((type === LENS && used > ENOUGH_LENS) ||
      (type === DISTS && used > ENOUGH_DISTS)) {
      return 1;
    }
    for (;;) {
      here_bits = len - drop;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      }
      else if (work[sym] > end) {
        here_op = extra[extra_index + work[sym]];
        here_val = base[base_index + work[sym]];
      }
      else {
        here_op = 32 + 64;         /* end of block */
        here_val = 0;
      }
      incr = 1 << (len - drop);
      fill = 1 << curr;
      min = fill;                 /* save offset to next table */
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
      } while (fill !== 0);
      incr = 1 << (len - 1);
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }
      sym++;
      if (--count[len] === 0) {
        if (len === max) { break; }
        len = lens[lens_index + work[sym]];
      }
      if (len > root && (huff & mask) !== low) {
        if (drop === 0) {
          drop = root;
        }
        next += min;            /* here min is 1 << curr */
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) { break; }
          curr++;
          left <<= 1;
        }
        used += 1 << curr;
        if ((type === LENS && used > ENOUGH_LENS) ||
          (type === DISTS && used > ENOUGH_DISTS)) {
          return 1;
        }
        low = huff & mask;
        table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
      }
    }
    if (huff !== 0) {
      //table.bits[next + huff] = len - drop;
      table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
    }
    opts.bits = root;
    return 0;
  };
  
  },{"../utils/common":41}],51:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  module.exports = {
    2:      'need dictionary',     /* Z_NEED_DICT       2  */
    1:      'stream end',          /* Z_STREAM_END      1  */
    0:      '',                    /* Z_OK              0  */
    '-1':   'file error',          /* Z_ERRNO         (-1) */
    '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
    '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
    '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
    '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
    '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
  };
  
  },{}],52:[function(require,module,exports){
  'use strict';
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  // This software is provided 'as-is', without any express or implied
  // arising from the use of this software.
  // Permission is granted to anyone to use this software for any purpose,
  // freely, subject to the following restrictions:
  // 1. The origin of this software must not be misrepresented; you must not
  //   in a product, an acknowledgment in the product documentation would be
  // 2. Altered source versions must be plainly marked as such, and must not be
  // 3. This notice may not be removed or altered from any source distribution.
  
  var utils = require('../utils/common');
  /* ===========================================================================*/
  //var Z_HUFFMAN_ONLY      = 2;
  var Z_FIXED               = 4;
  var Z_BINARY              = 0;
  var Z_TEXT                = 1;
  var Z_UNKNOWN             = 2;
  function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }
  
  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES    = 2;
  var MIN_MATCH    = 3;
  var MAX_MATCH    = 258;
  var LENGTH_CODES  = 29;
  var LITERALS      = 256;
  var L_CODES       = LITERALS + 1 + LENGTH_CODES;
  var D_CODES       = 30;
  var BL_CODES      = 19;
  var HEAP_SIZE     = 2 * L_CODES + 1;
  var MAX_BITS      = 15;
  var Buf_size      = 16;
  /* ===========================================================================
   * Constants
   */
  
  var MAX_BL_BITS = 7;
  var END_BLOCK   = 256;
  var REP_3_6     = 16;
  var REPZ_3_10   = 17;
  var REPZ_11_138 = 18;
  /* eslint-disable comma-spacing,array-bracket-spacing */
  var extra_lbits =   /* extra bits for each length code */
    [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  
  var extra_dbits =   /* extra bits for each distance code */
    [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  
  var extra_blbits =  /* extra bits for each bit length code */
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];
  
  var bl_order =
    [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  /* The lengths of the bit length codes are sent in order of decreasing
   * probability, to avoid transmitting the lengths for unused bit length codes.
   */
  
  var DIST_CODE_LEN = 512; /* see definition of array dist_code below */
  var static_ltree  = new Array((L_CODES + 2) * 2);
  zero(static_ltree);
  var static_dtree  = new Array(D_CODES * 2);
  zero(static_dtree);
  var _dist_code    = new Array(DIST_CODE_LEN);
  zero(_dist_code);
  var _length_code  = new Array(MAX_MATCH - MIN_MATCH + 1);
  zero(_length_code);
  var base_length   = new Array(LENGTH_CODES);
  zero(base_length);
  var base_dist     = new Array(D_CODES);
  zero(base_dist);
  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  
    this.static_tree  = static_tree;  /* static tree or NULL */
    this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
    this.extra_base   = extra_base;   /* base index for extra_bits */
    this.elems        = elems;        /* max number of elements in the tree */
    this.max_length   = max_length;   /* max bit length for the codes */
    this.has_stree    = static_tree && static_tree.length;
  }
  
  
  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;
  
  
  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;     /* the dynamic tree */
    this.max_code = 0;            /* largest code with non zero frequency */
    this.stat_desc = stat_desc;   /* the corresponding static tree */
  }
  
  
  
  function d_code(dist) {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  }
  function put_short(s, w) {
  //    put_byte(s, (uch)((ush)(w) >> 8));
    s.pending_buf[s.pending++] = (w) & 0xff;
    s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
  }
  function send_bits(s, value, length) {
    if (s.bi_valid > (Buf_size - length)) {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> (Buf_size - s.bi_valid);
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      s.bi_valid += length;
    }
  }
  
  
  function send_code(s, c, tree) {
    send_bits(s, tree[c * 2]/*.Code*/, tree[c * 2 + 1]/*.Len*/);
  }
  function bi_reverse(code, len) {
    var res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  }
  function bi_flush(s) {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;
  
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 0xff;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  }
  function gen_bitlen(s, desc)
  //    tree_desc *desc;    /* the tree descriptor */
  {
    var tree            = desc.dyn_tree;
    var max_code        = desc.max_code;
    var stree           = desc.stat_desc.static_tree;
    var has_stree       = desc.stat_desc.has_stree;
    var extra           = desc.stat_desc.extra_bits;
    var base            = desc.stat_desc.extra_base;
    var max_length      = desc.stat_desc.max_length;
    var h;              /* heap index */
    var n, m;           /* iterate over the tree elements */
    var bits;           /* bit length */
    var xbits;          /* extra bits */
    var f;              /* frequency */
    var overflow = 0;   /* number of elements with bit length too large */
  
    for (bits = 0; bits <= MAX_BITS; bits++) {
      s.bl_count[bits] = 0;
    }
    tree[s.heap[s.heap_max] * 2 + 1]/*.Len*/ = 0; /* root of the heap */
  
    for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
      n = s.heap[h];
      bits = tree[tree[n * 2 + 1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n * 2 + 1]/*.Len*/ = bits;
      if (n > max_code) { continue; } /* not a leaf node */
  
      s.bl_count[bits]++;
      xbits = 0;
      if (n >= base) {
        xbits = extra[n - base];
      }
      f = tree[n * 2]/*.Freq*/;
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1]/*.Len*/ + xbits);
      }
    }
    if (overflow === 0) { return; }
    /* Find the first bit length which could increase: */
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) { bits--; }
      s.bl_count[bits]--;      /* move one leaf down the tree */
      s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
      s.bl_count[max_length]--;
      overflow -= 2;
    } while (overflow > 0);
    for (bits = max_length; bits !== 0; bits--) {
      n = s.bl_count[bits];
      while (n !== 0) {
        m = s.heap[--h];
        if (m > max_code) { continue; }
        if (tree[m * 2 + 1]/*.Len*/ !== bits) {
          s.opt_len += (bits - tree[m * 2 + 1]/*.Len*/) * tree[m * 2]/*.Freq*/;
          tree[m * 2 + 1]/*.Len*/ = bits;
        }
        n--;
      }
    }
  }
  function gen_codes(tree, max_code, bl_count)
  //    int max_code;              /* largest code with non zero frequency */
  {
    var next_code = new Array(MAX_BITS + 1); /* next code value for each bit length */
    var code = 0;              /* running code value */
    var bits;                  /* bit index */
    var n;                     /* code index */
    for (bits = 1; bits <= MAX_BITS; bits++) {
      next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
    }
    //        "inconsistent bit counts");
  
    for (n = 0;  n <= max_code; n++) {
      var len = tree[n * 2 + 1]/*.Len*/;
      if (len === 0) { continue; }
      tree[n * 2]/*.Code*/ = bi_reverse(next_code[len]++, len);
      //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
    }
  }
  function tr_static_init() {
    var n;        /* iterates over tree elements */
    var bits;     /* bit counter */
    var length;   /* length value */
    var code;     /* code value */
    var dist;     /* distance index */
    var bl_count = new Array(MAX_BITS + 1);
    //if (static_init_done) return;
  /*#ifdef NO_INIT_GLOBAL_POINTERS
    static_l_desc.static_tree = static_ltree;
    static_l_desc.extra_bits = extra_lbits;
    static_d_desc.static_tree = static_dtree;
    static_d_desc.extra_bits = extra_dbits;
    static_bl_desc.extra_bits = extra_blbits;
  #endif*/
    length = 0;
    for (code = 0; code < LENGTH_CODES - 1; code++) {
      base_length[code] = length;
      for (n = 0; n < (1 << extra_lbits[code]); n++) {
        _length_code[length++] = code;
      }
    }
    _length_code[length - 1] = code;
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n = 0; n < (1 << extra_dbits[code]); n++) {
        _dist_code[dist++] = code;
      }
    }
    dist >>= 7; /* from now on, all distances are divided by 128 */
    for (; code < D_CODES; code++) {
      base_dist[code] = dist << 7;
      for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
        _dist_code[256 + dist++] = code;
      }
    }
    for (bits = 0; bits <= MAX_BITS; bits++) {
      bl_count[bits] = 0;
    }
  
    n = 0;
    while (n <= 143) {
      static_ltree[n * 2 + 1]/*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1]/*.Len*/ = 9;
      n++;
      bl_count[9]++;
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1]/*.Len*/ = 7;
      n++;
      bl_count[7]++;
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1]/*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    gen_codes(static_ltree, L_CODES + 1, bl_count);
    for (n = 0; n < D_CODES; n++) {
      static_dtree[n * 2 + 1]/*.Len*/ = 5;
      static_dtree[n * 2]/*.Code*/ = bi_reverse(n, 5);
    }
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES, MAX_BITS);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES, MAX_BL_BITS);
  }
  function init_block(s) {
    var n; /* iterates over tree elements */
    for (n = 0; n < L_CODES;  n++) { s.dyn_ltree[n * 2]/*.Freq*/ = 0; }
    for (n = 0; n < D_CODES;  n++) { s.dyn_dtree[n * 2]/*.Freq*/ = 0; }
    for (n = 0; n < BL_CODES; n++) { s.bl_tree[n * 2]/*.Freq*/ = 0; }
  
    s.dyn_ltree[END_BLOCK * 2]/*.Freq*/ = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
  }
  function bi_windup(s)
  {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  }
  function copy_block(s, buf, len, header)
  //charf    *buf;    /* the input data */
  //int      header;  /* true if block header must be written */
  {
    bi_windup(s);        /* align on byte boundary */
  
    if (header) {
      put_short(s, len);
      put_short(s, ~len);
    }
  //    put_byte(s, *buf++);
    utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
    s.pending += len;
  }
  function smaller(tree, n, m, depth) {
    var _n2 = n * 2;
    var _m2 = m * 2;
    return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
           (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
  }
  function pqdownheap(s, tree, k)
  //    ct_data *tree;  /* the tree to restore */
  {
    var v = s.heap[k];
    var j = k << 1;  /* left son of k */
    while (j <= s.heap_len) {
      if (j < s.heap_len &&
        smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      if (smaller(tree, v, s.heap[j], s.depth)) { break; }
      s.heap[k] = s.heap[j];
      k = j;
      j <<= 1;
    }
    s.heap[k] = v;
  }
  // var SMALLEST = 1;
  function compress_block(s, ltree, dtree)
  //    const ct_data *ltree; /* literal tree */
  {
    var dist;           /* distance of matched string */
    var lc;             /* match length or unmatched char (if dist == 0) */
    var lx = 0;         /* running index in l_buf */
    var code;           /* the code to send */
    var extra;          /* number of extra bits to send */
  
    if (s.last_lit !== 0) {
      do {
        dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
        lc = s.pending_buf[s.l_buf + lx];
        lx++;
  
        if (dist === 0) {
          send_code(s, lc, ltree); /* send a literal byte */
        } else {
          code = _length_code[lc];
          send_code(s, code + LITERALS + 1, ltree); /* send the length code */
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra);       /* send the extra length bits */
          }
          dist--; /* dist is now the match distance - 1 */
          code = d_code(dist);
  
          send_code(s, code, dtree);       /* send the distance code */
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra);   /* send the extra distance bits */
          }
        } /* literal or match pair ? */
        //       "pendingBuf overflow");
  
      } while (lx < s.last_lit);
    }
  
    send_code(s, END_BLOCK, ltree);
  }
  function build_tree(s, desc)
  //    tree_desc *desc; /* the tree descriptor */
  {
    var tree     = desc.dyn_tree;
    var stree    = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var elems    = desc.stat_desc.elems;
    var n, m;          /* iterate over heap elements */
    var max_code = -1; /* largest code with non zero frequency */
    var node;          /* new node being created */
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE;
  
    for (n = 0; n < elems; n++) {
      if (tree[n * 2]/*.Freq*/ !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;
  
      } else {
        tree[n * 2 + 1]/*.Len*/ = 0;
      }
    }
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
      tree[node * 2]/*.Freq*/ = 1;
      s.depth[node] = 0;
      s.opt_len--;
  
      if (has_stree) {
        s.static_len -= stree[node * 2 + 1]/*.Len*/;
      }
    }
    desc.max_code = max_code;
    for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }
    node = elems;              /* next internal node of the tree */
    do {
      n = s.heap[1/*SMALLEST*/];
      s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
      pqdownheap(s, tree, 1/*SMALLEST*/);
      m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */
  
      s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
      s.heap[--s.heap_max] = m;
      tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
      tree[n * 2 + 1]/*.Dad*/ = tree[m * 2 + 1]/*.Dad*/ = node;
      s.heap[1/*SMALLEST*/] = node++;
      pqdownheap(s, tree, 1/*SMALLEST*/);
  
    } while (s.heap_len >= 2);
  
    s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];
    gen_bitlen(s, desc);
    gen_codes(tree, max_code, s.bl_count);
  }
  function scan_tree(s, tree, max_code)
  //    ct_data *tree;   /* the tree to be scanned */
  {
    var n;                     /* iterates over all tree elements */
    var prevlen = -1;          /* last emitted length */
    var curlen;                /* length of current code */
  
    var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */
  
    var count = 0;             /* repeat count of the current code */
    var max_count = 7;         /* max repeat count */
    var min_count = 4;         /* min repeat count */
  
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1]/*.Len*/ = 0xffff; /* guard */
  
    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;
  
      if (++count < max_count && curlen === nextlen) {
        continue;
  
      } else if (count < min_count) {
        s.bl_tree[curlen * 2]/*.Freq*/ += count;
  
      } else if (curlen !== 0) {
  
        if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
        s.bl_tree[REP_3_6 * 2]/*.Freq*/++;
  
      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2]/*.Freq*/++;
  
      } else {
        s.bl_tree[REPZ_11_138 * 2]/*.Freq*/++;
      }
  
      count = 0;
      prevlen = curlen;
  
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
  
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
  
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }

  function send_tree(s, tree, max_code)
  //    ct_data *tree; /* the tree to be scanned */
  {
    var n;                     /* iterates over all tree elements */
    var prevlen = -1;          /* last emitted length */
    var curlen;                /* length of current code */
  
    var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */
  
    var count = 0;             /* repeat count of the current code */
    var max_count = 7;         /* max repeat count */
    var min_count = 4;         /* min repeat count */
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
  
    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;
  
      if (++count < max_count && curlen === nextlen) {
        continue;
  
      } else if (count < min_count) {
        do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);
  
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);
  
      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);
  
      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }
  
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
  
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
  
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }

  function build_bl_tree(s) {
    var max_blindex;  /* index of last bit length code of non zero freq */
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
    build_tree(s, s.bl_desc);

    for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1]/*.Len*/ !== 0) {
        break;
      }
    }
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    //        s->opt_len, s->static_len));
  
    return max_blindex;
  }
  

  function send_all_trees(s, lcodes, dcodes, blcodes)
  //    int lcodes, dcodes, blcodes; /* number of codes for each tree */
  {
    var rank;                    /* index in bl_order */

    send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
    send_bits(s, dcodes - 1,   5);
    send_bits(s, blcodes - 4,  4); /* not -3 as stated in appnote.txt */
    for (rank = 0; rank < blcodes; rank++) {
      send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1]/*.Len*/, 3);
    }
  
    send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  
    send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  }

  function detect_data_type(s) {

    var black_mask = 0xf3ffc07f;
    var n;
    for (n = 0; n <= 31; n++, black_mask >>>= 1) {
      if ((black_mask & 1) && (s.dyn_ltree[n * 2]/*.Freq*/ !== 0)) {
        return Z_BINARY;
      }
    }
    if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
        s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
    for (n = 32; n < LITERALS; n++) {
      if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
        return Z_TEXT;
      }
    }

    return Z_BINARY;
  }
  
  
  var static_init_done = false;

  function _tr_init(s)
  {
  
    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }
  
    s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  
    s.bi_buf = 0;
    s.bi_valid = 0;
    init_block(s);
  }

  function _tr_stored_block(s, buf, stored_len, last)

  {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);    /* send block type */
    copy_block(s, buf, stored_len, true); /* with header */
  }
  
  function _tr_align(s) {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  }

  function _tr_flush_block(s, buf, stored_len, last)

  {
    var opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
    var max_blindex = 0;        /* index of last bit length code of non zero freq */
    if (s.level > 0) {
      if (s.strm.data_type === Z_UNKNOWN) {
        s.strm.data_type = detect_data_type(s);
      }
      build_tree(s, s.l_desc);

      build_tree(s, s.d_desc);

      max_blindex = build_bl_tree(s);
      opt_lenb = (s.opt_len + 3 + 7) >>> 3;
      static_lenb = (s.static_len + 3 + 7) >>> 3;

      if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }
  
    } else {
      opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
    }
  
    if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {

      _tr_stored_block(s, buf, stored_len, last);
  
    } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
  
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);
  
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    init_block(s);
  
    if (last) {
      bi_windup(s);
    }
  }

  function _tr_tally(s, dist, lc)
  {

    s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
    s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;
  
    s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
    s.last_lit++;
  
    if (dist === 0) {
      s.dyn_ltree[lc * 2]/*.Freq*/++;
    } else {
      s.matches++;
      dist--;             /* dist = match distance - 1 */

      s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]/*.Freq*/++;
      s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
    }
  
    return (s.last_lit === s.lit_bufsize - 1);

  }
  
  exports._tr_init  = _tr_init;
  exports._tr_stored_block = _tr_stored_block;
  exports._tr_flush_block  = _tr_flush_block;
  exports._tr_tally = _tr_tally;
  exports._tr_align = _tr_align;
  
  },{"../utils/common":41}],53:[function(require,module,exports){
  'use strict';

  function ZStream() {
    this.input = null; // JS specific, because we have no pointers
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null; // JS specific, because we have no pointers
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = ''/*Z_NULL*/;
    this.state = null;
    this.data_type = 2/*Z_UNKNOWN*/;
    this.adler = 0;
  }
  
  module.exports = ZStream;
  
  },{}],54:[function(require,module,exports){
  'use strict';
  module.exports = typeof setImmediate === 'function' ? setImmediate :
    function setImmediate() {
      var args = [].slice.apply(arguments);
      args.splice(1, 0, 0);
      setTimeout.apply(null, args);
    };
  
  },{}]},{},[10])(10)
  });