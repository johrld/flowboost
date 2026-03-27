import { redirect } from "next/navigation";

export default async function BriefingDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirect(`/flows/${id}`);
}
