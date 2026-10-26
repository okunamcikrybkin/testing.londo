import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <>
      <Header user={user} />
      {children}
    </>
  );
}
