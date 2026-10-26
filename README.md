# Block by Block

A small, interactive blockchain lab for teaching how transactions, proof of work, and linked block hashes fit together. It runs locally in the browser and uses real SHA-256 hashes through Web Crypto or a built-in local fallback. It does not connect to a wallet or use real cryptocurrency.

## Run it

From this directory, start a local server:

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173>. The browser stores this demo's chain in local storage. Use **Reset demo** to restore the two sample blocks.

Add a pretend transaction, mine a block, and use **Edit** on a transaction in an earlier block to see its fingerprint change and the following link fail validation. Mining difficulty controls how many leading zeros a new block's hash must have.
