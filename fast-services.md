Fast Services
=============

2015-01-27 - Andras.


Thoughts on writing fast services.


Lift
----

The first question is how much inherent work, how much "heavy lifting," the
service performs.  If the inherent service delay is in the tenths of seconds,
there is little benefit to shaving milliseconds off the runtime.

On the other hand, if the service computes the result in tenths of
milliseconds, then paying attention to the infrastructure surrounding it is of
great benefit.


Framework
---------

Not all frameworks are created alike; most application frameworks are not well
suited for very low latency, very high throughput operation.

As an example, some throughput comparisons for `wrk -d8s -t2 -c8 http://localhost:1337/echo?a=1`

- [hapi](https://www.npmjs.org/package/hapi) - 0.2k/s*
- [restify](https://www.npmjs.org/package/restify) - 4.6k/s** "smallish"
- [express](https://www.npmjs.org/package/express) - 7.9k/s "fast, minimalist, ... focus on high performance"
- [http.createServer](https://nodejs.org/api/http.html) - 17.6k/s
- [restiq](https://www.npmjs.org/package/restiq) - 21.5k/s "smaller, lighter, faster"

The difference between 4600 and 21500 calls / second can translate into a
50-80% real-world difference in non-trivial production services (12 middleware
steps, mongodb access, and extensive call logging).

\* hapi is limited to 25 calls/sec per connection, and though it is helped by
  TCP_NODELAY (`setNoDelay()` raises it to 1.8k/s), it's not clear if this is
  configurable with the available api
<br>
\*\* restify can achieve 8k/s if `send()` is avoided in favor of `writeHead()`
  and `end()`.  This of course loses some of the benefit of using a framework.


Http.request
------------

Node v0.10 does not always reuse connections for back-to-back requests.  Using
a custom [http.Agent](http://nodejs.org/api/http.html#http_class_http_agent)
like [http-agent](http://www.npmjs.org/package/http-agent) can boost
throughput by better reusing existing connections.  Node v0.11 and up have
started to address this issue, and seems fully fixed in iojs-1.0.1.


Logging
-------

Not all logging is created alike.  Logging can consume 20% or more of the time
used by a lean service (espcially json logging; `JSON.stringify` is slow), so
it is important to pay some attention here here.

[Bunyan](https://npmjs.org/package/bunyan) - 50k/s json
<br>
[qlogger](https://npmjs.org/package/qlogger) - 150k/s json, 650k/s text
