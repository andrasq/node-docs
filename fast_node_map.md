How To Build A Fast Nodejs Map
==============================

2014-12-12 - AR.

A key-value mapping in nodejs should be trivial, just an object as a hash.  A
fast key-value store, however, is surprisingly tricky to build.

This is the story, a detective story of sorts, of tracking down a
high-performance key-value map implementation.

## Hashes are built in

First idea:  nodejs has built-in hashes, just what we need, perfect!

Hashes are very fast to insert and update.  Hashes are very simple.  This is
what the code would look like:

        function Map0( ) {
            this._hash = {};
        }
        Map0.prototype.set = function Map0_put( key, value ) {
            this._hash[key] = value;
        };
        Map0.prototype.get = function Map0_get( key ) {
            return this._hash[key];
        };
        Map0.prototype.delete = function Map0_delete( key ) {
            delete this._hash[key];
        };
                
Minor point:  note how the values are stored in a hash inside the object; this
runs much faster than setting them as properties on the object itself.

Simple, and efficient too, one should think, using a language feature.  Wrong:

Map implemented with a native nodejs hash:
- insert/dele pairs, 100k:  (1m: 2.3m/s)
- inserts only, 100k: 25m / s (1m: 13m/s)
- deletes only, 100k: 1.095 sec 100k/s, ms (1m: 664.5 sec, 150/s)

Yikes!  We can insert 1 million items into a nodejs hash in 1 second, but
deleting them back-to-back takes over 10 minutes!?  That's 100,000 times
slower.  No idea what node is doing during this time, but it's using 100% of
the cpu.  Perhaps a garbage collection anomaly like when shifting very large
arrays; don't know. The test is trivial, basically variations on:

        m = new Map0();
        for (i=0; i<100000; i++) { m.set(i, i); m.delete(i); }
        for (i=0; i<100000; i++) m.set(i, i);
        for (i=0; i<100000; i++) m.delete(i);

Deletion is slower than insertion by five orders of magnitude! This makes
hashes unusable for anything that deletes often.

But the only support available in node for named value lookups is objects {},
ie hashes.  So we can't avoid using them -- how can we avoid the delete?

## Simple work-around: unset

We can un-set values instead of deleting them; that's much faster:

        Map0.prototype.delete = function Map0_delete( key ) {
            this._hash[key] = undefined;
        }

Runs much faster (1 million inserts then 1 million deletes in .09 seconds).
But grows potentially without bound, because all those undefined values take
up space.  The more deletions, the more memory leaked.

## Fix for the work-around:  copy to new hash

The two ways to actually free memory are to delete the property, or to delete
the whole object.  If we're not deleting properties, we can copy over the
hashed values into a new hash object, and discard the old object.

Sounds good, but we then run into another weakness of nodejs:  iterating an
object's properties can be slow.

        for (i in m) ;

- 1m properties iterated at 4m/s (.246 sec; 100k at 2m/s; 10m at 4m/s)

Yikes.  We can populate the hash at 14m/sec, but reading out the keys is 3.5x
slower, 4m/sec.

## Fix for the fix:  remember keys

Nodejs arrays are very very fast; we can push 17.7 million values per second,
and we can iterate an array by index at 300m/sec (loop 100 million elements in
.33 sec).

        a = new Array();
        for (i=0; i<10000000; i++) a.push(i);
        len = a.length;
        for (i=0; i<len; i++) ;

Minor point:  for fastest array performance use `new Array()` not `[]`.  Push,
do not append by index, it's 2x faster.  Do not preallocate large arrays,
growing them on demand is 2x faster.  And if speed is of the utmost, iterate
over a local copy of a.length, it's 10% faster.

Anyway, 43m/s insert rate and 330m/s iteration rate is impressive.  Instead of
looking up the keys in the hash, we can keep them in one of these fast arrays.
We may encounter a key more than once, depending on access patterns, but at
this speed it might not matter.  (Aside: `{}` and `new` objects insert at
14m/s and properties can be read at 240m/s for numbers `o[i]`, 370m/s for
members `o.a` and strings `o['a']`.  Hash indexes are always strings, and
numbers get converted.)

So we change our code again:

        function Map0( ) {
            this._hash = {};
            this._keys = [];
        }
        Map0.prototype.set = function Map0_put( key, value ) {
            this._hash[key] = value;
            this._keys.push(key);
        };

This way we have the information we need to copy the values:

        Map0.prototype.delete = function Map0_delete( key ) {
            delete this._hash[key];
            if (this._keys.length > 10000) this._repack();
        };
        Map0.prototype._repack = function( ) {
            var i, len = this._keys.length;
            var newHash = {}, newKeys = new Array();
            for (i=0; i<len; i++) {
                var key = this._keys[i];
                if (this._hash[key] !== undefined) {
                    newHash[key] = this._hash[key];
                    newKeys.push(key);
                }
            }
            this._hash = newHash;
        };

(Actually, for really fast code we would copy properties into local variables
and access those.  Variables in local scope are faster to access and use than
object properties.  Also, note that we retain the list of all keys that are
still live, even the duplicates.  This is faster up 4x duplication, then the
extra work will cost.  To avoid, use a hash to track the keys already seen,
and only copy a key once.  However, using the hash will slow the copy loop.
Which is appropriate depends on the use case.)

This would work, except for the bit about repacking once we've seen 10k keys.
That will kill performance for hashes that store many keys.  Bumping up the
threshold would prevent repacking.  We need a better heuristic.

##  Fix for the fix for the fix: when to repack

