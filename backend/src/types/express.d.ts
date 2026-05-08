// Khai báo lại Express.Multer.File để TypeScript nhận diện
// Fix lỗi: "Namespace 'global.Express' has no exported member 'Multer'" ts(2694)
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
        stream: import('stream').Readable;
      }
    }
    interface Request {
      file?: Multer.File;
      files?:
        | { [fieldname: string]: Multer.File[] }
        | Multer.File[];
    }
  }
}

export {};