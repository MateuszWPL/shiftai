import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur px-5 supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">ShiftAI</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/dashboard"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Panel
            </Link>
            <Link
              href="/dashboard/schedule"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Grafik
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Add search or other items here if needed */}
          </div>
          <nav className="flex items-center">
            {/* Add user menu or auth buttons here */}
          </nav>
        </div>
      </div>
    </nav>
  );
}
