# nodejs-efz
NodeJS ready-to-run server combining pug rendering, an expressjs server and CQL database. The focus is on extensibility, maintainability while supporting generic use cases.

Main features;
- Simple CQL (Cassandra or Scylla) integration with automatic Keyspace and Table creation. Define tables and they will be created.
- Extensions for the expressjs RequestHandler structure to simplify building permission-based access to resources.
- BlobStream for storing content to and retrieving content from a connected CQL database.
- Web pages and content stored on the file-system is auto-updated.
- Command-line handling that enables one-line subscription to user input.
- Example routes include; login, create login, manage logins, manage content and a content download api endpoint secured by basic authentication.
- Smooth, scalable and prioritized application start and end.

## Examples
Blob Streaming
```typescript

Promise.all([
  BlobStream.Create(Blobs, name),
  fs.createReadStream('/some/path/to/file.webm', { autoClose: true })
])
.then((values: [BlobStream, fs.ReadStream]) => {
  // store some metadata describing the blob
  values[0].Blob.Metadata = { 'mimetype': 'video/webm' };
  // pipe the file to the blob
  values[1].pipe(values[0], { end: true });
});

```

## EFZ - Efficient, Focused, Zen
This codebase and the tools therein should be easy to understand, fast and easily extensible.

## Roadmap
- Trim and separate codebase into modules.
- Add SSL example.
- Implement metrics manager with useful server statistics.


## License

This project is licensed under the MIT license.

Copyrights on the definition files are respective of each contributor listed at the beginning of each definition file.
