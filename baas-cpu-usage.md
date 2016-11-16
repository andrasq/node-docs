Same BaaS, 60% Less CPU
=======================

Our servers were being hit with peaky traffic that was triggering cpu alerts, so we
decided to dig in and see if we could find a way of reducing the per-call cpu usage.


Investigation
-------------

We were especially interested in a particular call that was by far the most common,
so we started by taking a look at the broad flow of this call as it executed.
It made several http calls in turn to internal services, and one call to an
external off-site service.

Our service was already instrumented and was logging the amount of cpu consumed
during the course of a call, and though peak call rate exceeded 20 per second, at the
tail end of each burst the calls were spread out enough to not overlap and we could
see that each was using 20 milliseconds of cpu.


Analysis
--------

We started by writing a few little scripts to exercise parts of the code that seemed
to do substantial work:  making web requests and converting data.  This turned out to
have been a good guess, because indeed, these accounted for the bulk of the time.
Just a few isolated calls accounted for 18.6 of the 20 ms.

- *7.5 ms*: 5 db metadata http lookups at 1.5 ms each
- *1 ms*: json decode of 78k of metadata (2 large objects)
- *4.5 ms*: 3 db authentication http accesses (auth token and user), 1.5 ms each
- *5.6 ms*: 1 external https service call using `request`

The remaining 1.4 ms includes decoding parameters, routing the call, encoding the
response, and updating multiple logfiles, just a little time spent in each of many
different functions, and we did not investigate these in more detail.

The timing information suggested areas to explore:  speedup available from reusing
connections, opportunities for caching, and timing the overhead of the `request`
module when making https requests.  A series of small exploratory code snippets were
used to find numerical answers.

Connection Reuse

The current nodejs includes an `http.Agent` that makes reusing connections simple,
and the `request` module accepts a connection Agent to use with calls.  This was
the easiest, quickest change to try.  Test timings indicated:

- reusing connection for db http calls: 1.5 ms -> 1.0 ms, save 0.5 ms (8x, *4 ms* total)
- reusing connection for https calls: 4.3 ms -> 2.4 ms
- reusing connection on https:// `request` calls: 5.6 ms -> 3.2 ms, save *2.4 ms*

Using Node To Make Https Calls

Running a few test calls, we observed that the `request` module adds some overhead to
the underlying nodejs `https` call.  Since our use case was simple and did not rely
on any of the convenience features provided by `request`, it was easy to write a small
wrapper around https ([k-http](https://github.com/andrasq/node-k-http)), and have
the code use the wrapper instead of `request`.

- using node for https calls: 3.2 ms -> 2.4 ms over reused connection, save another *0.8 ms*

Metadata Caching

The app metadata is environment specific, the same for every call in an environment,
and changes very rarely.  It is a prime target for caching.  We could see that during
peak traffic periods, when it matters, even a short 5-second timeout cache could
capture 99% of the metadata requests.

- omit 5 db calls 99% of the time, save another *5 ms* total
- omit 1 json decode 99% of the time, save another *1 ms*

All in all, these few relatively small changes looked to save 13.2 ms (4 +
2.4 + 0.8 + 5 + 1), or 66% of the 20 ms cpu used per call.


Implementation
--------------

At this point we had accounted for 18.6 seconds of the 20 ms cpu usage, and
identified 13.2 cpu seconds of potential savings.

The changes were straightforward:  adding a `keepAlive` config option to our db
library, layering a cache in front of the metadata fetches, and replacing `request`
with a thin wrapper.

The results look really promising.  Overall cpu usage went down by 25% and lowered
network traffic by more than 80%.  We did have to fix an integration glitch where
we didn't notice that the code was modifying the now shared metadata object, and
we are currently looking for a workaround for a node-v6.9.1 memory management
glitch that breaks the service, but this approach still looks viable.


Lessons Learned
---------------

Know Your Tools

Tools perform a function at cost.  Understanding the cost (cpu, memory overhead) is
an important part of using the tool.

Convenience Has A Price

Tools that offer convenience at the cost of efficiency can become a trap, embedding
inefficiencies that could be much harder to remove after the fact.  We were lucky
that in our case the entanglements were minor.

Implementation Details Matter

Just because a tool is only being used for pass-through functionality does not mean
that the overhead it adds is negligible.  A leaner pass-through will be faster.

Know Your Platform

Throughout it all, we were taking nodejs for granted.  Much to our surprise, the
great results we saw under node-v6.2.2 broke under node-v6.9.1; the heap balloons and
the code core dumps.  This one is still a work in progress -- apparently the newer
node gathers many dead objects in old object space, does not garbage collect them,
and crashes on a memory allocation error.  The identical code runs fine under 6.2.2.


Future Work
-----------

Now that the low-hanging fruit has been identified, how can it be made yet faster?

- If the db api were modified to allow combining the 3 auth-related calls (as with a
  new special-purpose function or some new macro ability) 2 more ms could be saved.

- Some of the logging functions could be replaced with more efficient variants.

- Call routing and parameter decoding could be replaced with more efficient variants.

- The 2.4 ms https external call could be moved out into a sub-service accessed via a
  more efficient api (eg over a multiplexed static connection like
  [qrpc](https://github.com/andrasq/node-qrpc)), the https caller could be optimized
  separately or even be implemented polyglot, in a more efficient language.
