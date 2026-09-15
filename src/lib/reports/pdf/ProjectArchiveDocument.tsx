import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { reportTheme } from "./theme";

export type ArchiveField = { label: string; value: string };
export type ArchiveEntry = {
  title: string;
  meta?: string;
  details?: ArchiveField[];
  body?: string;
  files?: string[];
};

export type ProjectArchiveData = {
  projectId: number;
  title: string;
  status: string;
  generatedFor: string;
  completedAt: string;
  overview: ArchiveField[];
  client: ArchiveField[];
  professional: ArchiveField[];
  description?: string;
  proposal: ArchiveEntry;
  negotiations: ArchiveEntry[];
  milestones: ArchiveEntry[];
  workUploads: ArchiveEntry[];
  requests: ArchiveEntry[];
  payments: ArchiveEntry[];
  transactions: ArchiveEntry[];
  timeline: ArchiveEntry[];
  reviews: ArchiveEntry[];
  dispute?: ArchiveEntry;
  disputeMessages: ArchiveEntry[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 104,
    paddingBottom: 54,
    paddingHorizontal: 34,
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
    height: 86,
    paddingHorizontal: 34,
    paddingTop: 20,
    backgroundColor: reportTheme.ink,
  },
  brand: {
    color: reportTheme.cta,
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: { marginTop: 5, color: reportTheme.white, fontSize: 18, fontWeight: "bold" },
  headerMeta: { marginTop: 5, color: "#cbd5e1", fontSize: 8 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    paddingHorizontal: 34,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: reportTheme.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { color: reportTheme.muted, fontSize: 7.5 },
  hero: {
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 6,
    backgroundColor: reportTheme.zebra,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { maxWidth: "78%", fontSize: 14, fontWeight: "bold" },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
  },
  statusText: {
    color: "#15803d",
    fontSize: 7,
    fontWeight: "bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  section: { marginBottom: 15 },
  sectionTitle: {
    marginBottom: 7,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: reportTheme.cta,
    color: reportTheme.ink,
    fontSize: 10.5,
    fontWeight: "bold",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridCell: { width: "50%", paddingHorizontal: 4, marginBottom: 7 },
  label: {
    color: reportTheme.muted,
    fontSize: 6.8,
    fontWeight: "bold",
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  value: { marginTop: 1.5, color: reportTheme.ink, fontSize: 8.5 },
  parties: { flexDirection: "row", marginHorizontal: -5 },
  party: {
    width: "50%",
    marginHorizontal: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 5,
  },
  partyTitle: { marginBottom: 7, color: reportTheme.primary, fontSize: 9, fontWeight: "bold" },
  bodyBox: {
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: reportTheme.primary,
    backgroundColor: reportTheme.zebra,
    color: "#334155",
  },
  entry: {
    marginBottom: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 4,
  },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  entryTitle: { width: "62%", fontSize: 9, fontWeight: "bold", color: reportTheme.ink },
  entryMeta: { width: "36%", textAlign: "right", fontSize: 7.5, color: reportTheme.muted },
  inlineFields: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, marginHorizontal: -4 },
  inlineField: { width: "33.333%", paddingHorizontal: 4, marginBottom: 5 },
  entryBody: { marginTop: 6, color: "#334155", fontSize: 8.2 },
  files: { marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: reportTheme.border },
  file: { color: reportTheme.muted, fontSize: 7.5, marginTop: 1.5 },
  empty: {
    padding: 10,
    borderWidth: 1,
    borderColor: reportTheme.border,
    borderRadius: 4,
    color: reportTheme.muted,
    fontSize: 8,
    textAlign: "center",
  },
});

function Fields({ fields, columns = 2 }: { fields: ArchiveField[]; columns?: 2 | 3 }) {
  return (
    <View style={columns === 2 ? styles.grid : styles.inlineFields}>
      {fields.map((field, index) => (
        <View
          key={`${field.label}-${index}`}
          style={columns === 2 ? styles.gridCell : styles.inlineField}
        >
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.value}>{field.value || "Not provided"}</Text>
        </View>
      ))}
    </View>
  );
}

function Entry({ entry }: { entry: ArchiveEntry }) {
  return (
    <View style={styles.entry} wrap={false}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryTitle}>{entry.title}</Text>
        {entry.meta ? <Text style={styles.entryMeta}>{entry.meta}</Text> : null}
      </View>
      {entry.details?.length ? <Fields fields={entry.details} columns={3} /> : null}
      {entry.body ? <Text style={styles.entryBody}>{entry.body}</Text> : null}
      {entry.files?.length ? (
        <View style={styles.files}>
          <Text style={styles.label}>Files</Text>
          {entry.files.map((file, index) => (
            <Text key={`${file}-${index}`} style={styles.file}>
              {index + 1}. {file}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, entries }: { title: string; entries: ArchiveEntry[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={32}>
        {title}
      </Text>
      {entries.length ? (
        entries.map((entry, index) => <Entry key={`${title}-${index}`} entry={entry} />)
      ) : (
        <Text style={styles.empty}>No records.</Text>
      )}
    </View>
  );
}

function Header({ data }: { data: ProjectArchiveData }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.brand}>Klick-Pro project record</Text>
      <Text style={styles.title}>Completed project details</Text>
      <Text style={styles.headerMeta}>
        Project #{data.projectId} - Generated for {data.generatedFor}
      </Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Klick-Pro - Confidential project record</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function ProjectArchiveDocument({ data }: { data: ProjectArchiveData }) {
  return (
    <Document title={`Project ${data.projectId} - ${data.title}`} author="Klick-Pro">
      <Page size="A4" style={styles.page} wrap>
        <Header data={data} />
        <View style={styles.hero} wrap={false}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>{data.title}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{data.status}</Text>
            </View>
          </View>
          <Text style={[styles.value, { marginTop: 6 }]}>Completed {data.completedAt}</Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Project overview</Text>
          <Fields fields={data.overview} />
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Project participants</Text>
          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.partyTitle}>Client</Text>
              <Fields fields={data.client} />
            </View>
            <View style={styles.party}>
              <Text style={styles.partyTitle}>Professional</Text>
              <Fields fields={data.professional} />
            </View>
          </View>
        </View>

        {data.description ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Original job description</Text>
            <Text style={styles.bodyBox}>{data.description}</Text>
          </View>
        ) : null}

        <Section title="Accepted proposal" entries={[data.proposal]} />
        <Section title="Negotiation history" entries={data.negotiations} />
        <Section title="Milestones" entries={data.milestones} />
        <Section title="Work submissions and files" entries={data.workUploads} />
        <Section title="Revision, review, and completion requests" entries={data.requests} />
        <Section title="Payments" entries={data.payments} />
        <Section title="Project ledger" entries={data.transactions} />
        <Section title="Complete activity timeline" entries={data.timeline} />
        <Section title="Participant reviews" entries={data.reviews} />
        {data.dispute ? <Section title="Dispute" entries={[data.dispute]} /> : null}
        {data.dispute ? (
          <Section title="Dispute messages" entries={data.disputeMessages} />
        ) : null}
        <Footer />
      </Page>
    </Document>
  );
}
