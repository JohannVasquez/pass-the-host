export interface AppConfig {
  r2: {
    endpoint: string;
    access_key: string;
    secret_key: string;
    bucket_name: string;
    region: string;
  };
  server: {
    server_path: string;
    java_path: string;
    server_jar: string;
    server_type: string;
    memory_min: string;
    memory_max: string;
    server_port: number;
  };
  app: {
    owner_name: string;
  };
}
