export const PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageArgs(page: number, size = PAGE_SIZE) {
  return { skip: (page - 1) * size, take: size };
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}
