Writing A Fast Date Formatter
=============================

2014-11-29 - AR.

Say you wanted to format dates like php does, with a function `phpdate(format,
timestamp)`.  How could it be made efficient and run really fast?

We'll look at a possible implementation and some optimizations to make it 3x,
5x and 20x faster.

Phpdate
-------

First approach, use a dispatch table for the conversion specifiers, and
concatenate the partial results.  A jump table is faster than a switch (which
is an O(n) if-else-if sequence), and string concatenation runs faster than
other ways of joining strings.

        var formatters = {
            Y: function(dt){ return dt.getFullYear(); },
            m: function(dt){ return dt.getMonth() + 1; },
            d: function(dt){ return dt.getDate(); },
            H: function(dt){ return dt.getHours(); },
            i: function(dt){ return dt.getMinutes(); },
            s: function(dt){ return dt.getSeconds(); },
            u: function(dt){ return dt.getTime() % 1000 * 1000; },
        };

        function phpdate( format, time ) {
            var dt = time !== undefined ? new Date(time) : new Date();
            var output = "";
            var i;
            for (i=0; i<format.length; i++) {
                if (formatters[format[i]]) {
                    output += formatters[format[i]](dt);
                }
                else {
                    output += format[i];
                }
            }
            return output;
        }

The above code runs at about 550k formats per second.  Ok, not great.
(The above code is overly simplified:  it leaves out many conversions, does
not support escaping characters, etc.  But it captures the essence.)

There are several actions that might account for the time -- new object
allocation, string concatenation, formatting.  To triage, we'll time
`phpdate("Y-m-d H:i:s.u")`, comment out each part of the code in turn and
observe the changes.

        as written - 550k calls/sec
        omit new date - 670k/s 22%
        omit string concat - 690k/s 25%
        omit formatting - 690k/s 25%
        omit all, just loop over format.length - 8000k/s
        omit all, iterate over length and test formatters - 860k/s

Looks like the primary bottleneck is looping over the format string and
testing for the conversion functions.


Numerically Indexed Formatters
------------------------------

Examining strings character-by-character is faster when done numerically than
when by array offset, and accessing an array is faster than a hash.  Ie,
`format[i]` is slower than `format.charCodeAt(i)` (the former builds a string
for each char, the latter just a number), and `hash[1]` slower than
`array[1]`.  Since the date formatter does not need the strings, we can
convert the formatters hash into a numerically indexed map:

        var k, formattersMap = [];
        for (k in formatters) {
            formattersMap[k.charCodeAt(0)] = formatters[k];
        }

and change the inner loop to

        var fn = formattersMap[format.charCodeAt(i)];
        if (fn) {
            output += fn(dt);
        }
        else {
            output += format[i];
        }

This one change increases the throughput to 915k/s calls.

Note:  nodejs linear array search is very fast, do not automatically rule out
a brute force solution.  The same speedup can be achieved with a linear search
in an array [key,func] tuples.  (Actually, for just 7 items the linear search
is 10% faster.)

It would look like something like this:

        var formatters2 = [
            ['Y', function(dt){ return dt.getFullYear(); }],
            ['m', function(dt){ return dt.getMonth() + 1; }],
            ['d', function(dt){ return dt.getDate(); }],
            ['H', function(dt){ return dt.getHours(); }],
            ['i', function(dt){ return dt.getMinutes(); }],
            ['s', function(dt){ return dt.getSeconds(); }],
            ['u', function(dt){ return dt.getTime() % 1000 * 1000; }],
        ];

        function getFormatter2( ch ) {
            for (var i=0; i<formatters2.length; i++)
                if (formatters2[i][0] === ch) return formatters2[i][1];
            return undefined;
        }


Format Function Compiling
-------------------------

Not only is accessing a hash slower than an array, but the many small
formatter function calls also add a large amount of drag.

We can combine the conversion functions into a single format function built on
the fly, and cache it for next time.  This requires a bit of restructuring
(especially if the formatter functions rely on external functions, as those
would have to be passed in by name), but it's well worth it:

        var actions = {
            Y: ' ret += dt.getFullYear(); ',
            m: ' ret += dt.getMonth() + 1; ',
            d: ' ret += dt.getDate(); ',
            H: ' ret += dt.getHours(); ',
            i: ' ret += dt.getMinutes(); ',
            s: ' ret += dt.getSeconds(); ',
            u: ' ret += dt.getTime() % 1000 * 1000; ',
        };

        function compileFormat( format ) {
            var i, body;
            body = "var ret = '';\n";
            for (i=0; i<format.length; i++) {
                if (actions[format[i]]) {
                    body += actions[format[i]] + '\n';
                }
                else {
                    body += ' ret += String.fromCharCode(' + format.charCodeAt(i) + ');\n';
                }
            }
            body += 'return ret;\n';
            return Function('dt', body);
        }

The cache can remain very simple, just a hash, because it's very unlikely that
any code will use more than a small handful of different formats.

        var formatCache = {};

And the phpdate inner loop, now for using and having to manage the formatCache
(all of two lines), becomes

            // ...
            fn = formatCache[format];
            if (!fn) fn = formatCache[format] = compileFormat(format);
            output = fn(dt);

This gets us up to 1350k calls / second for back-to-back calls, and 1920k/s
for explicit numeric timstamps.  (More on the 1920 in the next section.)

Note that this optimization is orthogonal of the previous one -- if the
conversion function is compiled, it no longer matters if we use a hash or a
numerically indexed map, since the lookups happen only on first access.
Caching functions built on the fly will be slower for single-char formats, but
will be faster for longer formats.


Current Date Caching
--------------------

The above results point out an odd anomaly: supplying an explicit timestamp to
`new Date()` (as in `new Date(1)`), runs faster than having to look up the
current time (on my machine it's 3x faster, 9.9m/s vs 3.5m/s).  Caching the
current date is a win-win:  if the current date is reused, it will be faster;
if it is not, it's already on the fast code path.

Technically, if we cache the date it needs to be confirmed on each use that
it's still current, or needs to be invalidated when it ages out.  In nodejs,
checking for currentness with Date.now() is as slow as allocating a new object
(and with process.hrtime() it's even slower).  Invalidating via the event
queue is efficient, but not guaranteed (blocking calls will delay
invalidation).  For this module, we'll risk it:

        // current date cache
        function CurrentDateCache( ) {
            this.calls = 0;
            this.date = null;
        }
        CurrentDateCache.prototype._newDate = function( ) {
            var self = this;
            // invalidate the current date object after 1 ms
            // nb: blocking calls could delay this continuable, letting a
            // stale date object be used after its pull date.
            setTimeout(function(){ self.date = null; }, 1);
            this.calls = 0;
            return this.date = new Date();
        }
        CurrentDateCache.prototype.get = function( ) {
            // invalidate the current date object after 100 uses, just in case
            if (this.calls++ < 100 && this.date) return this.date;
            else return this._newDate();
        };

        var currentDate = new CurrentDateCache();

And in phpdate

        var dt = time !== undefined ? new Date(time) : currentDate.get();

Now at 2800k calls / sec for reused dates; the same 1920k / sec if
creating a new date object from a millisecond timestamp.


Result Caching
--------------

If many of the calls are likely to return the same value (as when formatting
realtime timestamps in quick bursts), caching the last few recently computed
results can provide a huge boost at fairly moderate overhead.

This topic deserves a writeup of its own, but the TL;DR is that a small array
used as a circular buffer is faster to search and update than a hash or an LRU
stack.  A linear search with explicit comparisons runs very fast in nodejs.

        // lru result cache
        function DateCache( ) {
            this.capacity = 10
            this.cache = [];
            this.index = 0;
        }
        DateCache.prototype.set = function( fmt, dt, res ) {
            this.cache[this.index++] = {fmt: fmt, tm: dt.getTime(), res: res};
            if (this.index >= this.capacity) this.index = 0;
        };
        DateCache.prototype.get = function( fmt, dt ) {
            var i, tm = dt.getTime();
            for (i=0; i<this.cache.length; i++) {
                var item = this.cache[i];
                if (item.fmt === fmt && item.tm === tm) return item.res;
            }
            return false;
        };

For back-to-back calls, this runs at 12m calls / sec.

If the cache does not capture any repeats (ie, every call uses a different
timestamp), the added overhead of managing the cache lowers throughput from
1920k/s down to 1540k/s.

This is the largest single speedup, but is also the hardest tradeoff to
justify -- a steady 2-2.8m/s, or 1.5m/s with bursts of up to 12m/s.  Depends
on the expected usage patterns; some will win, others lose.  Or it could be
made configurable, with result caching enabled/disabled at load time or run
time.


Conclusions
-----------

The results speak for themselves -- faster by an order in magnitude (21x) in
bursts, 5x faster in the expected case, 3x faster in the worst case.

We didn't address padding (date should show '01' not '1'), leap days,
timezones, helper functions, but should be straight-forward to extend the
above structure to deal with those too.


Related Work
------------

[phdate-js](https://www.npmjs.com/package/phpdate-js)
[ultra-strftime](https://www.npmjs.com/package/ultra-strftime)
[fast-strftime](https://www.npmjs.com/package/fast-strftime)
