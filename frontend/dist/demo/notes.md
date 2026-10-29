# Nimbus - implementation notes

Storage backend: the user's own Telegram account (MTProto).

- parts: 100 MiB, one message per part
- blocks: 1 MiB, AES-256-GCM, unique nonce per block
- compression: zstd, applied only when the sample saving exceeds 5%

## Search

The query is encoded locally and compared against stored vectors with cosine
similarity. Filename matches are blended into the final score.
