export interface FolderV2 {
  id: string;
  name: string;
  end_goal: string;
  completed: number; // 0 | 1
  created_at: string;
  completed_at: string | null;
  last_log: string | null;
  last_touched: string;
}

export interface TaskV2 {
  id: string;
  block_id: string;
  text: string;
  done: number; // 0 | 1
  done_at: string | null;
  position: number;
  created_at: string;
}

export interface LogV2 {
  id: string;
  folder_id: string;
  block_id: string;
  text: string;
  created_at: string;
}

export interface BlockV2 {
  id: string;
  folder_id: string;
  name: string;
  goal: string | null;
  position: number;
  is_scratchpad: number; // 0 | 1
  created_at: string;
  tasks: TaskV2[];
  logs: LogV2[];
  total_duration_seconds?: number;
}
