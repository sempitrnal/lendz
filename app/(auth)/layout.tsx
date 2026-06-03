export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:mt-0 md:px-6">
      {children}
    </main>
  );
}
