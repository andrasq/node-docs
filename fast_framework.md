Writing A Fast Framework
========================

2015-01-12 - Andras.

(work in progress)

These are some thoughts on writing a fast REST-ful (or not) framework for
nodejs.

Timings are from an AMD 3.6 GHz Phenom II x4 running node-v0.10.29.

Bottlenecks
-----------

Some subtle traps to watch for

### speed of light

It is always good to have a clear understanding of the limits of the system.
For node services built on top of [http](https://www.nodejs.org/api/http.html),
the limit is that of http itself.  In my case, that meant 27k hello-world
requests served / second.  `net.createServer()` can do 45k/s, but I was willing
to trade off peak throughput for the convenience of the built-in HTTP handling.

### speed of system

Not all parts of the system libraries are equally fast.  Sometimes trying a
different approach can be illuminating.

Read, don't listen.  A node web server must read the request body, which can be
done with read() or on().  There is no end-of-file indicator, however; the 'end'
event must be listened for, so the data is typically consumed with another
listen `res.on('data')`.  This can be a mistake -- it turns out that with
node-v0.10.29, a setTimeout read() loop can read the data and reply 30% faster
than if listening for it.  So try a few alternates.

Be lazy, check first.  Similarly, decoding the query parameters `a=1&b=2&c=3`
requires url-decoding all names and values.  The average of the node built-in
`decodeURIComponent` is greatly increased by pre-testing strings for whether
they contain any encoded characters.  Parameter decode speeds can be increased
by an order of magnitude this way (.85m/s to 7.3m/s).

### path params vs query params

Not all fast is created alike.  REST APIs specify the action with the request
method, and pass parameters embedded in the request path.  Node's fast regular
expressions can loop over the request paths to match the route and extract the
path params in a single go (5m/s tests), but query params with fixed routes can
be implemented as a much faster hash lookup (42m/s lookups).  An app with 25
routes can only map 200k/sec REST paths, but still 42m/s static paths.

### structs vs hashes

Structs are fast, hashes are slow.  An object constructed with `new` or as a
literal object `{ ... }` will be made a struct; existing fields and methods
accessed with direct lookups and all will be well and fast.

Adding fields to an object can flip it from struct to hash; this can manifest as
a drop in throughput of eg 30%.

### socket.write()

When the server returns the response, it can either `res.write(data);
res.end()` or it can `res.end(data)`.  The former is necessary to send
responses in parts, or to stream a large result set.  It is also orders of
magnitude slower.  The speed disparity affects other ways of streaming too, eg
`pipe`.

The cause is the TCP/IP Nagle algorithm, which delays packets to amortize the
header overhead for when it sends.  If the latency is more critical than the
bandwidth consumed (as is expected with micro-services), use
`res.socket.setNoDelay()` to turn off the delay on the connection.

