import { EmailTemplateDefinition } from "./types";

export const EMAIL_TEMPLATE_REGISTRY: Record<string, EmailTemplateDefinition> = {
  // ==========================================
  // CLIENT TEMPLATES
  // ==========================================
  client_welcome: {
    key: "client_welcome",
    name: "Welcome to Klick-Pro (Client)",
    description: "Sent to newly registered clients upon sign-up or verification.",
    audience: "CLIENT",
    category: "Account & Auth",
    defaultSubject: "Welcome to Klick-Pro, {{client_name}}! Let's get your project started",
    defaultHeading: "Find the right verified professional for your project",
    defaultBodyText:
      "Hello {{client_name}},\n\nWelcome to Klick-Pro! Your client account is active and ready to go.\n\nYou can now post job requirements, review quotes from verified professionals, and manage project milestones with secure escrow payments.",
    defaultActionText: "Post Your First Job",
    defaultActionUrl: "/post-job",
    variables: [
      { key: "client_name", label: "Client Name", description: "First name of the client", sample: "Sarah Jenkins" },
      { key: "support_email", label: "Support Email", description: "Platform support email", sample: "support@klick-pro.com" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      support_email: "support@klick-pro.com",
    },
  },

  client_job_posted: {
    key: "client_job_posted",
    name: "Job Posted Confirmation",
    description: "Sent to client immediately after a job is successfully published.",
    audience: "CLIENT",
    category: "Jobs & Proposals",
    defaultSubject: "Your job has been published: {{job_title}}",
    defaultHeading: "Your job posting is live on Klick-Pro",
    defaultBodyText:
      "Hello {{client_name}},\n\nYour job \"{{job_title}}\" has been successfully posted. Qualified and verified professionals in {{category_name}} are being notified.\n\nYou'll receive email and in-app alerts as soon as proposals and quotes start coming in.",
    defaultActionText: "View Job & Proposals",
    defaultActionUrl: "/client/jobs/{{job_id}}",
    variables: [
      { key: "client_name", label: "Client Name", description: "Name of the client", sample: "Sarah Jenkins" },
      { key: "job_title", label: "Job Title", description: "Title of the posted job", sample: "Full-Stack Next.js Web Application" },
      { key: "category_name", label: "Job Category", description: "Category/trade name", sample: "Software Development" },
      { key: "budget", label: "Job Budget", description: "Allocated budget or range", sample: "₹45,000" },
      { key: "job_id", label: "Job ID", description: "Unique identifier of the job", sample: "1082" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      job_title: "Full-Stack Next.js Web Application",
      category_name: "Software Development",
      budget: "₹45,000",
      job_id: "1082",
    },
  },

  client_proposal_received: {
    key: "client_proposal_received",
    name: "New Proposal Received",
    description: "Sent to client when a professional submits a bid or quote on their job.",
    audience: "CLIENT",
    category: "Jobs & Proposals",
    defaultSubject: "New proposal for {{job_title}} from {{professional_name}}",
    defaultHeading: "You received a new proposal",
    defaultBodyText:
      "Hello {{client_name}},\n\n{{professional_name}} just submitted a proposal for \"{{job_title}}\".\n\nProposed Amount: {{bid_amount}}\nEstimated Timeline: {{delivery_time}}\n\nReview their proposal details, portfolio, and ratings to decide if they are the right fit for your job.",
    defaultActionText: "Review Proposal",
    defaultActionUrl: "/client/jobs/{{job_id}}?proposal={{proposal_id}}",
    variables: [
      { key: "client_name", label: "Client Name", description: "Name of the client", sample: "Sarah Jenkins" },
      { key: "professional_name", label: "Professional Name", description: "Name of bidding pro", sample: "Rahul Verma" },
      { key: "job_title", label: "Job Title", description: "Title of the job", sample: "Full-Stack Next.js Web Application" },
      { key: "bid_amount", label: "Bid Amount", description: "Quote amount", sample: "₹42,000" },
      { key: "delivery_time", label: "Delivery Time", description: "Estimated project timeline", sample: "14 Days" },
      { key: "job_id", label: "Job ID", description: "Job identifier", sample: "1082" },
      { key: "proposal_id", label: "Proposal ID", description: "Proposal identifier", sample: "305" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      professional_name: "Rahul Verma",
      job_title: "Full-Stack Next.js Web Application",
      bid_amount: "₹42,000",
      delivery_time: "14 Days",
      job_id: "1082",
      proposal_id: "305",
    },
  },

  client_milestone_submitted: {
    key: "client_milestone_submitted",
    name: "Milestone Submitted for Review",
    description: "Sent to client when the professional submits completed milestone deliverables.",
    audience: "CLIENT",
    category: "Projects & Milestones",
    defaultSubject: "Work submitted: Milestone \"{{milestone_title}}\" on {{project_title}}",
    defaultHeading: "Work ready for your inspection",
    defaultBodyText:
      "Hello {{client_name}},\n\n{{professional_name}} has completed and submitted deliverables for milestone \"{{milestone_title}}\" on project \"{{project_title}}\".\n\nPlease review the submitted files and notes. If everything meets your requirements, you can approve the milestone to release the escrow payment. If changes are needed, you can request revisions directly.",
    defaultActionText: "Review Milestone Work",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "client_name", label: "Client Name", description: "Name of the client", sample: "Sarah Jenkins" },
      { key: "professional_name", label: "Professional Name", description: "Name of the pro", sample: "Rahul Verma" },
      { key: "project_title", label: "Project Title", description: "Title of the project", sample: "E-Commerce Web Portal" },
      { key: "milestone_title", label: "Milestone Title", description: "Name of milestone", sample: "Milestone 1: Database & Auth Setup" },
      { key: "milestone_amount", label: "Milestone Amount", description: "Escrow funds locked", sample: "₹15,000" },
      { key: "project_id", label: "Project ID", description: "Tracking ID", sample: "419" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      professional_name: "Rahul Verma",
      project_title: "E-Commerce Web Portal",
      milestone_title: "Milestone 1: Database & Auth Setup",
      milestone_amount: "₹15,000",
      project_id: "419",
    },
  },

  client_dispute_opened: {
    key: "client_dispute_opened",
    name: "Dispute Opened Notice (Client)",
    description: "Sent to client when a dispute is lodged on their project.",
    audience: "CLIENT",
    category: "Disputes & Support",
    defaultSubject: "Dispute Notice: Project {{project_title}}",
    defaultHeading: "A dispute has been initiated",
    defaultBodyText:
      "Hello {{client_name}},\n\nA dispute has been raised regarding project \"{{project_title}}\".\n\nIssue Type: {{issue_type}}\nRaised By: {{raised_by}}\n\nAll escrow funds for this project are securely held in dispute protection. Both parties have the opportunity to provide statements, evidence, and resolve the matter mutually before escalation to an administrator.",
    defaultActionText: "Go to Dispute Center",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "client_name", label: "Client Name", description: "Name of the client", sample: "Sarah Jenkins" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "issue_type", label: "Issue Type", description: "Dispute categorization", sample: "Quality of Work & Scope Mismatch" },
      { key: "raised_by", label: "Raised By", description: "Reporter identity", sample: "Rahul Verma" },
      { key: "project_id", label: "Project ID", description: "Tracking ID", sample: "419" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      project_title: "E-Commerce Web Portal",
      issue_type: "Quality of Work & Scope Mismatch",
      raised_by: "Rahul Verma",
      project_id: "419",
    },
  },

  client_dispute_resolved: {
    key: "client_dispute_resolved",
    name: "Dispute Resolution Decision (Client)",
    description: "Sent to client when an admin settles or closes a dispute.",
    audience: "CLIENT",
    category: "Disputes & Support",
    defaultSubject: "Dispute Resolved: Case #{{dispute_id}} on {{project_title}}",
    defaultHeading: "Dispute resolution notice",
    defaultBodyText:
      "Hello {{client_name}},\n\nThe dispute #{{dispute_id}} regarding \"{{project_title}}\" has been reviewed and officially resolved.\n\nResolution Decision: {{decision_summary}}\nDetails & Notes: {{resolution_notes}}\n\nAny adjustments to escrow balances or refunds have been applied to your account.",
    defaultActionText: "View Case Summary",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "client_name", label: "Client Name", description: "Client name", sample: "Sarah Jenkins" },
      { key: "dispute_id", label: "Dispute ID", description: "Dispute case ID", sample: "84" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "decision_summary", label: "Decision", description: "Decision summary", sample: "Refund Approved (Full ₹15,000 credited back)" },
      { key: "resolution_notes", label: "Resolution Notes", description: "Admin comments", sample: "Deliverables did not meet agreed scope criteria." },
      { key: "project_id", label: "Project ID", description: "Project tracking ID", sample: "419" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      dispute_id: "84",
      project_title: "E-Commerce Web Portal",
      decision_summary: "Refund Approved (Full ₹15,000 credited back)",
      resolution_notes: "Deliverables did not meet agreed scope criteria.",
      project_id: "419",
    },
  },

  client_refund_processed: {
    key: "client_refund_processed",
    name: "Refund Credited Confirmation",
    description: "Sent to client when a refund is issued from escrow back to their payment method or wallet.",
    audience: "CLIENT",
    category: "Financial & Payments",
    defaultSubject: "Refund Processed: {{refund_amount}} for {{project_title}}",
    defaultHeading: "Your refund has been processed",
    defaultBodyText:
      "Hello {{client_name}},\n\nA refund of {{refund_amount}} has been credited for \"{{project_title}}\".\n\nTransaction Reference: {{transaction_ref}}\nPayment Method: {{payment_source}}\n\nPlease allow 3-5 business days for bank processing if returned to your original payment method.",
    defaultActionText: "View Transaction History",
    defaultActionUrl: "/client/billing",
    variables: [
      { key: "client_name", label: "Client Name", description: "Client name", sample: "Sarah Jenkins" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "refund_amount", label: "Refund Amount", description: "Credited amount", sample: "₹15,000" },
      { key: "transaction_ref", label: "Transaction Reference", description: "Gateway ref ID", sample: "TXN_982341908" },
      { key: "payment_source", label: "Payment Source", description: "Bank or wallet", sample: "Original Payment Card" },
    ],
    sampleData: {
      client_name: "Sarah Jenkins",
      project_title: "E-Commerce Web Portal",
      refund_amount: "₹15,000",
      transaction_ref: "TXN_982341908",
      payment_source: "Original Payment Card",
    },
  },

  // ==========================================
  // PROFESSIONAL TEMPLATES
  // ==========================================
  prof_welcome: {
    key: "prof_welcome",
    name: "Welcome to Klick-Pro (Professional)",
    description: "Sent to professionals upon registering on the platform.",
    audience: "PROFESSIONAL",
    category: "Account & Auth",
    defaultSubject: "Welcome to Klick-Pro, {{prof_name}}! Start growing your business",
    defaultHeading: "You're one step away from connecting with high-value clients",
    defaultBodyText:
      "Hello {{prof_name}},\n\nWelcome to the Klick-Pro professional network! To start submitting quotes and proposals on client jobs, please complete your profile details and submit your verification documents.\n\nOur verification badge gives you higher visibility and builds instant trust with prospective clients.",
    defaultActionText: "Complete Your Profile",
    defaultActionUrl: "/professional/profile",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "First name of professional", sample: "Vikram Mehta" },
      { key: "support_email", label: "Support Email", description: "Support contact email", sample: "support@klick-pro.com" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      support_email: "support@klick-pro.com",
    },
  },

  prof_verification_approved: {
    key: "prof_verification_approved",
    name: "Verification Approved",
    description: "Sent to professional when their ID and credentials pass admin verification.",
    audience: "PROFESSIONAL",
    category: "Account & Auth",
    defaultSubject: "Congratulations! Your Klick-Pro profile has been verified",
    defaultHeading: "You are now a Verified Klick-Pro Professional",
    defaultBodyText:
      "Hello {{prof_name}},\n\nGreat news! Our compliance team has reviewed and approved your verification credentials.\n\nYour profile now displays the official Klick-Pro Verified badge. You have full access to bid on exclusive jobs and submit client proposals without restrictions.",
    defaultActionText: "Explore Available Jobs",
    defaultActionUrl: "/professional/jobs",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of the professional", sample: "Vikram Mehta" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
    },
  },

  prof_verification_rejected: {
    key: "prof_verification_rejected",
    name: "Verification Update / Action Required",
    description: "Sent when an admin needs corrections or resubmission of verification documents.",
    audience: "PROFESSIONAL",
    category: "Account & Auth",
    defaultSubject: "Action Required: Update your verification documents",
    defaultHeading: "Verification review update",
    defaultBodyText:
      "Hello {{prof_name}},\n\nOur team reviewed your recent verification submission, but was unable to approve it due to the following reason:\n\n\"{{rejection_reason}}\"\n\nPlease review the feedback, take a clear photo or scan of your document, and re-upload it via your verification dashboard.",
    defaultActionText: "Resubmit Documents",
    defaultActionUrl: "/professional/verification",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of the professional", sample: "Vikram Mehta" },
      { key: "rejection_reason", label: "Reason / Notes", description: "Admin feedback", sample: "Government ID document photo was blurry and expired." },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      rejection_reason: "Government ID document photo was blurry and expired.",
    },
  },

  prof_job_match: {
    key: "prof_job_match",
    name: "New Job Match Alert",
    description: "Sent to professionals when a new job matching their trade or skills is posted.",
    audience: "PROFESSIONAL",
    category: "Jobs & Proposals",
    defaultSubject: "New job match in {{category_name}}: {{job_title}}",
    defaultHeading: "A new job matching your expertise is open",
    defaultBodyText:
      "Hello {{prof_name}},\n\nA new job has just been posted that matches your skills:\n\nJob: {{job_title}}\nLocation: {{job_location}}\nClient Budget: {{budget}}\n\nBe among the first professionals to submit a proposal to increase your chances of being hired.",
    defaultActionText: "View Job & Submit Proposal",
    defaultActionUrl: "/professional/jobs/{{job_id}}",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of pro", sample: "Vikram Mehta" },
      { key: "job_title", label: "Job Title", description: "Title of job", sample: "Full-Stack Next.js Web Application" },
      { key: "category_name", label: "Category", description: "Job category", sample: "Web Development" },
      { key: "job_location", label: "Location", description: "Job location or Remote", sample: "Mumbai / Remote" },
      { key: "budget", label: "Budget", description: "Client's budget", sample: "₹50,000" },
      { key: "job_id", label: "Job ID", description: "Identifier", sample: "1082" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      job_title: "Full-Stack Next.js Web Application",
      category_name: "Web Development",
      job_location: "Mumbai / Remote",
      budget: "₹50,000",
      job_id: "1082",
    },
  },

  prof_proposal_accepted: {
    key: "prof_proposal_accepted",
    name: "Proposal Accepted",
    description: "Sent to professional when a client accepts their proposal.",
    audience: "PROFESSIONAL",
    category: "Jobs & Proposals",
    defaultSubject: "Congratulations! {{client_name}} accepted your proposal for {{job_title}}",
    defaultHeading: "Your proposal has been accepted!",
    defaultBodyText:
      "Hello {{prof_name}},\n\nFantastic news! {{client_name}} has accepted your proposal for \"{{job_title}}\" at {{accepted_amount}}.\n\nThe project workspace is now active. Once the client funds the first milestone, you can begin work with guaranteed escrow payment protection.",
    defaultActionText: "Open Project Workspace",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of pro", sample: "Vikram Mehta" },
      { key: "client_name", label: "Client Name", description: "Client name", sample: "Sarah Jenkins" },
      { key: "job_title", label: "Job Title", description: "Job title", sample: "Full-Stack Next.js Web Application" },
      { key: "accepted_amount", label: "Accepted Amount", description: "Contract value", sample: "₹42,000" },
      { key: "project_id", label: "Project ID", description: "Project tracking ID", sample: "419" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      client_name: "Sarah Jenkins",
      job_title: "Full-Stack Next.js Web Application",
      accepted_amount: "₹42,000",
      project_id: "419",
    },
  },

  prof_milestone_funded: {
    key: "prof_milestone_funded",
    name: "Milestone Funded (Work Authorization)",
    description: "Sent to professional when client deposits escrow funds for a milestone.",
    audience: "PROFESSIONAL",
    category: "Projects & Milestones",
    defaultSubject: "Milestone Funded: {{milestone_title}} on {{project_title}}",
    defaultHeading: "Escrow funded - You are authorized to begin work",
    defaultBodyText:
      "Hello {{prof_name}},\n\n{{client_name}} has deposited {{milestone_amount}} into Klick-Pro Escrow for milestone \"{{milestone_title}}\".\n\nYour funds are safely held and protected. You may now start executing this milestone according to your agreed timeline.",
    defaultActionText: "View Milestone Requirements",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of pro", sample: "Vikram Mehta" },
      { key: "client_name", label: "Client Name", description: "Client name", sample: "Sarah Jenkins" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "milestone_title", label: "Milestone Title", description: "Milestone title", sample: "Milestone 1: Database & Auth Setup" },
      { key: "milestone_amount", label: "Milestone Amount", description: "Funded escrow value", sample: "₹15,000" },
      { key: "project_id", label: "Project ID", description: "Project ID", sample: "419" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      client_name: "Sarah Jenkins",
      project_title: "E-Commerce Web Portal",
      milestone_title: "Milestone 1: Database & Auth Setup",
      milestone_amount: "₹15,000",
      project_id: "419",
    },
  },

  prof_payout_released: {
    key: "prof_payout_released",
    name: "Milestone Payout Released",
    description: "Sent to professional when milestone payment is credited to their wallet balance.",
    audience: "PROFESSIONAL",
    category: "Financial & Payments",
    defaultSubject: "Payout Released: {{payout_amount}} has been added to your wallet",
    defaultHeading: "Your milestone payout is in your wallet",
    defaultBodyText:
      "Hello {{prof_name}},\n\nPayment for milestone \"{{milestone_title}}\" on project \"{{project_title}}\" has been approved and released.\n\nNet Payout Credited: {{payout_amount}}\nPlatform Fee: {{platform_fee}}\n\nYou can request a withdrawal to your verified bank account at any time from your earnings dashboard.",
    defaultActionText: "View Earnings & Withdraw",
    defaultActionUrl: "/professional/earnings",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of pro", sample: "Vikram Mehta" },
      { key: "milestone_title", label: "Milestone Title", description: "Milestone title", sample: "Milestone 1: Database & Auth Setup" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "payout_amount", label: "Payout Amount", description: "Net payout", sample: "₹13,500" },
      { key: "platform_fee", label: "Platform Fee", description: "Service commission", sample: "₹1,500 (10%)" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      milestone_title: "Milestone 1: Database & Auth Setup",
      project_title: "E-Commerce Web Portal",
      payout_amount: "₹13,500",
      platform_fee: "₹1,500 (10%)",
    },
  },

  prof_dispute_opened: {
    key: "prof_dispute_opened",
    name: "Dispute Opened Notice (Professional)",
    description: "Sent to professional when client files a dispute on their project.",
    audience: "PROFESSIONAL",
    category: "Disputes & Support",
    defaultSubject: "Action Required: Dispute raised on project {{project_title}}",
    defaultHeading: "Dispute claim opened by client",
    defaultBodyText:
      "Hello {{prof_name}},\n\n{{client_name}} has raised a dispute regarding project \"{{project_title}}\".\n\nIssue Type: {{issue_type}}\nMessage: \"{{dispute_message}}\"\n\nPlease review the claim in the Dispute Center. You can accept the claim or submit your counter-evidence and documentation within 72 hours.",
    defaultActionText: "Open Dispute Center",
    defaultActionUrl: "/project/{{project_id}}/tracking",
    variables: [
      { key: "prof_name", label: "Professional Name", description: "Name of pro", sample: "Vikram Mehta" },
      { key: "client_name", label: "Client Name", description: "Client name", sample: "Sarah Jenkins" },
      { key: "project_title", label: "Project Title", description: "Project title", sample: "E-Commerce Web Portal" },
      { key: "issue_type", label: "Issue Type", description: "Dispute issue type", sample: "Delay & Incomplete Deliverables" },
      { key: "dispute_message", label: "Dispute Message", description: "Client statement", sample: "The required responsive layouts were not implemented as specified." },
      { key: "project_id", label: "Project ID", description: "Project ID", sample: "419" },
    ],
    sampleData: {
      prof_name: "Vikram Mehta",
      client_name: "Sarah Jenkins",
      project_title: "E-Commerce Web Portal",
      issue_type: "Delay & Incomplete Deliverables",
      dispute_message: "The required responsive layouts were not implemented as specified.",
      project_id: "419",
    },
  },

  // ==========================================
  // AUTH & TRANSACTIONAL TEMPLATES
  // ==========================================
  auth_email_verification: {
    key: "auth_email_verification",
    name: "Email Address Verification",
    description: "Sent upon registration or manual verification link request.",
    audience: "SYSTEM",
    category: "Account & Auth",
    defaultSubject: "Verify your email address for Klick-Pro",
    defaultHeading: "Confirm your Klick-Pro email address",
    defaultBodyText:
      "Hello {{user_name}},\n\nThank you for signing up with Klick-Pro! Please confirm your email address by clicking the button below.\n\nThis verification link is secure and will expire in 24 hours. If you did not create a Klick-Pro account, you can safely ignore this email.",
    defaultActionText: "Verify Email Address",
    defaultActionUrl: "/verify-email?token={{verification_token}}",
    variables: [
      { key: "user_name", label: "User Name", description: "Name of user", sample: "Alex Rivera" },
      { key: "verification_token", label: "Verification Token", description: "Secret token", sample: "sec_tok_91a03f4d8e" },
    ],
    sampleData: {
      user_name: "Alex Rivera",
      verification_token: "sec_tok_91a03f4d8e",
    },
  },

  auth_password_reset: {
    key: "auth_password_reset",
    name: "Password Reset Request",
    description: "Sent when a user requests to reset their password.",
    audience: "SYSTEM",
    category: "Account & Auth",
    defaultSubject: "Reset your Klick-Pro account password",
    defaultHeading: "Password Reset Request",
    defaultBodyText:
      "Hello {{user_name}},\n\nWe received a request to reset the password for your Klick-Pro account.\n\nClick the button below to choose a new password. This security link expires in 60 minutes.\n\nIf you did not request a password reset, please secure your account immediately or contact support.",
    defaultActionText: "Reset My Password",
    defaultActionUrl: "/reset-password?token={{reset_token}}",
    variables: [
      { key: "user_name", label: "User Name", description: "Name of user", sample: "Alex Rivera" },
      { key: "reset_token", label: "Reset Token", description: "Secret reset token", sample: "rst_8849bca01e" },
    ],
    sampleData: {
      user_name: "Alex Rivera",
      reset_token: "rst_8849bca01e",
    },
  },
};

