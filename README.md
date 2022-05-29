# Nested CRDT Tools

Provides tools to use with the `nest-crdt` package,
implementing a `MessageHandler` (see `CachedMessageHandler`),
which allows for different broadcasts (see `MessageDistributor`).
Implementations for some broadcasts are also provided,
which usually rely on a network (see `Network`),
for which also exist some implementations.

Additionally, a wrapper for managing CRDTs is also provided,
offering a simple interface to create or request CRDTs
(see `CRDTManager`).


## Broadcasts

Following broadcasts are implemented:
- Best-Effort-Broadcast (see `BestEffortMessageDistributor`)
- Byzantine-Fault-Tolerant Reliable-Broadcast (see `ReliableMessageDistributor`)
- Some other implementations, which allow for local distribution (see `LocalMessageDistributor`),
  or easier implementation of broadcast algorithms (see `NetworkMessageDistributor`),
  and an abstract implementation, which handles listeners (see `GeneralMessageDistributor`)


## Networks

Following networks are implemented:
- `TCPNetwork`
- `EncryptedTCPNetwork`
- An `HTTPNetwork` can be found in the `nest-crdt-tools-http` package
  (segregated due to its reliance on `express`)


## Example

A usage example can be found in the `nest-crdt-example` package.


## Building

To build this project first run `npm install` to install the node libraries,
then run `npm run build`, to invoke the TypeScript compiler.
