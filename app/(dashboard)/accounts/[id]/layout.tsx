export default function AccountDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="-mx-4 md:-mx-10
        md:-ml-[calc(var(--sidebar-width)+1.5rem)]
        lg:-ml-[calc(var(--sidebar-width)+2.5rem)]"
    >
      {children}
    </div>
  );
}
