import { redirect } from "next/navigation";

export default function BriefingDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15+ async params — redirect to new route
  return redirect("/flows");
}
