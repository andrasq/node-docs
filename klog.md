klog
====
Kinvey Hackathon, 2017-06-14 - [Andras](https://npmjs.com/~andrasq).

* Fast, robust remote logging service.
* A true microservice:
  - a service that is small and light (dependencies count!)
  - and of course a service that does little
* 500 lines of code, 2 mb of dependencies
* Easy to use, plug-and-play with the `qlogger` fast logger
* Use a scooter for small loads (even though we standardize on trucks.  Oops.)
  - scooter has 4% the overhead of the truck, and can run 20x faster
* Leverages several other "scooters" from my toolkit
* Not a full service, it's a package with `createServer()` and `createClient` methods

Objectives
----------

* low latency with negligible overhead (existing services can use it to remote log)
* robust (should not lose checkpointed loglines)
* high volume (to ship existing files in bulk)
* scriptable, service can be used from the command line with `curl`
* multi-writer safe (multiple processes ok to log to same file)
* convenient to use, can be added as a `qlogger` log writer

Implementation
--------------

* client has 2 methods, `write` and `fflush`
* server has 2 methods, `write` and `fflush`
* client is configured to talk to a server
* each client logs to one remote logfile
* one socket per client
* a server can handle multiple logfiles (configured at startup)
* server can talk both http and rpc
* rpc splits the requests (log writes) from the responses (acks);
  acks must be requested separately.  Runs up to 20x faster
* direct remote logging is possible; line is sent immediately, but
  caller must sync explicitly

* server http: listen for line, append line (`express` and `restiq`)
* server rpc: listen for line, append line (`qrpc`)
* client http: send line, wait for ack
* client rpc: send line, ack later
* client bulk: checkpoint line to local journal, swap journals, upload in batches,
  ack when done.  Multi-process safe journal swapping is built into `qfputs`.
* locally checkpointed line is synced to server after 10ms
* the server framework is provided, but the server actions are undefined.
  The test server appends to a local logfile, or just counts lines received.

Lessons Learned
---------------

* Standardized approach can greatly limit performance
* Beware your tools (request halves the service throughput)
* Trust the libraries (the bug was in the new code, not qbuffer)
* Careful when benchmarking fast services (3-4gb files in a couple of dozen seconds)
* Hard to measure file transport throughput
  - need to run test for several seconds to get a good read
  - several seconds can generate and ship gigabytes of logs
  - disk-based filesystem can stall to write to disk
  - 6 gb memory-based filesystem /dev/shm filled up
  - (workaround was to split the tests and run selected subsets at a time)

Performance
-----------

Measured the count of 200-byte newline terminated lines logged to the "remote"
server (another process running on the same host).

* 200-byte newline terminated loglines
* timed both the time to receive (efficiency) and time to persist (speed) on server
* remote server running in another process on same host (just sockets, no network)
* klogClient separates the write from the ack; timed acks per 100, 1000 and 10000 lines

* up to 65 mb/s received and 45 mb/s persisted
* 2x performance gain by selecting packages more carefully (`request` is very slow)
* 20x throughput gain by using a better protocol (one-way rpc vs http)
* 60-90x performance gain by working with async batches in near-realtime

All http calls reused the connection with maxSockets: 10.

AWS VM, lines received at and acknowledged by server:

qtimeit=0.20.0 node=6.9.1 v8=5.1.281.84 platform=linux kernel=3.2.0-111-virtual up_threshold=false
arch=x64 mhz=1 cpuCount=2 cpu="Intel(R) Xeon(R) CPU E5-2676 v3 @ 2.40GHz"
timeGoal=4 opsPerTest=100 forkTests=false
name                        speed           rate
express w request 1         3,423 ops/sec    171 >
express w request 2         3,904 ops/sec    195 >
express w qhttp 1           7,765 ops/sec    388 >>
express w qhttp 2           7,791 ops/sec    390 >>
restiq w qhttp 1            9,535 ops/sec    477 >>
restiq w qhttp 2            9,700 ops/sec    485 >>
qrpc w klogClient 1       115,302 ops/sec   5765 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 2       118,595 ops/sec   5930 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 1k 1    131,561 ops/sec   6578 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 1k 2    133,550 ops/sec   6678 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 10k 1   127,736 ops/sec   6387 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 10k 2   128,987 ops/sec   6449 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

journaled klogClient      343,348 ops/sec  17167

AWS VM, lines persisted into server-side logfile:

qtimeit=0.20.0 node=6.9.1 v8=5.1.281.84 platform=linux kernel=3.2.0-111-virtual up_threshold=false
arch=x64 mhz=1 cpuCount=2 cpu="Intel(R) Xeon(R) CPU E5-2676 v3 @ 2.40GHz"
timeGoal=4 opsPerTest=100 forkTests=false
name                        speed           rate
express w request 1         3,212 ops/sec    161 >
express w request 2         3,572 ops/sec    179 >
express w qhttp 1           6,543 ops/sec    327 >>
express w qhttp 2           6,578 ops/sec    329 >>
restiq w qhttp 1            8,021 ops/sec    401 >>
restiq w qhttp 2            8,044 ops/sec    402 >>
qrpc w klogClient 1        29,253 ops/sec   1463 >>>>>>>
qrpc w klogClient 2        30,828 ops/sec   1541 >>>>>>>>
qrpc w klogClient 1k 1     99,579 ops/sec   4979 >>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 1k 2     97,280 ops/sec   4864 >>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 10k 1   125,788 ops/sec   6289 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
qrpc w klogClient 10k 2   115,701 ops/sec   5785 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>

journaled klogClient      245,670 ops/sec  12284

Related Work
------------

- [express](https://npmjs.com/package/express) - featureful REST framework
- [request](https://npmjs.com/package/request) - featureful but slow http request library
- [restiq](https://npmjs.com/package/restiq) - light-weight REST framework
- [qhttp](https://npmjs.com/package/qhttp) - fast convenience wrapper around `http`
- [qlogger](https://npmjs.com/package/qlogger) - very fast, very flexible logging
- [qrpc](https://npmjs.com/package/qrpc) - fast rpc
- [qfputs](https://npmjs.com/package/qfputs) - fast multi-writer safe file appender
