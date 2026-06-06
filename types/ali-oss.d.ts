declare module "ali-oss" {
  type OSSConstructorOptions = {
    region: string;
    endpoint?: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    secure?: boolean;
  };

  type PutOptions = {
    headers?: Record<string, string>;
  };

  type PutResult = {
    name?: string;
    url?: string;
    res?: unknown;
  };

  export default class OSS {
    constructor(options: OSSConstructorOptions);
    put(name: string, file: Buffer | string, options?: PutOptions): Promise<PutResult>;
  }
}
