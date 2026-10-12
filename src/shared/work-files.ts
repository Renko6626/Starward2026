import { z } from "zod";
import type { EventWindowSummary } from "./windows";

export const WORK_FILE_MAX_SIZE = 500 * 1024 * 1024;
export const WORK_FILE_PART_SIZE = 8 * 1024 * 1024;

export const createWorkFileSchema = z.object({
  filename: z.string().trim().min(1).max(255).regex(/^[^\u0000-\u001f\u007f/\\]+$/, "文件名不能包含路径或控制字符。"),
  size: z.number().int().min(1, "请选择非空文件。").max(WORK_FILE_MAX_SIZE, "单个文件不能超过 500 MB。"),
  contentType: z.string().trim().max(200).optional(),
});

export type WorkFile = {
  id: string;
  filename: string;
  size: number;
  contentType?: string;
  createdAt: string;
};

export type WorkFilesResponse = { files: WorkFile[]; window: EventWindowSummary };
export type WorkFileUpload = { id: string; partSize: number };

export function formatWorkFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
