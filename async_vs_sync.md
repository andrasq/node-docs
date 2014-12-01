Async vs Sync Nodejs Calls
==========================

2014-11-13 AR.

The advantage of nodejs is that the language went to great lengths to make all
operations non-blocking.  This turns out to be the nodejs' greatest obstacle
to reaching peak performance.

The non-blocking nature of nodejs exacts a very high runtime penalty, because
under normal operating conditions the blocking calls executed by the kernel
complete much faster than nodejs can enqueue and dispatch a continuation from
the event queue.  Well-maintained servers are upgraded way before the system
call latencies exceed the queueing delays.

A nodejs service written to run synchronously serves more requests more
quickly than than an async one.  A small illustration of the delays:

    // 34,600 asynchronous open/close operations per second
    function opencloseAsync(cb) {
        fs.open('/etc/motd', 'r', function(err, fd) {
            fs.close(fd, function(err) { cb(fd); });
        });
    }

    // 475,000 synchronous open/close operations per second
    function opencloseSync() {
        var fd = fs.openSync('/etc/motd', 'r');
        fs.closeSync(fd);
    }

Embedded in a sample micro-service, the difference is readily apparent:  an
open/read/close http web service that delivers /etc/motd to the caller fields
52k sync calls/sec, 62% more than the async 32k/sec.
