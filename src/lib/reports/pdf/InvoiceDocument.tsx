import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { reportTheme } from "./theme";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: reportTheme.ink,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: reportTheme.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brandMarkText: {
    color: reportTheme.cta,
    fontSize: 13,
    fontWeight: "bold",
  },
  brandName: {
    fontSize: 12,
    fontWeight: "bold",
    color: reportTheme.ink,
  },
  brandTag: {
    fontSize: 8,
    color: reportTheme.muted,
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: reportTheme.ink,
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 9,
    color: reportTheme.muted,
    textAlign: "right",
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#15803d",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  divider: {
    height: 2,
    backgroundColor: reportTheme.cta,
    marginTop: 20,
    marginBottom: 20,
  },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  partyBlock: {
    width: "31%",
  },
  partyLabel: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: reportTheme.cta,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  partyName: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: reportTheme.ink,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 8.5,
    color: reportTheme.muted,
    marginTop: 1,
  },
  table: {
    marginTop: 28,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: reportTheme.ink,
    paddingBottom: 7,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: reportTheme.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: reportTheme.border,
    paddingVertical: 12,
  },
  descCol: { flexGrow: 3.4 },
  descTitle: { fontSize: 9.5, fontWeight: "bold", color: reportTheme.ink },
  descSub: { fontSize: 8, color: reportTheme.muted, marginTop: 2 },
  amountCol: { flexGrow: 1, textAlign: "right", fontSize: 9.5, color: reportTheme.ink },
  summaryWrap: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  summaryBox: {
    width: 230,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 9,
    color: reportTheme.muted,
  },
  summaryValue: {
    fontSize: 9,
    color: reportTheme.ink,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: reportTheme.border,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: reportTheme.ink,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: reportTheme.white,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: reportTheme.white,
  },
  noteBlock: {
    marginTop: 36,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: reportTheme.border,
  },
  noteTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: reportTheme.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 8.5,
    color: reportTheme.muted,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    paddingHorizontal: 40,
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
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export type InvoiceParty = {
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
};

export function InvoiceDocument({
  invoiceNumber,
  issuedAt,
  status,
  description,
  from,
  billedTo,
  paidTo,
  grossAmount,
  commissionAmount,
  netAmount,
  currency,
  paymentReference,
}: {
  invoiceNumber: string;
  issuedAt: Date;
  status: string;
  description: string;
  from: { name: string; tagline?: string };
  billedTo: InvoiceParty;
  paidTo: InvoiceParty;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  paymentReference?: string | null;
}) {
  const money = (amount: number) => `${currency} ${amount.toLocaleString("en-IN")}`;

  return (
    <Document title={`Invoice ${invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>K</Text>
            </View>
            <Text style={styles.brandName}>{from.name}</Text>
            {from.tagline ? <Text style={styles.brandTag}>{from.tagline}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={styles.invoiceNumber}>Issued {formatDate(issuedAt)}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Billed to</Text>
            <Text style={styles.partyName}>{billedTo.name}</Text>
            {billedTo.email ? <Text style={styles.partyLine}>{billedTo.email}</Text> : null}
            {billedTo.phone ? <Text style={styles.partyLine}>{billedTo.phone}</Text> : null}
            {billedTo.address ? <Text style={styles.partyLine}>{billedTo.address}</Text> : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Paid to</Text>
            <Text style={styles.partyName}>{paidTo.name}</Text>
            {paidTo.email ? <Text style={styles.partyLine}>{paidTo.email}</Text> : null}
            {paidTo.phone ? <Text style={styles.partyLine}>{paidTo.phone}</Text> : null}
            {paidTo.address ? <Text style={styles.partyLine}>{paidTo.address}</Text> : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Payment</Text>
            <Text style={styles.partyLine}>Reference: {paymentReference ?? "—"}</Text>
            <Text style={styles.partyLine}>Currency: {currency}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.descCol]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.amountCol]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.descCol}>
              <Text style={styles.descTitle}>{description}</Text>
              <Text style={styles.descSub}>Gross payment collected from client</Text>
            </View>
            <Text style={styles.amountCol}>{money(grossAmount)}</Text>
          </View>
        </View>

        <View style={styles.summaryWrap}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Gross amount</Text>
              <Text style={styles.summaryValue}>{money(grossAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform commission</Text>
              <Text style={styles.summaryValue}>-{money(commissionAmount)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net payable</Text>
              <Text style={styles.totalValue}>{money(netAmount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.noteBlock}>
          <Text style={styles.noteTitle}>Note</Text>
          <Text style={styles.noteText}>
            This invoice reflects a milestone payment processed through the Klick-Pro marketplace.
            The net payable amount is the sum released to the professional after deducting the
            platform commission from the gross amount collected from the client.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Klick-Pro · Confidential invoice</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
