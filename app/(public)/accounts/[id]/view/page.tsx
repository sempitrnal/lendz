import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import {
  buildPublicAccountView,
  describePublicAccount,
} from "@/lib/public-account";
import PublicAccountView from "@/components/public-account/public-account-view";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let data;
  try {
    data = await getAccountDetailPageData(id);
  } catch {
    return { title: "Loan Details | Utangz" };
  }

  const view = buildPublicAccountView(id, data);
  const typeLabel = view.accountType.replace("_", " ");
  const title = `${view.borrowerName} - ${typeLabel} | Utangz`;

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  return {
    title,
    description: describePublicAccount(view),
    metadataBase: new URL(`${protocol}://${host}`),
    openGraph: {
      title,
      description: describePublicAccount(view),
      type: "website",
      url: `/accounts/${id}/view`,
    },
    twitter: {
      card: "summary",
      title,
      description: describePublicAccount(view),
    },
  };
}

export default async function PublicAccountViewPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getAccountDetailPageData(id);
  } catch {
    notFound();
  }

  const view = buildPublicAccountView(id, data);

  return <PublicAccountView view={view} />;
}
