export interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password?: string | null;
  from_name: string;
}

export interface AutopilotSettings {
  enabled: boolean;
}
