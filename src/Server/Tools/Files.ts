import * as fs from 'fs';

/** Delete a file asynchronously. Can throw. */
export function DeleteFile(path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.unlink(
      path,
      (err) => {
        if(err) reject(err);
        else resolve();
      }
    );
  });
}

/** Asynchronously read a file buffer. */
export function ReadFileBuffer(path: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    fs.readFile(
      path,
      (err, data) => {
        if(err) reject(err);
        else resolve(data);
      }
    )
  });
}

/** Does the specified file exist? */
export function Exists(path: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    fs.exists(path, resolve);
  });
}
