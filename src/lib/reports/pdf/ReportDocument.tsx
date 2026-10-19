import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { reportTheme } from "./theme";
import { getBrandLogoBase64 } from "./brand-logo";
import type { ReportColumn, ReportOrientation, ReportPageSize } from "./types";

export type ReportSummaryStat = {
  label: string;
  value: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 50,
    paddingHorizontal: 32,
    fontSize: 8.5,
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
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  brandCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  logoBox: {
    width: 28,
    height: 28,
    backgroundColor: reportTheme.white,
    borderRadius: 6,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 22,
    height: 22,
    objectFit: "contain",
  },
  brandName: {
    fontSize: 11,
    fontWeight: "bold",
    color: reportTheme.white,
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: reportTheme.cta,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    fontSize: 14.5,
    fontWeight: "bold",
    color: reportTheme.white,
  },
  headerRight: {
    alignItems: "flex-end",
    minWidth: 160,
  },
  confidentialBadge: {
    backgroundColor: "#1e293b",
    borderWidth: 0.8,
    borderColor: "#334155",
    borderRadius: 3,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    marginBottom: 4,
  },
  confidentialText: {
    fontSize: 6.8,
    fontWeight: "bold",
    color: "#38bdf8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  meta: {
    fontSize: 7.2,
    color: "#cbd5e1",
    lineHeight: 1.35,
    textAlign: "right",
  },
  accentBar: {
    position: "absolute",
    top: 84,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: reportTheme.cta,
  },
  summaryRibbon: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: reportTheme.zebra,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: reportTheme.border,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: reportTheme.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: reportTheme.ink,
    marginTop: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    paddingHorizontal: 32,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: reportTheme.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7.5,
    color: reportTheme.muted,
  },
  table: {
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: reportTheme.ink,
    borderRadius: 3,
  },
  tableHeaderCell: {
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    fontSize: 7.2,
    fontWeight: "bold",
    color: reportTheme.white,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: reportTheme.border,
  },
  tableRowAlt: {
    backgroundColor: reportTheme.zebra,
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 7.5,
    color: "#1e293b",
  },
  empty: {
    padding: 16,
    fontSize: 8.5,
    color: reportTheme.muted,
    textAlign: "center",
  },
});

function formatGeneratedAt() {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
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
  const brandLogo = getBrandLogoBase64();
  return (
    <>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <View style={styles.brandCapsule}>
            <View style={styles.logoBox}>
              {brandLogo ? (
                <Image src={brandLogo} style={styles.logoImage} />
              ) : (
                <Text style={{ fontSize: 9, fontWeight: "bold", color: reportTheme.ink }}>KP</Text>
              )}
            </View>
            <View>
              <Text style={styles.brandName}>KLICK-PRO</Text>
              <Text style={styles.brandSub}>Financial Ledger & Audit Division</Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.confidentialBadge}>
            <Text style={styles.confidentialText}>Confidential Audit</Text>
          </View>
          <Text style={styles.meta}>Generated: {formatGeneratedAt()} IST</Text>
          {generatedFor ? <Text style={styles.meta}>Auditor: {generatedFor}</Text> : null}
          {filterSummary ? <Text style={styles.meta}>Scope: {filterSummary}</Text> : null}
        </View>
      </View>
      <View style={styles.accentBar} fixed />
    </>
  );
}

export function ReportSummaryStrip({ stats }: { stats: ReportSummaryStat[] }) {
  if (!stats || stats.length === 0) return null;
  return (
    <View style={styles.summaryRibbon}>
      {stats.map((stat, idx) => (
        <View key={idx} style={styles.statBox}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <Text style={styles.statValue}>{stat.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Klick-Pro Enterprise Platform · Official Compliance & Financial Audit Record
      </Text>
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
              {
                flexGrow: column.width,
                flexBasis: 0,
                flexShrink: 1,
                textAlign: column.align ?? "left",
              },
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
          {columns.map((column) => {
            const formatted = column.format(row);
            const displayValue =
              formatted !== null && formatted !== undefined && formatted !== ""
                ? String(formatted)
                : "—";
            return (
              <Text
                key={column.key}
                style={[
                  styles.tableCell,
                  {
                    flexGrow: column.width,
                    flexBasis: 0,
                    flexShrink: 1,
                    textAlign: column.align ?? "left",
                  },
                ]}
              >
                {displayValue}
              </Text>
            );
          })}
        </View>
      ))}
      {rows.length === 0 && <Text style={styles.empty}>No records match this audit export.</Text>}
    </View>
  );
}

export function ReportDocument<T>({
  title,
  subtitle,
  generatedFor,
  filterSummary,
  summaryStats,
  columns,
  rows,
  pageSize = "A4",
  orientation = "portrait",
}: {
  title: string;
  subtitle: string;
  generatedFor?: string;
  filterSummary?: string;
  summaryStats?: ReportSummaryStat[];
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
        {summaryStats && summaryStats.length > 0 ? (
          <ReportSummaryStrip stats={summaryStats} />
        ) : null}
        <ReportTable columns={columns} rows={rows} />
        <ReportFooter />
      </Page>
    </Document>
  );
}
