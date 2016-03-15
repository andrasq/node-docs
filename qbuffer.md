Splitting Binary Data with QBuffer
==================================


[`qbuffer`](https://github.com/andrasq/node-qbuffer)
is a flexible, powerful binary and mixed binary / text stream splitting
package.  It concatenates strings, binary buffers, or a mix of the two, locates the
record delimiters in the stream, and extracts, converts and returns the records.


Api
---

The basic api is `write` and `getline`.  Chunks are appended to the buffer as they
arrive with `write`, and records are retrieved with `getline`.  Write accepts both
buffers and strings, with an optional encoding.  The canonical record is a newline
terminated line, but the record is fully programmable.


Overview
--------

To split newline terminated lines:

        var QBuffer = require('qbuffer');
        var stream = process.stdin;

        var lines = [];
        var qbuf = new QBuffer({
            encoding: 'utf8',                   // return strings
            delimiter: '\n',                    // the default
            decoder: function(line) {           // the default
                return line
            },
        });
        stream.on('data', function(chunk) {
            qbuf.write(chunk);
        })
        stream.on('end', function() {
            var line;
            while ((line = qbuf.getline()) !== null) lines.push(line);
            if (qbuf.length > 0) throw new Error("incomplete last line");
        })

To split length-counted BSON records from a mongodump bson stream and recover
the array of entities:

        var QBuffer = require('qbuffer');
        var stream = process.stdin;
        var bson = require('bson');

        var entitiesArray = [];
        var qbuf = new QBuffer({
            encoding: null,                     // return buffers, default
            delimiter: function() {             // delimit by length count
                if (this.length <= 4) return -1;
                var len = this.peek(4);
                return len[0] + len[1]*256 + len[2]*65536 + len[3]*16777216;
            },
            decoder: function(record) {         // decode as BSON object
                return bson.BSONPure.BSON.deserialize(record);
            },
        });
        stream.on('data', function(chunk) {
            qbuf.write(chunk);
        })
        stream.on('end', function() {
            var record;
            while ((record = qbuf.getline()) !== null) entitiesArray.push(record);
            if (qbuf.length > 0) throw new Error("incomplete final record");
        })

Note that the two loops are the same except for how qbuf is configured.  In both
cases qbuf buffers, delimits, splits and decodes the records.  In the first example
each record is a newline terminated string, in the second it is a BSON object.


Performance
-----------

QBuffer is very fast, it splits over a million 200 byte strings per second.
