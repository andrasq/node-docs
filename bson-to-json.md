Faster BSON to JSON
===================

Kinvey Hackathon, May 2 2016.
2016-05-04 - AR.

A common use case for mongodb data is to relay it to a remote user.  Remote data is
typically consumed in serialized JSON wire format; mongo sends data serialized in
its own BSON format, so the BSON is converted to JSON for relaying.  The normal
conversion process is to decode the BSON string into an object, then re-encode the
object into a JSON string.

This approach is a slow, cpu intensive process.  However, it turns out that BSON
can be converted to JSON on the fly without fully decoding it, using much less time
and cpu.


Observations
------------

The transcoding approach was motivated by a few observations:

- the BSON and JSON formats are conceptually fairly similar
- the node BSON conversion library does its work using native C++ functions
- the nodejs interface to native C++ plugins is slow, about 4 million calls / sec
- it is much slower to build a js object hierarchy in C++ than in javascript itself
- many of the converted strings are plain ASCII and could be copied as-is
- many of the converted values (numbers, dates) are easy to recover and are faster
  to convert in javascript than with a native function


Implementation
--------------

- implemented as an accelerator, not a definitive conversion function
- an error is thrown if the conversion cannot be handled
- functions, symbols, binary data, code with scope and timestamps are not handled
- both property names and value strings are properly json-encoded

The implementation was made even easier by

- utf8 byte sequences are valid JSON
- BSON strings are saved as utf8 byte tuples (but BSON does not \u-escape the
  control characters)
- RegExp regular expression objects serialize to the JSON empty object `{}`
- dates serialize to the built-in `toISOString()` format
- BSON arrays are identical to BSON objects, and array indices are easy to recover

The heart of the conversion is looping over the bytes in the source buffer, copying
them into the target buffer, with some minor alterations.

Some conversions required writing a lexical analyzer (a lexer, a concept familiar
from compilers):  scanning bytes and assembling them into numbers and strings.  Some
numbers were base 10 big-endian (human), others base-256 little-endian (binary).

The code to scan floating-point numbers I borrowed from another project of mine,
since a hand-written js function to convert 8 stored bytes into a floating-point
Number sped up the conversion of floats by 40% over `buffer.readDoubleLE()`.


Timings
-------

Type-specific timings show speedups of 80% for Dates, 4x for integers, booleans and
null, 5x for floats, 5x for short strings (3.5x for strings of length 20 and 70%
for len 100), 8x for regular expressions, 3.7x for objects of 5 ints (9x for more
complex objects with varied data), and 12x for arrays of 5 ints (14x for a sparse
array of length 7 with 3 values).


Results
-------

Using `convertBson()` to convert the response data to JSON is generating
byte-for-byte identical responses.

Collection exports, one of the heavy cpu users, speed up by 5x (5.4 to 1.1 sec)
due to decreased cpu usage.  Collection exports unthrottled, the download time is
determined by the speed at which the data can be converted.

Batched JSON data fetches are throttled to not exceed 10 mb / second.  The actual
data rate is about 5.5 mb / sec due to processing overhead.  After this change,
the data rate increased to 7.5mb / sec (more efficient conversion), and total cpu
used dropped from 5.6 to 1.5 sec.  The total elapsed time also decreased 40%, from
14.5 to 10.5 seconds.

        80 mb streaming json cpu and elapsed (collection export)
        before:  XXXXXXXXXXXXXXXXXXXXXXXXXXX
        after:   XXXXX

        80 mb batched json cpu (data fetch)
        before:  XXXXXXXXXXXXXXXXXXXXXXXXXXXX
        after:   XXXXXXXX


Future Work
-----------

- since conversion has to parse the BSON layout, it could also fully convert it.
  It would be interesting to do a side-by-side comparison of js-only conversion to
  the library


Update
------

The BSON to JSON conversion project fired up our interest in BSON coding, so we
dusted off our experimental bson parser (had been tacked on to
[json-simple](https://github.com/andrasq/node-json-simple) and spent a busy two
days hacking it and added full encode / decode functionality.  (See
[qbson](https://github.com/andrasq/node-qbson).)

The results are interesting.  Decoding is slightly faster for most data types, but
arrays are much (7x) faster than [`bson`](https://github.com/mongodb/js-bson).
Decoding is faster than [`buffalo`](https://github.com/marcello3d/node-buffalo)
as well.

Manual encoding though is 6x faster than `bson` and 4x faster than `buffalo`, some
of it due to a string to utf8 converter written in javascript.


Glossary
--------

- JSON - JavaScript Object Notation
- BSON - Binary JSON
- ASCII - American Standard Code for Information Interchange
- UTF - Universal Text Format
