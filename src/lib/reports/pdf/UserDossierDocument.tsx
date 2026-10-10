import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { reportTheme } from "./theme";

export type UserDossierJob = {
  id: number;
  title: string;
  category: string;
  budget: string;
  status: string;
  createdAt: string;
};

export type UserDossierProposal = {
  id: number;
  jobId: number;
  jobTitle: string;
  category: string;
  bidAmount: string;
  status: string;
  createdAt: string;
};

export type UserDossierData = {
  userId: number;
  username?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  daysActive: number;
  location?: string | null;
  companyName?: string | null;
  walletBalance: number;
  totalTopUp: number;
  totalWithdrawals: number;
  jobs: UserDossierJob[];
  proposals: UserDossierProposal[];
  completedProjectsCount: number;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 52,
    paddingHorizontal: 32,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    lineHeight: 1.4,
    color: reportTheme.ink,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 82,
    paddingHorizontal: 32,
    paddingTop: 18,
    backgroundColor: reportTheme.ink,
  },
  brand: {
    color: reportTheme.cta,
    fontSize: 8.5,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    marginTop: 4,
    color: reportTheme.white,
    fontSize: 15,
    fontWeight: "bold",
  },
  headerMeta: {
    marginTop: 3,
    color: "#cbd5e1",
    fontSize: 7.5,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    paddingHorizontal: 32,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: reportTheme.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    color: reportTheme.muted,
    fontSize: 7.2,
  },
  hero: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 6,
    backgroundColor: reportTheme.zebra,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: reportTheme.ink,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  roleBadge: {
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: reportTheme.primary,
  },
  roleText: {
    color: reportTheme.white,
    fontSize: 7,
    fontWeight: "bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statusBadge: {
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: "#dcfce7",
  },
  statusBadgeSuspended: {
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  statusText: {
    color: "#15803d",
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statusTextSuspended: {
    color: "#b91c1c",
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  kycBadge: {
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: "#e0f2fe",
  },
  kycBadgeUnverified: {
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  kycText: {
    color: "#0369a1",
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  kycTextUnverified: {
    color: "#64748b",
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: reportTheme.cta,
    color: reportTheme.ink,
    fontSize: 9.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  gridCellThird: {
    width: "33.333%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  gridCellHalf: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  label: {
    color: reportTheme.muted,
    fontSize: 6.8,
    fontWeight: "bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  value: {
    marginTop: 1.5,
    color: reportTheme.ink,
    fontSize: 8.2,
    fontWeight: "bold",
  },
  valueMono: {
    marginTop: 1.5,
    color: reportTheme.ink,
    fontSize: 8.2,
  },
  financeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  financeBox: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 6,
    backgroundColor: reportTheme.white,
  },
  financeLabel: {
    color: reportTheme.muted,
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  financeAmount: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "bold",
    color: reportTheme.primary,
  },
  table: {
    marginTop: 4,
  },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: reportTheme.ink,
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: reportTheme.white,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: reportTheme.border,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: reportTheme.zebra,
  },
  tableCell: {
    fontSize: 7.8,
    color: reportTheme.ink,
  },
  emptyNote: {
    padding: 10,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 4,
    color: reportTheme.muted,
    fontSize: 7.8,
    textAlign: "center",
  },
});

export function UserDossierDocument({ data }: { data: UserDossierData }) {
  const isClient = data.role === "CLIENT";

  return (
    <Document
      title={`User Audit #${data.userId} - ${data.firstName} ${data.lastName}`}
      author="Klick-Pro Administration"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Header - Role specific title, showing ONLY client or ONLY professional */}
        <View style={styles.header} fixed>
          <Text style={styles.brand}>
            {isClient
              ? "KLICK-PRO · CLIENT AUDIT DOSSIER"
              : "KLICK-PRO · PROFESSIONAL AUDIT DOSSIER"}
          </Text>
          <Text style={styles.headerTitle}>
            {isClient
              ? "Client Account & Marketplace Project Audit"
              : "Professional Identity, Proposals & Settlement Audit"}
          </Text>
          <Text style={styles.headerMeta}>
            Account Ref: #USR-{data.userId} · Confidential Compliance Record · Generated on{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Hero Section */}
        <View style={styles.hero} wrap={false}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>
                {data.firstName} {data.lastName}
                {data.username ? ` (@${data.username})` : ""}
              </Text>
              <Text style={{ fontSize: 7.8, color: reportTheme.muted, marginTop: 2 }}>
                Registered on {data.createdAt} · {data.daysActive} days active on platform
              </Text>
            </View>

            <View style={styles.badgesRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{data.role}</Text>
              </View>
              <View style={data.isActive ? styles.statusBadge : styles.statusBadgeSuspended}>
                <Text style={data.isActive ? styles.statusText : styles.statusTextSuspended}>
                  {data.isActive ? "ACTIVE" : "SUSPENDED"}
                </Text>
              </View>
              <View style={data.isVerified ? styles.kycBadge : styles.kycBadgeUnverified}>
                <Text style={data.isVerified ? styles.kycText : styles.kycTextUnverified}>
                  {data.isVerified ? "KYC VERIFIED" : "UNVERIFIED"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account & Contact Profile */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Account Profile & Contact Information</Text>
          <View style={styles.grid}>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Account ID</Text>
              <Text style={styles.value}>#USR-{data.userId}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Username</Text>
              <Text style={styles.valueMono}>
                {data.username ? `@${data.username}` : "Not configured"}
              </Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.value}>
                {data.firstName} {data.lastName}
              </Text>
            </View>

            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.valueMono}>{data.email}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.valueMono}>{data.phone || "Not provided"}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Platform Tenure</Text>
              <Text style={styles.value}>{data.daysActive} days active</Text>
            </View>

            {data.location && (
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>Location / Address</Text>
                <Text style={styles.value}>{data.location}</Text>
              </View>
            )}
            {data.companyName && (
              <View style={styles.gridCellHalf}>
                <Text style={styles.label}>Organization / Business</Text>
                <Text style={styles.value}>{data.companyName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Financial Overview (Balance, Top-up, Withdrawals) */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Wallet & Financial Ledger Overview</Text>
          <View style={styles.financeRow}>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Current Wallet Balance</Text>
              <Text style={styles.financeAmount}>
                INR {data.walletBalance.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Total Wallet Top-Ups</Text>
              <Text style={[styles.financeAmount, { color: "#16a34a" }]}>
                INR {data.totalTopUp.toLocaleString("en-IN")}
              </Text>
            </View>
            <View style={styles.financeBox}>
              <Text style={styles.financeLabel}>Total Withdrawals / Payouts</Text>
              <Text style={[styles.financeAmount, { color: "#d97706" }]}>
                INR {data.totalWithdrawals.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        </View>

        {/* Activity Section: Posted Jobs (for client) or Proposals/Bids (for professional) */}
        {isClient ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              Marketplace Jobs Posted ({data.jobs.length})
            </Text>

            {data.jobs.length === 0 ? (
              <Text style={styles.emptyNote}>
                No jobs have been posted by this client account.
              </Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableHeaderCell, { width: "15%" }]}>Job #</Text>
                  <Text style={[styles.tableHeaderCell, { width: "40%" }]}>Project Title</Text>
                  <Text style={[styles.tableHeaderCell, { width: "18%" }]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}>
                    Budget
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: "12%", textAlign: "right" }]}>
                    Status
                  </Text>
                </View>
                {data.jobs.map((job, idx) => (
                  <View
                    key={job.id}
                    style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  >
                    <Text style={[styles.tableCell, { width: "15%", fontFamily: "Helvetica-Bold" }]}>
                      #JOB-{job.id}
                    </Text>
                    <Text style={[styles.tableCell, { width: "40%" }]}>{job.title}</Text>
                    <Text style={[styles.tableCell, { width: "18%" }]}>{job.category}</Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      {job.budget}
                    </Text>
                    <Text style={[styles.tableCell, { width: "12%", textAlign: "right" }]}>
                      {job.status}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              Proposals & Bids Submitted ({data.proposals.length})
            </Text>

            {data.proposals.length === 0 ? (
              <Text style={styles.emptyNote}>
                No proposals or bids have been submitted by this professional.
              </Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableHeaderCell, { width: "15%" }]}>Bid #</Text>
                  <Text style={[styles.tableHeaderCell, { width: "40%" }]}>Job Title</Text>
                  <Text style={[styles.tableHeaderCell, { width: "18%" }]}>Category</Text>
                  <Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}>
                    Bid Amount
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: "12%", textAlign: "right" }]}>
                    Status
                  </Text>
                </View>
                {data.proposals.map((prop, idx) => (
                  <View
                    key={prop.id}
                    style={idx % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  >
                    <Text style={[styles.tableCell, { width: "15%", fontFamily: "Helvetica-Bold" }]}>
                      #BID-{prop.id}
                    </Text>
                    <Text style={[styles.tableCell, { width: "40%" }]}>{prop.jobTitle}</Text>
                    <Text style={[styles.tableCell, { width: "18%" }]}>{prop.category}</Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      {prop.bidAmount}
                    </Text>
                    <Text style={[styles.tableCell, { width: "12%", textAlign: "right" }]}>
                      {prop.status}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Klick-Pro Platform Audit Center · Official Compliance Record
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
