import {
  BadgeCheck,
  BellRing,
  Briefcase,
  FileBarChart,
  FolderKanban,
  Home,
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  Search,
  Star,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { NavigationItem } from "@/components/AppNavigation";

export const clientItems: NavigationItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/discover", icon: Users, label: "Find pros" },
  { to: "/post-job", icon: PlusCircle, label: "Post a job" },
  { to: "/my-jobs", icon: FolderKanban, label: "Projects" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/earnings", icon: Wallet, label: "Earnings" },
  { to: "/verification", icon: BadgeCheck, label: "Verification" },
  { to: "/notifications", icon: BellRing, label: "Notifications" },
];

export const professionalItems: NavigationItem[] = [
  { to: "/professional/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/professional/my-jobs", icon: FolderKanban, label: "My Jobs" },
  { to: "/professional/running-projects", icon: Briefcase, label: "Running Projects" },
  { to: "/professional/reports", icon: FileBarChart, label: "Reports" },
  { to: "/professional/messages", icon: MessageSquare, label: "Messages" },
  { to: "/verification", icon: BadgeCheck, label: "Verification" },
  { to: "/professional/reviews", icon: Star, label: "Reviews" },
  { to: "/earnings", icon: Wallet, label: "Earnings" },
  { to: "/notifications", icon: BellRing, label: "Notifications" },
  { to: "/professional-profile?from=dashboard", icon: User, label: "Profile" },
];

export const clientMobileItems: NavigationItem[] = [
  { to: "/dashboard", icon: Home, label: "Home" },
  { to: "/discover", icon: Search, label: "Search" },
  { to: "/my-jobs", icon: Briefcase, label: "Jobs" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
];

export const professionalMobileItems: NavigationItem[] = [
  { to: "/professional/dashboard", icon: Home, label: "Home" },
  { to: "/professional/my-jobs", icon: Briefcase, label: "Jobs" },
  { to: "/professional/running-projects", icon: Briefcase, label: "Running" },
  { to: "/professional/reviews", icon: Star, label: "Reviews" },
  { to: "/professional/messages", icon: MessageSquare, label: "Messages" },
  { to: "/earnings", icon: Wallet, label: "Earnings" },
  { to: "/notifications", icon: BellRing, label: "Notifications" },
  { to: "/professional-profile?from=dashboard", icon: User, label: "Profile" },
];
