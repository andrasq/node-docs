BSON Data Format
================

It is can be useful to be able to manipulate BSON entities without having to
decode them into objects.  Luckily, this happens to be pretty easy.

BSON Objects
------------

A BSON object is a byte-counted list of concatenated binary records, each
record being a typed, byte-counted value.

BSON Object:

- 4B total length
- length-4-1 B for list of records
- 1B zero byte NUL terminator

Each Record:

- 4B total length
- 1B type
- *B field name (variable length, NUL terminated)
- 1B zero byte as name terminator
- *B value (variable, based on type)
  - 0B null
  - 4B int32
  - 8B ieee float
  - 1B boolean
  - 4B len + len-1 B string + 1B NUL terminator
  - 4B len + len-5 B object of values + 1B NUL terminator
  - 4B len + len-5 B array of values + 1B NUL terminator (names are numbers)

It so happens that the layout of a BSON object is the same as the value part
of an object type record.

### Examples

        {p: null}

        [ 0c 00 00 00  07 00 00 00 0a 70 00  00 ]
          ^ 12B object, total, including NUL object terminator
          ^ 4B BSON object length field (12)
                                             ^ BSON object NUL byte terminator
                       ^ 7B null object length = 4B length + 1B type + 1B name + 1B NUL
                       ^ 4B entity length field (7)
                                   ^ entity type "NULL"
                                      ^ entity name "p"
                                         ^ entity name NUL byte terminator

Mongodump
---------

Mongodump outputs the documents in the collection as a concatenated list of
bson objects.  Reading the mongodump output file as a byte stream, it is
possible to separate the first object by reading the length from the first
four bytes, to separate the second object by reading the first four bytes
following the first object, and so on the rest of the objects.
