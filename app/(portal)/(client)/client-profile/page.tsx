import { redirect } from "next/navigation";

export default async function ClientProfilePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const query = new URLSearchParams();
  if (typeof searchParams?.profileSetup === "string") {
    query.set("profileSetup", searchParams.profileSetup);
  }
  if (typeof searchParams?.from === "string") {
    query.set("from", searchParams.from);
  }
  const qs = query.toString();
  redirect(`/client/setup${qs ? `?${qs}` : ""}`);
}
