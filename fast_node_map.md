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

Runs much faster (1 million inserts then 1 million deletes in .09 seconds, ie
11m/s insert/delete pairs).  But grows potentially without bound, because all
those undefined values still take up space, about 6 bytes each.  The more
deletions, the more memory leaked.

## Fix for the work-around:  copy to new hash

The two ways to actually free memory are to delete the property, or to delete
the whole object.  If we're not deleting properties, we can copy over the
hashed values into a new hash object, and discard the old object.

Sounds good, but we then run into another weakness of nodejs:  iterating an
object's properties is relatively slow.

        m = {}
        for (i=0; i<100000; i++) m[i] = i;
        for (i in m) ;

- 1m properties iterated at 4m/s (.246 sec; 100k at 2m/s; 10m at 4m/s)

Yikes.  We can populate the hash at 13m/sec, but reading out the keys is 3.5x
slower, 4m/sec.  If we want our function to support millions of calls per
second, we can't afford that slow of a low-level building block.

## Workaround for the fix:  remember keys

Nodejs arrays are very very fast; we can push 43.4 million values per second,
and we can iterate an array by index at 330m/sec (loop over 100 million
elements in .33 sec).

        a = new Array();
        for (i=0; i<10000000; i++) a.push(i);
        len = a.length;
        for (i=0; i<len; i++) ;

Aside: array usage tips:
- for fastest array performance use `new Array()` not `[]`
- push, do not append by index, it's 2x faster
- do not preallocate large arrays, growing them on demand is 2x faster
- if speed is important, test a local copy of `.length`, it's 10% faster.
- array.length can be assigned, it shortens the array but does not free memory
- `array.slice()` frees memory, but runs slower than setting length

Anyway, 43m/s insert rate and 330m/s iteration rate is very nice.  Instead of
looking up the keys in the hash, we can keep them in one of these fast arrays.
We may encounter a key more than once, depending on access patterns, but at
this speed it might not matter.  (Aside: `{}` and `new` objects insert at
14m/s and properties can be read at 240m/s for numbers `o[i]`, 370m/s for
members `o.a` and strings `o['a']`.  Hash indexes are always strings, and
numbers get converted.)

Aside: object usage tips:
- nodejs objects can be structs or hashes
- structs are optimized for access, are faster than hashes
- structs can not have too many insertions/deletions
- one can be converted into the other on the fly
- setting properties p on {} objects is slower
- setting pre-declared properties p on {p: null} is faster
- objects created with `new` get their properties struct-ized,
  both those set with this.property = value and inherited properties
- it is faster to test properties for truthy/falsy than for value
- it is faster to set a property to a number or string than to `null` or `undefined`

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
and use those.  Variables in local scope are faster to access and use than
object properties.  Also, note that we retain all keys that are
still live, even the duplicates.  This is faster for up to 4x duplication, then the
extra work will cost.  To avoid, use a hash to track the keys already seen,
and only copy a key once.  However, using the hash will slow the copy loop.
Which is better depends on the actual use case.)

This would almost work, but we repack on every delete once we hold 10k keys.
That would crush maps with many keys.  Bumping up the threshold would prevent
repacking.  We need a better heuristic.

##  Fix for the workaround: when to repack

It's worth noting that lots of keys are ok; what we don't want is lots of
holes.  Keys are essential; holes are just wasted memory.  So our heuristic
should track the count of holes (deletions), and if too many holes reclaim
space in bunches.

Also, not only should we avoid repacking too often, we need to avoid the
overhead of _checking whether to_ too often.  So the heuristic should track
when the last check was made, to not check again too soon.

...

## Fix to the repack: avoid blocking

Repacking runs uninterrupted, it does not yield.  Copying 2 million live keys
takes .3 seconds, which is a long time to block other threads.  We can't
really help this, the best we can do is avoid repacking while there are "too
many" keys live in the hash.

This means a further modification to the repack heuristic and tracking the
could of live items in the hash.  If we do not want repack to block longer
than 1-2ms, the number of live items should not be more than 10,000.

The number of live items can not be known precisely without enumerating the
hash (slow).  However, we can track insertions and deletions, and if they are
"well-behaved" (at most one deletion per insertion), the difference between
insertion and deletion counts roughly correspond to the live key count.


## Final Notes

Putting it all together, we get something like:


        /*
         * smarter map, defers the expensive deletes
         */
        function Map( ) {
            this.map = {};
            this.keys = new Array();
            this.insertCount = 0;
            this.deleteCount = 0;
            this.nextRepackCheck = 25000;
        }

        function Map_set( key, value ) {
            this.map[key] = value;
            this.keys.push(key);
            this.insertCount++;
        }
        Map.prototype.set = Map_set;

        function Map_get( key ) {
            return this.map[key];
        }
        Map.prototype.get = Map_get;

        function Map_delete( key ) {
            this.map[key] = 0;
            this.deleteCount++;
            this.nextRepackCheck--;

            // if hash has too many holes, repack it now to free space
            if (!this.nextRepackCheck) {
                // only repack when fewer than 10k live items remain, else we block too long
                // this in effect delays repacking until a quieter moment.
                // note: some usage can defeat this heuristic, eg insert a, b, c delete a, a, a
                // which would result in slower repacks (but less memory waste)
                if (this.deleteCount > 100000 && this.insertCount - this.deleteCount < 10000) {
                    this._repack();
                    this.nextRepackCheck = 100000;
                }
                else this.nextRepackCheck = 100000;
            }
        }
        Map.prototype.delete = Map_delete;

        function Map__repack( ) {
        var t1 = Date.now();
            var i, map = this.map, keys = this.keys, len = this.keys.length;
            var map2 = {}, live2 = [];
            for (i=0; i<len; i++) {
                var key = keys[i];
                // if keys are often reused, then copy over only keys/values not yet seen
                // however, if keys are used only once, there will be no duplicates
                // but if there are, up to 50% faster to skip them
                if (map[key] /*&& !map2[key]*/) {
                    map2[key] = this.map[key];
                    live2.push(key);
                }
            }
            this.map = map2;
            this.keys = live2;
            this.insertCount = live2.length;
            this.deleteCount = 0;
        console.log("AR: repack ms", Date.now()-t1);
        }
        Map.prototype._repack = Map__repack;
