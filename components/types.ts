export type { Space, Task, Priority, Status, ViewType } from '@/lib/constants';
import type { Priority, Status } from '@/lib/constants';
export type TaskInput0 = {
  space_id?: string;
  title?: string;
  description?: string;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
};
