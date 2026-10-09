import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { reportTheme } from "./theme";

export type KeyValuePair = { label: string; value: string };

export type DossierParty = {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  company?: string;
  category?: string;
  location?: string;
  rating?: string;
};

export type DossierProposal = {
  proName: string;
  bidAmount: string;
  duration: string;
  status: string;
  submittedAt: string;
  coverLetter?: string;
};

export type DossierNegotiation = {
  senderRole: string;
  senderName?: string;
  bidAmount: string;
  previousBidAmount?: string;
  duration?: string;
  message: string;
  createdAt: string;
};

export type DossierMilestone = {
  number: number;
  title: string;
  amount: string;
  percentage?: string;
  status: string;
  dueDate?: string;
  approvedAt?: string;
  description?: string;
};

export type DossierPayment = {
  id: number;
  title: string;
  amount: string;
  status: string;
  paidAt?: string;
  breakdown?: KeyValuePair[];
};

export type JobDossierData = {
  jobId: number;
  title: string;
  status: string;
  category: string;
  workMode: string;
  timingType: string;
  urgency: string;
  postedAt: string;
  jobDate?: string;
  deadline?: string;
  budget: string;
  location: string;
  description?: string;
  viewerRole: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  generatedFor: string;
  client: DossierParty;
  professional?: DossierParty;
  projectStatus?: string;
  projectProgress?: string;
  completedAt?: string;
  proposals: DossierProposal[];
  negotiations: DossierNegotiation[];
  milestones: DossierMilestone[];
  payments: DossierPayment[];
  reviews?: {
    clientRating?: string;
    clientComment?: string;
    proRating?: string;
    proComment?: string;
  };
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 100,
    paddingBottom: 56,
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
    height: 84,
    paddingHorizontal: 32,
    paddingTop: 20,
    backgroundColor: reportTheme.ink,
  },
  brand: {
    color: reportTheme.cta,
    fontSize: 8.5,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerTitle: { marginTop: 4, color: reportTheme.white, fontSize: 16, fontWeight: "bold" },
  headerMeta: { marginTop: 4, color: "#cbd5e1", fontSize: 7.8 },
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
  footerText: { color: reportTheme.muted, fontSize: 7.5 },
  hero: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 6,
    backgroundColor: reportTheme.zebra,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { maxWidth: "75%", fontSize: 13, fontWeight: "bold" },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#dcfce7",
  },
  statusText: {
    color: "#15803d",
    fontSize: 7.2,
    fontWeight: "bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  section: { marginBottom: 13 },
  sectionTitle: {
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: reportTheme.cta,
    color: reportTheme.ink,
    fontSize: 9.8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridCell: { width: "50%", paddingHorizontal: 4, marginBottom: 6 },
  gridCellThird: { width: "33.333%", paddingHorizontal: 4, marginBottom: 6 },
  label: {
    color: reportTheme.muted,
    fontSize: 6.8,
    fontWeight: "bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  value: { marginTop: 1, color: reportTheme.ink, fontSize: 8.2 },
  partiesContainer: { flexDirection: "row", marginHorizontal: -4 },
  partyBox: {
    width: "50%",
    marginHorizontal: 4,
    padding: 9,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 5,
    backgroundColor: reportTheme.white,
  },
  partyTitle: { marginBottom: 6, color: reportTheme.primary, fontSize: 8.8, fontWeight: "bold" },
  bodyBox: {
    padding: 8,
    borderLeftWidth: 2.5,
    borderLeftColor: reportTheme.primary,
    backgroundColor: reportTheme.zebra,
    color: "#334155",
    fontSize: 8,
  },
  card: {
    marginBottom: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 4,
    backgroundColor: reportTheme.white,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { width: "65%", fontSize: 8.5, fontWeight: "bold", color: reportTheme.ink },
  cardMeta: { width: "33%", textAlign: "right", fontSize: 7.2, color: reportTheme.muted },
  cardBody: { marginTop: 4, color: "#334155", fontSize: 7.8 },
  table: { marginTop: 4 },
  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: reportTheme.ink,
    borderRadius: 2,
    paddingVertical: 4,
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
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: { backgroundColor: reportTheme.zebra },
  tableCell: { fontSize: 7.8 },
  emptyNote: {
    padding: 8,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 4,
    color: reportTheme.muted,
    fontSize: 7.8,
    textAlign: "center",
  },
});

export function JobDossierDocument({ data }: { data: JobDossierData }) {
  const isCompleted = data.status === "COMPLETED" || data.projectStatus === "COMPLETED";

  return (
    <Document title={`Job Dossier #${data.jobId} - ${data.title}`} author="Klick-Pro">
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.brand}>Klick-Pro · Official Job & Project Dossier</Text>
          <Text style={styles.headerTitle}>Job Specification & Execution Statement</Text>
          <Text style={styles.headerMeta}>
            Listing #{data.jobId} · Generated for {data.generatedFor} ({data.viewerRole}) ·{" "}
            {new Date().toLocaleDateString("en-IN")}
          </Text>
        </View>

        {/* Hero */}
        <View style={styles.hero} wrap={false}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>{data.title}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{data.status}</Text>
            </View>
          </View>
          <Text style={[styles.value, { marginTop: 4, color: reportTheme.muted }]}>
            Posted on {data.postedAt} · Category: {data.category} · Mode: {data.workMode}
          </Text>
        </View>

        {/* Job Attributes Overview */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Job Overview & Specifications</Text>
          <View style={styles.grid}>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Job ID</Text>
              <Text style={styles.value}>#{data.jobId}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{data.category}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Budget / Rate</Text>
              <Text style={styles.value}>{data.budget}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Timing / Contract</Text>
              <Text style={styles.value}>{data.timingType}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Urgency</Text>
              <Text style={styles.value}>{data.urgency}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Work Mode</Text>
              <Text style={styles.value}>{data.workMode}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Posted Date</Text>
              <Text style={styles.value}>{data.postedAt}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Target Date / Deadline</Text>
              <Text style={styles.value}>{data.deadline || data.jobDate || "Flexible"}</Text>
            </View>
            <View style={styles.gridCellThird}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{data.location}</Text>
            </View>
          </View>
        </View>

        {/* Parties Involved */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Engagement Parties</Text>
          <View style={styles.partiesContainer}>
            <View style={styles.partyBox}>
              <Text style={styles.partyTitle}>Client (Job Poster)</Text>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{data.client.name}</Text>
              {data.client.company ? (
                <>
                  <Text style={[styles.label, { marginTop: 3 }]}>Company</Text>
                  <Text style={styles.value}>{data.client.company}</Text>
                </>
              ) : null}
              {data.client.email ? (
                <>
                  <Text style={[styles.label, { marginTop: 3 }]}>Email</Text>
                  <Text style={styles.value}>{data.client.email}</Text>
                </>
              ) : null}
              {data.client.phone ? (
                <>
                  <Text style={[styles.label, { marginTop: 3 }]}>Phone</Text>
                  <Text style={styles.value}>{data.client.phone}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.partyBox}>
              <Text style={styles.partyTitle}>Hired Professional</Text>
              {data.professional ? (
                <>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{data.professional.name}</Text>
                  {data.professional.category ? (
                    <>
                      <Text style={[styles.label, { marginTop: 3 }]}>Specialization</Text>
                      <Text style={styles.value}>{data.professional.category}</Text>
                    </>
                  ) : null}
                  {data.professional.email ? (
                    <>
                      <Text style={[styles.label, { marginTop: 3 }]}>Email</Text>
                      <Text style={styles.value}>{data.professional.email}</Text>
                    </>
                  ) : null}
                  {data.professional.phone ? (
                    <>
                      <Text style={[styles.label, { marginTop: 3 }]}>Contact</Text>
                      <Text style={styles.value}>{data.professional.phone}</Text>
                    </>
                  ) : null}
                </>
              ) : (
                <Text style={styles.emptyNote}>Open listing · Professional not yet contracted</Text>
              )}
            </View>
          </View>
        </View>

        {/* Job Scope & Description */}
        {data.description ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Scope of Work & Description</Text>
            <Text style={styles.bodyBox}>{data.description}</Text>
          </View>
        ) : null}

        {/* Milestones */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Contract Milestones ({data.milestones.length})</Text>
          {data.milestones.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.tableHeaderCell, { width: "8%" }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { width: "42%" }]}>Milestone Title</Text>
                <Text style={[styles.tableHeaderCell, { width: "18%", textAlign: "right" }]}>
                  Amount
                </Text>
                <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "center" }]}>
                  Status
                </Text>
                <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}>
                  Due / Done
                </Text>
              </View>
              {data.milestones.map((m, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCell, { width: "8%" }]}>{m.number}</Text>
                  <Text style={[styles.tableCell, { width: "42%", fontWeight: "bold" }]}>
                    {m.title}
                  </Text>
                  <Text style={[styles.tableCell, { width: "18%", textAlign: "right" }]}>
                    {m.amount}
                  </Text>
                  <Text style={[styles.tableCell, { width: "16%", textAlign: "center" }]}>
                    {m.status}
                  </Text>
                  <Text style={[styles.tableCell, { width: "16%", textAlign: "right" }]}>
                    {m.approvedAt || m.dueDate || "—"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNote}>No formal milestones created yet.</Text>
          )}
        </View>

        {/* Proposals & Bids */}
        {data.proposals.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Proposal & Bid Details</Text>
            {data.proposals.map((p, idx) => (
              <View key={idx} style={styles.card} wrap={false}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Proposal from {p.proName}</Text>
                  <Text style={styles.cardMeta}>{p.submittedAt}</Text>
                </View>
                <View style={[styles.grid, { marginTop: 4 }]}>
                  <View style={styles.gridCellThird}>
                    <Text style={styles.label}>Offered Bid</Text>
                    <Text style={styles.value}>{p.bidAmount}</Text>
                  </View>
                  <View style={styles.gridCellThird}>
                    <Text style={styles.label}>Estimated Duration</Text>
                    <Text style={styles.value}>{p.duration}</Text>
                  </View>
                  <View style={styles.gridCellThird}>
                    <Text style={styles.label}>Proposal Status</Text>
                    <Text style={styles.value}>{p.status}</Text>
                  </View>
                </View>
                {p.coverLetter ? <Text style={styles.cardBody}>{p.coverLetter}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Negotiations History */}
        {data.negotiations.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Terms & Counter-Offer Negotiation History</Text>
            {data.negotiations.map((n, idx) => (
              <View key={idx} style={styles.card} wrap={false}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {n.senderRole} counter-offer ({n.senderName || n.senderRole})
                  </Text>
                  <Text style={styles.cardMeta}>{n.createdAt}</Text>
                </View>
                <View style={[styles.grid, { marginTop: 3 }]}>
                  <View style={styles.gridCell}>
                    <Text style={styles.label}>Proposed Amount</Text>
                    <Text style={styles.value}>{n.bidAmount}</Text>
                  </View>
                  {n.previousBidAmount ? (
                    <View style={styles.gridCell}>
                      <Text style={styles.label}>Previous Offer</Text>
                      <Text style={styles.value}>{n.previousBidAmount}</Text>
                    </View>
                  ) : null}
                </View>
                {n.message ? <Text style={styles.cardBody}>Message: "{n.message}"</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Payments & Financial Reconciliation */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>
            Financial Settlement & Payments ({data.payments.length})
          </Text>
          {data.payments.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableRowHeader}>
                <Text style={[styles.tableHeaderCell, { width: "16%" }]}>Reference</Text>
                <Text style={[styles.tableHeaderCell, { width: "36%" }]}>Description</Text>
                <Text style={[styles.tableHeaderCell, { width: "18%", textAlign: "right" }]}>
                  Amount
                </Text>
                <Text style={[styles.tableHeaderCell, { width: "14%", textAlign: "center" }]}>
                  Status
                </Text>
                <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}>
                  Date
                </Text>
              </View>
              {data.payments.map((p, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCell, { width: "16%" }]}>#TXN-{p.id}</Text>
                  <Text style={[styles.tableCell, { width: "36%", fontWeight: "bold" }]}>
                    {p.title}
                  </Text>
                  <Text style={[styles.tableCell, { width: "18%", textAlign: "right" }]}>
                    {p.amount}
                  </Text>
                  <Text style={[styles.tableCell, { width: "14%", textAlign: "center" }]}>
                    {p.status}
                  </Text>
                  <Text style={[styles.tableCell, { width: "16%", textAlign: "right" }]}>
                    {p.paidAt || "—"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNote}>No transaction or escrow release records recorded.</Text>
          )}
        </View>

        {/* Project Completion & Review Summary (if complete) */}
        {isCompleted && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Project Delivery & Verification</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Execution Completed & Verified</Text>
              <Text style={styles.cardMeta}>Completed {data.completedAt || "Successfully"}</Text>
              {data.reviews?.clientComment ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.label}>Client Feedback ({data.reviews.clientRating}/5)</Text>
                  <Text style={styles.cardBody}>"{data.reviews.clientComment}"</Text>
                </View>
              ) : null}
              {data.reviews?.proComment ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.label}>
                    Professional Feedback ({data.reviews.proRating}/5)
                  </Text>
                  <Text style={styles.cardBody}>"{data.reviews.proComment}"</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Klick-Pro · Verified Job Record · Powered by Klick-Pro Technologies
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
