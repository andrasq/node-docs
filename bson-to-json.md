Faster BSON to JSON
===================

Kinvey Hackathon, May 2 2016.

A common use case for mongodb data is to relay it to a remote user.  Remote data is
typically consumed in serialized JSON wire format; mongo sends data serialized in
its own BSON format, so the BSON is converted to JSON for relaying.  The normal
conversion process is to decode the BSON string into an object, then re-encode the
object into a JSON string.

This approach is a slow, cpu intensive process.  However, it turns out that BSON
can be converted to JSON on the fly without fully decoding it, using 1/4 to 1/10
of the time and cpu.


Observations
------------

The transcoding approach was motivated by a few observations:

- the BSON and JSON formats are conceptually fairly similar
- the node BSON conversion library does its work using native C++ functions
- the nodejs interface to nagive C++ plugins is slow, about 4 million calls / sec
- it is much slower to build a js object hierarchy in C++ than in javascript itself
- many of the converted strings are plain ASCII and could be copied as-is
- many of the converted values (numbers, dates) are easy to recover and are faster
  to convert in javascript than with a native function

And as luck would have it, the conversion was made even easier by

- BSON strings encoded to bytes are quite similar to JSON bytes, utf8 encoded (but not
  the control characters)


Implementation
--------------

- implemented as an accelerator, not a definitive conversion function
- an error is thrown if the conversion cannot be handled
- functions, symbols are not handled
- both property names and value strings are json-encoded


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
the data rate increased to 7.8mb / sec (more efficient conversion), and total cpu
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


Glossary
--------

- JSON - JavaScript Object Notation
- BSON - Binary JSON
- ASCII - American Standard Code for Information Interchange
- UTF - Universal Text Format
