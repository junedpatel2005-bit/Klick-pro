export type ReportColumn<T> = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
  format: (row: T) => string;
};

export type ReportPageSize = "A4" | "LETTER";
export type ReportOrientation = "portrait" | "landscape";

export type ReportRequest = {
  scope: "all" | "selected";
  ids?: number[];
  pageSize?: ReportPageSize;
  orientation?: ReportOrientation;
};
