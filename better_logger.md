How To Build A Better Logger
============================
Logging as an Extremely High Throughput Data Streaming Service

2014-11-25 - AR.

Given how ubiquitous logging is, it's surprising how hard it is to find
a good one.

This is what I was looking for:
- simple -- simple to overview, to understand, to use
- very fast -- if I need to consider the overhead added by the logging
  facility, it's of limited use.  I want to be able to log high volume
  data, not just human oriented messages.
- configurable -- I want to tailor it to my use cases, not always use a
  canned built-in default
- versatile -- I should not have to give up on functionality for speed.
  Sometimes I want just speed, sometimes I'm willing to take a hit for
  functionality.
- Did I mention simple?  I don't want to have to master internal apis,
  templating languages, and module hierarchies to use a logger.

I didn't want a text-only logger, or a json-only logger, or one that had
a fixed output format (or even a predefined output templating language),
or one that couldn't log at least 100k lines per second, or one that
required elaborate configuration or digging in the sources to find out
how to customize.  I'm a skilled programmer, so I didn't want someone's
one-size-fits-all canned solution, I wanted simple, efficient building
blocks.

Call me picky, but I ended up writing my own.


On Logging
----------

Logging is more than sending messages to humans.  Logging is also journaling
information, checkpointing data, delivering results, or bulk data transport.
Logging that delivers messages is nice, but logging that is an extremely high
throughput data streaming service opens up worlds of possibilities.

Logfiles must support multiple concurrent writers and readers.  This means
file writes must take care to prevent data corruption (interleaving of data),
and writes must append complete lines to the logfile to not make readers see
any corrupted data (I use an flock(LOCK_EX) during writes).

Logfiles must support external logfile management.  Logfiles may be consumed
(or archived) at arbitrary times and intervals, so loggers must frequently
check and/or reopen the file they are writing to ensure that they switch to
using the current one.  Logfile consumers need to rename the file then wait
for writes to settle before removing or altering the contents.  To avoid
introducing overlong latencies into the consumers (settle wait time), the
reopen interval should be less than a second (I tend to use .05 sec).

Finally, attention should be paid to the data format.  It should be easy to
work with, fast, convenient, well supported, and interoperable.  I like
newline terminated plaintext, which is all of the above.  It also has the
widest assortment of very efficient tools to process it, in both small and
large quantities.  In particular, applying existing system utilities to chunk,
search, sort and transport the data is a huge win.


The Logger
----------

A logger is simple.  It accepts an input message, formats a log line, and
writes it.  The actual log line format and the actual writing vary, so those
filters to apply formats and writers to write should be pluggable.  No need to
disallow multiple filters, just run them in the order added.  That gives us
the base class and two methods, `addFilter()` and `addWriter()`.

The messages can be of differing degrees of severity, from debugging
tracers to critical alerts, but basically three types: debugging aids,
normal progress indicators, and attention required alerts.  We can start
with the three methods of `debug()`, `info()` and `error()`.

A logger is typically configured for the lowest actionable log level.
If configured for error, only errors will be processed, info and debug
messages will be ignored.  It's useful to be able to get and set the
loglevel in effect, thus a method `loglevel()`.  And for logging purposes,
it's nice to have the logged message report its own severity, so we want
the severity to be available to the filters, i.e. `filter(message,
level)`.

For sanity's sake, the logger itself should ensure that all logged lines
are terminated by a newline character.  This also allows the log output
to be fed to other tools that process newline terminated text, which
on Unix systems is the simplest, fastest and most universal form of data
exchange.

        logit( message, loglevelValue ) (
            if (loglevelSensitivity < loglevelValue) return
            for all added filters
                message = filter(message, loglevelValue)
            if (message(-1) !== ``\n'') message += ``\n''
            for all added writers
                write(message)
        )

Messages are logged with methods corresponding to their severity --
debug, info, error:

        info( message ) (
            loglevelValue = numeric log level corresponding to `info'
            logit(message, loglevelValue)
        )


Filters
-------

The simplest log line format is just the severity (the loglevel) and a
timestamp.  I like the timestamp at the front, it makes it easy to find
when looking at logfiles:

        filter( message, loglevelValue ) (
            timestamp = format timestamp
            loglevelText = look up loglevel text
            return timestamp + loglevelText + message
        )

Formatting a human-readable date can be slow; ideally, an already
formatted timestamp should be reused if available.

Formatting for machine consumption is just as simple, and for machine
readable log lines, a numeric timestamp is fine:

        filter( message, loglevelValue ) (
            return JSON.stringify((
                timestamp: Date.now(),
                level: loglevelValue,
                message: message
            ));
        )

Date.now() in nodejs is fast enough to not benefit from caching.  The
bottleneck is JSON.stringify itself, which can't easily be worked around
if we want to support UTF8 strings and/or log objects.


Writers
-------

A writers is an object with a write method taking a string and a callback.  A
writer is free to buffer and combine writes for efficiency, so the callback
does not ensure that the bits have hit the disk, only that it has been
accepted.  Process.stdout or fs.createWriteStream() or a network socket could
be writers, or the fast (and reliable and mutexed) QFputs write combining text
streamer.  Other, non-streaming writers can also be useful, eg sending
datagrams or writing to syslog, all with the same interface.


Putting It All Together
-----------------------

Put all together, we have something that appears like

        // construct a custom logger writing to stdout
        var logger = new Logger('info')
            .addWriter(process.stdout)
            .addFilter(function(message, level) {
                return new Date.toISOString() + " [" + level + "] " + message;
            });

        // use the logger
        logger.info("Hello, world.");


And there it is -- fast, configurable, versatile, simple.

