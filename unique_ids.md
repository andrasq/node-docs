Fast Unique Id Generation
=========================

2014-12-21 AR.


There are times when one needs unique identifiers.  It is good to have a
source that is both very fast and guaranteed unique.


Random Is Not Unique
--------------------

This is a subtle but important point: a randomly generated number, no matter
how large, is not guaranteed unique.  It's always surprising how many people
equate "sufficiently random" with "unique."  SHA checksums and MD5 hashes are
not unique.

Simple and Fast
---------------

If uniqueness is not an absolute requirement, the simplest is to generate a
random string.  This is very fast, and for many uses (eg request ids, unit
tests) is unique enough.  (It is limited to 8 hex digits:  the nodejs random
number generator generates 32-bit random numbers.)

        Math.floor(Math.random() * 0x100000000 | 0).toString(16)


Guaranteed Unique
-----------------

For some uses (eg database primary keys, user ids) uniqueness must be
guaranteed.  Uniqueness can be implemented by having id allocation be
centralized, coordinated or delegated.  Delegated identity based on location,
either physical or virtual, is called georgraphic addressing.  One obvious
geographic addressing scheme is a hierarchy of domain-unique ids, eg hostname +
process-id + thread-id + unique-sequence-num.  The unique sequence number may
be timestamped to allow sequence restarts.


Mongoid
-------

The MongoDB database uses a streamlined geographic addressing scheme.  Instead
of the full hierarchy of addresses, MongoDB assigns each server a unique
3-byte binary server id.  This, combined with a 4-byte timestamp, a 2-byte
process id, and a 3-byte monotonic sequence number, forms the unique id.

These ids are not cryptographically secure, the pattern is easily visible.
They are not suitable for use where guessability would not be acceptable.


Implementation
--------------

The id inside mongodb is maintained an object, but converted to text it is
represented as a 24-char hex string.  The order of the fields is timestamp,
machine-id, pid, sequence-num.

For our purposes, the object is a distraction, we are interested in the unique
identifiers, not in their implementation mechanism.  They are interchangeable
and easily converted:  every id object corresponds to one unique id string and
vice versa, so the internal represenatation does not matter.  Strings are much
faster to generate and use, so we'll work with string ids.

The implementation, in essence:

        var machineId = Math.random() * 0x1000000 | 0;
        var processId = process.pid;
        var sequenceId = 0;
        function mongoid( ) {
            var timestamp = Date.now() / 1000 | 0;
            sequenceId += 1;
            var id =
                hexFormat(timestamp, 8) +
                hexFormat(machineId, 6) +
                hexFormat(processId, 4) +
                hexFormat(sequenceId, 6);
            return id;
        }

        function hexFormat(n, width) {
            var s = n.toString(16);
            while (s.length < width) s = "0" + s;
            return s;
        }

Speed
-----

The above is good for 690k ids / second (100k ids in 144 ms), already very
competitive with many unique id packages available for nodejs.  But we can
easily do better.

The key here is to not recompute results that can be reused from the previous
call.  Of the four id components, 2 do not change, and one changes only
infrequently.  The previously computed strings can be reused.

Preformatting just machineId and processId is already 60% faster, 1100k ids / second.

Reusing the timestamp (which changes just once every 1000 milliseconds) for up
to 10 ms or 1000 calls is 250% faster still, 2700k ids / second.

        var _timestamp;
        var _timestampStr;
        var _ncalls = 0;
        function getTimestampStr() {
            if (!_timestamp || ++_ncalls > 1000) {
                _timestamp = Date.now();
                _timestampStr = hexFormat(_timestamp, 8);
                _ncalls = 0;
                setTimeout(function(){ _timestamp = null; }, 10);
            }
            return _timestampStr;
        }

It may be slightly faster to zero-pad the hex string by looking up the
zeroes prefix in a table, but timings are inconclusive.

Most of the remaining time is spent formatting the sequence id.  There must be
something to reuse here too... and there is.  If we think about it, almost all
changes to the sequence id are to the least significant digit.
By retaining the sequence prefix and appending just the last digit, we can
generate 10 million unique ids in .7 seconds -- 14 million ids per second!
This is more than half the rate achieved by the Math.random generator
mentioned above, but with guaranteed unique ids.

        var machineIdStr = hexFormat(Math.random() * 0x1000000 | 0, 6);
        var processIdStr = hexFormat(process.pid, 4);

        var sequenceId = 0;
        var sequencePrefix = "00000";
        var sequenceDigits = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];

        function mongoid( ) {
            sequenceId += 1;
            if (sequenceId % 16 === 0) {
                sequencePrefix = hexFormat((sequenceId / 16).toString(16), 5);
            }
            var id =
                getTimestampStr() +
                machineIdStr +
                processIdStr +
                sequencePrefix + sequenceDigits[sequenceId % 16];
            return id;
        }

Note that to use in production we would need to test for sequence id overflow
-- the 24 bit sequence id will overflow at 16 million.  A slightly faster cpu,
or a different version of nodejs will easily hit that.  (Timings were made on
an AMD 3.6 GHz Phenom II with node-v0.10.29; on the same system, v0.11.13 runs
at 20 million ids / second.)


Conclusions
-----------

Even the first version of our code was faster than `BSON.ObjectID()`, and we
were able to speed that up 20 x, from 690k/s to 1.1m/s to 2.7m/s to 14m/s.

If we need to generate lots of unique ids (like when assigning ids to data
collections or tagging in-flight data), a small and extremely fast id
generator like the above is very appealing.


Related Work
------------

- [mongoid-js](https://www.npmjs.com/package/mongoid-js)
- [node-uuid](https://npmjs.com/package/node-uuid) uuid.v4()
- [mongodb](https://www.npmjs.com/package/mongodb) BSONPure.ObjectID()
