/**
 * A template remounts on every navigation, so this plays a short fade each
 * time you move between pages. The green top bar lives above it (in the root
 * layout) and stays put, so only what's below it changes.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-fade">{children}</div>;
}
