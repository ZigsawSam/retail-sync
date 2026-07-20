export interface SmsLog {
  id: string;
  agentName: string;
  agentPhone: string;
  message: string;
  timestamp: string;
  status: string;
}

export const smsLog: SmsLog[] = [];