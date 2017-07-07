klog
====
Kinvey Hackathon, 2017-06-14 - [Andras](https://npmjs.com/~andrasq).

The last time, wrote a function.
This time a pacakge.
Hey, progress!

Kitchen Sink Goals
----------------

* Remote logging
* Log shipping
* Durable, fault-tolerant logging
* Use rpc for a real application
* Compare http rest frameworks
* Compare http request libraries
* Compare http vs rpc

Objectives
----------------

Log here, save there.  Or, `curl -d@log.sav http://server/log/write`

* Fast: low latency, low overhead, high throughput (usable to log directly to remote,
  or to ship logs in bulk)
* scriptable, usable from the command line (with `curl`)
* multi-writer, multi-process safe (ok to share logfile)
* convenient to use, can plug into existing loggers (`qlogger` writer)
* durable (should not lose checkpointed loglines)
* available, fault tolerant (should not require the remote to be always up)
* the idea and approach date back to 2012 and earlier

Results
----------------

* Fast, robust remote logging
* A true microservice:
  - a service that is small and light (dependencies count!)
  - and of course one that does little
* not a standalone service: package with createServer() and createClient() methods
* a scooter better for some loads, not always a truck
  - "scooter" has 4% the overhead of the "truck", up to 20x faster
  - Leverages other "scooters" from my toolkit

Implementation
----------------

* 500 lines of code, 2 mb of dependencies
* client has 2 methods, `write` and `fflush`
* server has 2 calls, `write` and `fflush` (also `/:log/write` and `/:log/fflush`)
* each client talks to one server
* each client logs to one remote logfile
* one socket per client
* a server can handle multiple logfiles (configured at startup)
* server can manage multiple logfiles
* server can talk both http and rpc
* rpc splits the requests (log writes) from the responses (acks);
  acks must be requested separately.  Runs much faster.
* direct remote logging via TCP is possible; line is sent immediately, but
  caller must sync explicitly
* local staging journal supported, automatically uploads journal contents
* the server provides the framework, but the actions are undefined.
  The test server appends to a local logfile, or just counts lines received.
* binary safe, but batching relies on newline termination

Operationally,

* server http: listen for line, append line, ack call (`express` and `restiq`)
* client http: send line, wait for ack
* server rpc: listen for line, append line, ack when only when asked (`qrpc`)
* client rpc: send line, ask for ack later
* journaled: checkpoint line to local journal, swap journals, upload in batches,
  ack when done.  Multi-process safe journal swapping is built into `qfputs`.
* locally checkpointed line is automatically synced to server after 10ms

Sample Server
----------------

    var QFputs = require('qfputs');
    var testlogWriter = new QFputs("testlog.log");

    var klogServer = klog.createServer({
        httpPort: 4244,
        qrpcPort: 4245,
        logs: {
            // each log needs methods write() and fflush()
            'Testlog': testlogWriter
        }
    },
    function(err) {
        // server is ready
    });

Sample Client
----------------

    var qlogger = require('qlogger');
    var logger = new qlogger('info');

    var klogClient = klog.createClient({
        qrpcPort: 4245,
        host: 'localhost',
    },
    function(err) {
        // client is connected

        logger.addWriter(klogClient);
        logger.addWriter(process.stdout);

        logger.info("testing");
        // "testing\n" written to testlog.log and stdout
    });

Performance
----------------

Measured the count of 200-byte newline terminated lines logged to the "remote"
server (another process running on the same host).

* up to 65 mb/s received and 45 mb/s persisted
* 2x performance gain from swapping packages (`request` is very slow)
* 20x throughput gain by also using a better protocol (one-way rpc vs http)
* 60-90x performance gain by working with async batches in near-realtime

Some test details:

* 200-byte newline terminated loglines
* timed both the time to receive (efficiency) and time to persist (speed) on server
* remote server running in another process on same host (just sockets, no network)
* klogClient separates the write from the ack; timed acks per 100, 1000 and 10000 lines

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


Status
----------------

Usable right now, though could use more unit tests.

* fully functional
* all logged lines show up in server log in order, no duplicates, no omissions
* good unit tests for server
* light unit tests for client
* no unit tests yet for client journaling mode

Lessons Learned
----------------

* 70 x speed differences are possible in the real world
* 3.5k/s is standard nodejs "best practices" state of the art
* understand your tools (eg request halves throughput)
* standardization is not always a win
* rpc is great!

Also,

* trust the libraries (bug was in the new code, not qbuffer)
* careful when benchmarking
  - 3-4gb files in a couple dozen seconds, a single test run
  - hard to measure file transport throughput
    - need several seconds for a good read, can be gigabytes
    - disk-based filesystems can stall while writing to disk
    - 6 gb memory-based filesystem /dev/shm filled up
    (workaround was to split the tests and run subsets separately)

Related Work
----------------

- [express](https://npmjs.com/package/express) - featureful REST framework
- [request](https://npmjs.com/package/request) - featureful but slow http request library
- [restiq](https://npmjs.com/package/restiq) - light-weight REST framework
- [qhttp](https://npmjs.com/package/qhttp) - fast convenience wrapper around `http`
- [qlogger](https://npmjs.com/package/qlogger) - very fast, very flexible logging
- [qrpc](https://npmjs.com/package/qrpc) - fast rpc
- [qfputs](https://npmjs.com/package/qfputs) - fast multi-writer safe file appender
