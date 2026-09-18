import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { reportTheme } from "./theme";
import type { ReportColumn, ReportOrientation, ReportPageSize } from "./types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 100,
    paddingBottom: 56,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: reportTheme.ink,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: reportTheme.ink,
    paddingHorizontal: 32,
    paddingTop: 22,
  },
  brand: {
    fontSize: 9,
    fontWeight: "bold",
    color: reportTheme.cta,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 5,
    fontSize: 17,
    fontWeight: "bold",
    color: reportTheme.white,
  },
  meta: {
    marginTop: 5,
    fontSize: 8,
    color: "#cbd5e1",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    paddingHorizontal: 32,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: reportTheme.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: reportTheme.muted,
  },
  table: {
    marginTop: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: reportTheme.ink,
    borderRadius: 2,
  },
  tableHeaderCell: {
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    color: reportTheme.white,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: reportTheme.border,
  },
  tableRowAlt: {
    backgroundColor: reportTheme.zebra,
  },
  tableCell: {
    padding: 6,
    fontSize: 8,
  },
  empty: {
    padding: 16,
    fontSize: 9,
    color: reportTheme.muted,
    textAlign: "center",
  },
});

function formatGeneratedAt() {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(),
  );
}

export function ReportHeader({
  title,
  subtitle,
  generatedFor,
  filterSummary,
}: {
  title: string;
  subtitle: string;
  generatedFor?: string;
  filterSummary?: string;
}) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.brand}>Klick-Pro report</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {subtitle} · Generated {formatGeneratedAt()}
        {generatedFor ? ` · For ${generatedFor}` : ""}
        {filterSummary ? ` · ${filterSummary}` : ""}
      </Text>
    </View>
  );
}

export function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Klick-Pro · Confidential report</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function ReportTable<T>({ columns, rows }: { columns: ReportColumn<T>[]; rows: T[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={[
              styles.tableHeaderCell,
              { flexGrow: column.width, textAlign: column.align ?? "left" },
            ]}
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
          wrap={false}
        >
          {columns.map((column) => (
            <Text
              key={column.key}
              style={[
                styles.tableCell,
                { flexGrow: column.width, textAlign: column.align ?? "left" },
              ]}
            >
              {column.format(row)}
            </Text>
          ))}
        </View>
      ))}
      {rows.length === 0 && <Text style={styles.empty}>No records match this export.</Text>}
    </View>
  );
}

export function ReportDocument<T>({
  title,
  subtitle,
  generatedFor,
  filterSummary,
  columns,
  rows,
  pageSize = "A4",
  orientation = "portrait",
}: {
  title: string;
  subtitle: string;
  generatedFor?: string;
  filterSummary?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  pageSize?: ReportPageSize;
  orientation?: ReportOrientation;
}) {
  return (
    <Document title={title}>
      <Page size={pageSize} orientation={orientation} style={styles.page}>
        <ReportHeader
          title={title}
          subtitle={subtitle}
          generatedFor={generatedFor}
          filterSummary={filterSummary}
        />
        <ReportTable columns={columns} rows={rows} />
        <ReportFooter />
      </Page>
    </Document>
  );
}
