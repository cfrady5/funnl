import { redirect } from "next/navigation";

/** The demo experience is the THOY Lawncare full audit report. */
export default function DemoPage() {
  redirect("/reports/demo");
}
