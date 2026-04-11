export type InitialScheduleSegmentSeed = {
  code: string;
  name: string;
  description: null;
  status: "open";
  sortOrder: number;
};

export function buildInitialScheduleSegments(count: number): InitialScheduleSegmentSeed[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Initial schedule segment count must be a positive integer.");
  }

  const width = Math.max(2, String(count).length);

  return Array.from({ length: count }, (_, index) => {
    const sortOrder = index + 1;

    return {
      code: String(sortOrder).padStart(width, "0"),
      name: `第 ${sortOrder} 段`,
      description: null,
      status: "open",
      sortOrder,
    };
  });
}
