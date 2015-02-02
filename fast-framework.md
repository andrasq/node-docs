Writing A Fast Framework
========================

2015-01-12 - Andras.

(work in progress)

These are some thoughts on writing a fast REST-ful (or not) framework for
nodejs.

Timings are from an AMD 3.6 GHz Phenom II x4 running node-v0.10.29.
Call rates measured with wrk 3.0.3, `wrk -d8s -t2 -c8 http://127.0.0.1:1337`

Bottlenecks
-----------

Some fundamental limits:

### speed of light

It is good to have an understanding of the limits of the system.  For node
services built on top of [http](https://www.nodejs.org/api/http.html), the
limit is that of http itself.  Here that meant 27k hello-world requests served
/ second.  `net.createServer()` can do 57k/s, but I was willing to trade off
peak throughput for the convenience of the built-in HTTP handling.

        net.createServer        57k/s           echo "Hello, world." string
        http.createServer       27k/s           echo string

This is a guaranteed-not-to-exceed limit, but it can not be reached for
realistic applications.  In fact, it can take some creative trial-and-error to
exceed 20k/s.

### speed of libraries

Not all parts of the system libraries are equally fast.  Sometimes trying a
different approach can be illuminating.

**Getting the request:  Read, don't listen.**
A node web server must read the request body, which can be
done with read() or on().  There is no end-of-file indicator, however; the 'end'
event must be listened for, so the data is typically consumed with another
listen `res.on('data')`.  This can be a mistake -- it turns out that with
node-v0.10.29, a setTimeout read() loop can read the data and reply 30% faster
than if listening for it.  So try a few alternates.

        http.createServer       27k/s           no (ignore) body, echo string
          res.on('data')        19k/s           consume body, echo string
          res.read()            24.5k/s         consume body, echo string (v0.10.29)

**Decoding params: Be lazy, check first.**
Similarly, decoding the query parameters `a=1&b=2&c=3`
requires url-decoding all names and values.  The average speed of the node
built-in `decodeURIComponent` is greatly increased with the simple work-around
of pre-testing strings for whether they contain any encoded characters.  Since
parameter names and most values often remain unchanged after encoding, decode
speeds can be increased by an order of magnitude this way (.85m/s to 7.3m/s).

### path params vs query params

**Not all fast is created alike.**  REST APIs pass parameters embedded in the
request path.  Node can loop over the request paths and can match the route
and extract the path params in a single go with regular expressions very
quickly (4m tests/s / num routes).  Fixed routes with an appended query string
can be implemented as a much faster hash lookup (20m/s).  An app with 20
routes can map 4m / (20 / 2) = 400k/sec paths on average; the static lookup
can decode 1m/sec sets of 3 query params per call.  The winner: with 20 routes,
static routes with the slow parameter decode.

        /echo?a=1&b=2           19.9k/s
        /1/2/echo               20.3k/s         1st route
        /1/2/echo               19.7k/s         11th route
        /1/2/echo               18.5k/s         21st route

The breakeven is around 10 regex tests.  Similarly, more call params favor
regex matches; fewer params favor static routes.

        /echo?a=1&b=2&c=3&d=4&e=5 18.6k/s
        /1/2/3/4/5/echo         19.4k/s         1st route
        /1/2/3/4/5/echo         18.5k/s         11th route

### and of course, JSON params

WRITEME: surprisingly enough, given the tightly joined nature of json and
javascript, decoding json parameters is slow.

### structs vs hashes

**Use structs.  Structs are fast, hashes are slow.**
An object constructed with `new` or as a
literal object `{ ... }` will be made a struct; existing fields and methods
accessed with direct lookups and all will be well and fast.

Adding fields to an object can flip it from struct to hash; this can manifest as
a drop in throughput of eg 30%.

Using `new` constructor instances is good, they will be created as optimized
structs and will be fast to access.

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

