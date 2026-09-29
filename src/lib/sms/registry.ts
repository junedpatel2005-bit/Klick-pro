import { SmsTemplateDefinition } from "./types";

export const SMS_TEMPLATE_REGISTRY: Record<string, SmsTemplateDefinition> = {
  auth_phone_otp: {
    key: "auth_phone_otp",
    name: "Phone Verification OTP",
    description: "Sent when a user requests phone authentication or verification.",
    audience: "CLIENT",
    category: "Account & Auth",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234501",
    defaultBodyText:
      "Your KLICK verification code is {{otp_code}}. Valid for 10 minutes. Do not share this code with anyone. - KLICK PRO",
    variables: [
      {
        key: "otp_code",
        label: "OTP Code",
        description: "4 to 6 digit security code",
        sample: "482910",
      },
      { key: "user_name", label: "User Name", description: "User's first name", sample: "Juned" },
    ],
    sampleData: {
      otp_code: "482910",
      user_name: "Juned",
    },
  },

  client_proposal_received: {
    key: "client_proposal_received",
    name: "New Proposal Received",
    description: "Sent to client when a verified professional submits a quote/proposal.",
    audience: "CLIENT",
    category: "Jobs & Proposals",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234502",
    defaultBodyText:
      'Hi {{client_name}}, {{prof_name}} submitted a quote (₹{{amount}}) for "{{job_title}}". Review proposal: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "client_name",
        label: "Client Name",
        description: "Client's first name",
        sample: "Priya",
      },
      {
        key: "prof_name",
        label: "Professional Name",
        description: "Professional's name",
        sample: "Rajesh Sharma",
      },
      {
        key: "amount",
        label: "Quote Amount",
        description: "Offered price in INR",
        sample: "4,500",
      },
      {
        key: "job_title",
        label: "Job Title",
        description: "Title of posted project",
        sample: "Modular Kitchen Fitting",
      },
      {
        key: "short_url",
        label: "Action Link",
        description: "Link to view proposal",
        sample: "https://klickpro.in/c/p/12",
      },
    ],
    sampleData: {
      client_name: "Priya",
      prof_name: "Rajesh Sharma",
      amount: "4,500",
      job_title: "Modular Kitchen Fitting",
      short_url: "https://klickpro.in/c/p/12",
    },
  },

  client_milestone_submitted: {
    key: "client_milestone_submitted",
    name: "Milestone Work Submitted",
    description: "Sent to client when a professional submits work for inspection & approval.",
    audience: "CLIENT",
    category: "Projects & Milestones",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234503",
    defaultBodyText:
      'Hi {{client_name}}, milestone "{{milestone_title}}" for "{{job_title}}" is submitted for review: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "client_name",
        label: "Client Name",
        description: "Client's first name",
        sample: "Priya",
      },
      {
        key: "milestone_title",
        label: "Milestone Title",
        description: "Name of milestone completed",
        sample: "Wiring & Piping",
      },
      {
        key: "job_title",
        label: "Job Title",
        description: "Title of posted project",
        sample: "Home Renovation",
      },
      {
        key: "short_url",
        label: "Action Link",
        description: "Direct link to review work",
        sample: "https://klickpro.in/c/m/8",
      },
    ],
    sampleData: {
      client_name: "Priya",
      milestone_title: "Wiring & Piping",
      job_title: "Home Renovation",
      short_url: "https://klickpro.in/c/m/8",
    },
  },

  client_escrow_funded: {
    key: "client_escrow_funded",
    name: "Milestone Payment Held in Escrow",
    description: "Sent to client confirming payment is safely held in escrow.",
    audience: "CLIENT",
    category: "Financial & Payments",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234504",
    defaultBodyText:
      'Hi {{client_name}}, ₹{{amount}} for milestone "{{milestone_title}}" is safely held in escrow. Work has begun! - KLICK PRO',
    variables: [
      {
        key: "client_name",
        label: "Client Name",
        description: "Client's first name",
        sample: "Priya",
      },
      { key: "amount", label: "Funded Amount", description: "Amount in INR", sample: "12,000" },
      {
        key: "milestone_title",
        label: "Milestone Title",
        description: "Name of milestone",
        sample: "Phase 1 - Materials",
      },
    ],
    sampleData: {
      client_name: "Priya",
      amount: "12,000",
      milestone_title: "Phase 1 - Materials",
    },
  },

  prof_job_match: {
    key: "prof_job_match",
    name: "New Matching Lead Opportunity",
    description: "Sent to professional when a new local job matching their skill is posted.",
    audience: "PROFESSIONAL",
    category: "Jobs & Proposals",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234505",
    defaultBodyText:
      'New Lead: "{{job_title}}" in {{city}} matching your skills (Budget: ₹{{amount}}). View and send quote: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "job_title",
        label: "Job Title",
        description: "Project title",
        sample: "AC Duct Repair",
      },
      { key: "city", label: "City / Location", description: "Job location", sample: "Mumbai" },
      { key: "amount", label: "Budget", description: "Job budget", sample: "3,500" },
      {
        key: "short_url",
        label: "Action Link",
        description: "Link to view lead",
        sample: "https://klickpro.in/p/j/44",
      },
    ],
    sampleData: {
      job_title: "AC Duct Repair",
      city: "Mumbai",
      amount: "3,500",
      short_url: "https://klickpro.in/p/j/44",
    },
  },

  prof_proposal_accepted: {
    key: "prof_proposal_accepted",
    name: "Proposal Accepted (Hired)",
    description: "Sent to professional when their proposal is accepted by the client.",
    audience: "PROFESSIONAL",
    category: "Jobs & Proposals",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234506",
    defaultBodyText:
      'Congratulations {{prof_name}}! Your proposal for "{{job_title}}" was accepted by {{client_name}}. View details: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "prof_name",
        label: "Professional Name",
        description: "Professional's first name",
        sample: "Rajesh",
      },
      {
        key: "job_title",
        label: "Job Title",
        description: "Project title",
        sample: "Bathroom Waterproofing",
      },
      {
        key: "client_name",
        label: "Client Name",
        description: "Client name",
        sample: "Amit Patel",
      },
      {
        key: "short_url",
        label: "Action Link",
        description: "Link to project page",
        sample: "https://klickpro.in/p/proj/19",
      },
    ],
    sampleData: {
      prof_name: "Rajesh",
      job_title: "Bathroom Waterproofing",
      client_name: "Amit Patel",
      short_url: "https://klickpro.in/p/proj/19",
    },
  },

  prof_milestone_funded: {
    key: "prof_milestone_funded",
    name: "Milestone Funded (Safe to Start)",
    description: "Sent to professional when client deposits escrow funds for a milestone.",
    audience: "PROFESSIONAL",
    category: "Projects & Milestones",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234507",
    defaultBodyText:
      'Good news {{prof_name}}! {{client_name}} deposited ₹{{amount}} for milestone "{{milestone_title}}". You can begin work now: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "prof_name",
        label: "Professional Name",
        description: "Professional's first name",
        sample: "Rajesh",
      },
      {
        key: "client_name",
        label: "Client Name",
        description: "Client's first name",
        sample: "Amit Patel",
      },
      {
        key: "amount",
        label: "Milestone Amount",
        description: "Escrow amount in INR",
        sample: "8,000",
      },
      {
        key: "milestone_title",
        label: "Milestone Title",
        description: "Milestone title",
        sample: "Surface Preparation",
      },
      {
        key: "short_url",
        label: "Action Link",
        description: "Link to project milestone",
        sample: "https://klickpro.in/p/m/19",
      },
    ],
    sampleData: {
      prof_name: "Rajesh",
      client_name: "Amit Patel",
      amount: "8,000",
      milestone_title: "Surface Preparation",
      short_url: "https://klickpro.in/p/m/19",
    },
  },

  prof_payout_released: {
    key: "prof_payout_released",
    name: "Milestone Payout Released",
    description: "Sent to professional when client approves work and funds are credited to wallet.",
    audience: "PROFESSIONAL",
    category: "Financial & Payments",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234508",
    defaultBodyText:
      'Success {{prof_name}}! Payout of ₹{{amount}} for milestone "{{milestone_title}}" has been credited to your wallet. - KLICK PRO',
    variables: [
      {
        key: "prof_name",
        label: "Professional Name",
        description: "Professional's first name",
        sample: "Rajesh",
      },
      {
        key: "amount",
        label: "Payout Amount",
        description: "Credited amount in INR",
        sample: "8,000",
      },
      {
        key: "milestone_title",
        label: "Milestone Title",
        description: "Approved milestone title",
        sample: "Surface Preparation",
      },
    ],
    sampleData: {
      prof_name: "Rajesh",
      amount: "8,000",
      milestone_title: "Surface Preparation",
    },
  },

  prof_revision_requested: {
    key: "prof_revision_requested",
    name: "Milestone Revision Requested",
    description: "Sent to professional when client requests revisions on submitted milestone.",
    audience: "PROFESSIONAL",
    category: "Projects & Milestones",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234509",
    defaultBodyText:
      'Hi {{prof_name}}, {{client_name}} requested revisions on milestone "{{milestone_title}}". Check comments: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "prof_name",
        label: "Professional Name",
        description: "Professional's first name",
        sample: "Rajesh",
      },
      {
        key: "client_name",
        label: "Client Name",
        description: "Client's name",
        sample: "Amit Patel",
      },
      {
        key: "milestone_title",
        label: "Milestone Title",
        description: "Milestone title",
        sample: "Interior Painting",
      },
      {
        key: "short_url",
        label: "Action Link",
        description: "Link to revision details",
        sample: "https://klickpro.in/p/m/21",
      },
    ],
    sampleData: {
      prof_name: "Rajesh",
      client_name: "Amit Patel",
      milestone_title: "Interior Painting",
      short_url: "https://klickpro.in/p/m/21",
    },
  },

  dispute_urgent_alert: {
    key: "dispute_urgent_alert",
    name: "Urgent Dispute Notification",
    description: "Sent to either party when a formal dispute is lodged on a project.",
    audience: "SYSTEM",
    category: "Disputes & Support",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234510",
    defaultBodyText:
      'Urgent: A dispute has been filed regarding "{{job_title}}". Please review and respond in your dispute room: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "job_title",
        label: "Job Title",
        description: "Project title under dispute",
        sample: "Office Carpentry",
      },
      {
        key: "short_url",
        label: "Dispute Room Link",
        description: "Link to dispute resolution room",
        sample: "https://klickpro.in/disputes/7",
      },
    ],
    sampleData: {
      job_title: "Office Carpentry",
      short_url: "https://klickpro.in/disputes/7",
    },
  },

  dispute_resolved: {
    key: "dispute_resolved",
    name: "Dispute Resolution Announcement",
    description: "Sent to involved parties when admin mediator concludes a dispute.",
    audience: "SYSTEM",
    category: "Disputes & Support",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234511",
    defaultBodyText:
      'Notice: Dispute for "{{job_title}}" has been resolved by KLICK mediation team. Check outcome: {{short_url}} - KLICK PRO',
    variables: [
      {
        key: "job_title",
        label: "Job Title",
        description: "Project title",
        sample: "Office Carpentry",
      },
      {
        key: "short_url",
        label: "Resolution Link",
        description: "Link to resolution summary",
        sample: "https://klickpro.in/disputes/7",
      },
    ],
    sampleData: {
      job_title: "Office Carpentry",
      short_url: "https://klickpro.in/disputes/7",
    },
  },

  auth_welcome: {
    key: "auth_welcome",
    name: "Welcome to Platform",
    description: "Sent to newly registered and verified users welcoming them to KLICK PRO.",
    audience: "CLIENT",
    category: "Account & Auth",
    defaultSenderId: "KLKPRO",
    defaultDltTemplateId: "10071689234512",
    defaultBodyText:
      "Welcome to KLICK PRO, {{user_name}}! Your account has been verified. Discover top local services or post your first job at {{site_url}}",
    variables: [
      { key: "user_name", label: "User Name", description: "User's first name", sample: "Juned" },
      {
        key: "site_url",
        label: "Website URL",
        description: "Platform URL",
        sample: "https://klickpro.in",
      },
    ],
    sampleData: {
      user_name: "Juned",
      site_url: "https://klickpro.in",
    },
  },
};
