How Long was my Event Loop Blocked
==================================

Working on one of the unit tests, we got curious how long the event loop
was blocked during mongodb insert and find calls.

It took only a minute to code up an event loop lag measurement function, so we
added it to the unit test between runs.


The Event Loop
--------------

First, a brief overview of the nodejs event loop.

Nodejs runs computations to completion.  Computation can create and schedule
other computations ("continuables") which wait their turn to run.

Computations can be scheduled with eg `setImmediate` or `setTimeout`, or
asynchronous functions with a callback whose callback is invoked when an event
occurs.

These scheduled or event-triggered callbacks run only after the currently
running computation finishes and exits the script by returning from the
top-level source file (typically `index.js`).  When the current computation
finishes, the immediate queue is checked, and the pending timeout and evented
functions are run.

In order to ensure that all requests are handled in a timely fashion, it is
important to keep the duration of each computation short.


The Timeout Loop
----------------

The timeout queue, those functions that were enabled by an event, are checked
after the current computation finishes.  If a timer expired, its callback that
became eligible to run is then run.  A timeout function that schedules itself
for a subsequent run will be invoked again once the new timer expires.

Thus the elapsed time between such timeout function runs is affected by the
time used by the intervening computations.  It is a simple thing for the
timeout function to record the time elapsed since the last run, and log or
maintain min/max/avg statistics.


Sample Code
-----------

We added a function to the unit test to run on a regular timer and to track
the maximum elapsed time since the last run.

        var lastTimerRun = null;
        var maxBlockedMs = 0;
        function latencyTimer() {
            var now = Date.now();
            if (!lastTimerRun) {
                lastTimerRun = now;
            }
            else {
                var elapsed = now - lastTimerRun;
                if (elapsed > maxBlockedMs) maxBlockedMs = elapsed;
                lastTimerRun = now;
            }
            setTimeout(latencyTimer, 5);
        }
        setTimeout(latencyTimer, 5);

We wanted to keep it simple, so the maximum is tracked in a module variable,
which makes checking and resetting simple.
The check the longest blocked duration, look at maxBlockedMs.  To reset the
measurement, set maxBlockedMs = 0.  To not have the script loading time throw
off the measurements, the intervals are auto-initialized from inside the timer
function.

The timer interval is 5ms to not impose a cpu burden on the host.  The unit
test starts the timer, letting the test runner kill it when the test file is
done.


Results
-------

And how long was mongodb blocking the event loop?  Inserting 10,000 1K
entities, mongodb-1.4.33 with useLegacyOps:true blocked for almost 4 seconds!

                                        elapsed cpu     blocked
        insert 10k mongodb-1.3.19       1550ms  1160ms  890ms
        find 10k 1.3.19                 3480ms  2830ms  700ms

        insert 10k mongodb-1.4.33       5140ms  5070ms  1460ms
        find 10k 1.4.33                 3000ms  2800ms  920ms

        insert 10k mongodb-1.4.33       4870ms  4270ms  3880ms  useLegacyOps:true
        find 10k 1.4.33                 3670ms  3210ms  1140ms  useLegacyOps:true

The above were from a few runs of the unit tests, not rigorous performance
measurements.  Nevertheless, the magnitude of the delay was surprising.

The fix for `find` was simple, we specified a more reasonable `cursorSize()`
than the default.  The fix for `insert` was to batch the inserts into multiple
calls.

After batching:

        insert 10k 1.3.19                980ms   960ms  160ms
        find 10k 1.3.19                 1910ms  1870ms  20ms

        insert 10k 1.4.33               5200ms  5030ms  250ms
        find 10k 1.4.33                 2820ms  2710ms  20ms

Conclusions
-----------

The event loop may be blocked in unexpected ways.  We suspected some delay for
serializing the data (though there is no reason for it, the call could just as
easily have implemented non-blocking serialization), but we were astounded at
the difference between two different versions of the same library.

Batching finds reduced blocking by an order of magnitude, at the cost of
doubling the elapsed time.  This might be adjustable though batch size, but
even if not, it moves the cost of large datasets to where it belongs, and does
not penalize other calls.

Batching inserts did not substantially reduce blocking.  At the database
level, blocking went from 1500ms to 250ms, but because the api takes all the
input in a single json and decodes it into an object atomically, blocking at
the call level only dropped to 900ms.

Next we will be looking at making argument decoding less blocking.

As a side note, it turns out there are packages out there that measure
blocking in node (using the same principle that we came up with), but this was
literally faster to implement than to search for.
