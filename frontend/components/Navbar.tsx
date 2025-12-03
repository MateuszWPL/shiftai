'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useState } from 'react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsLogoutDialogOpen(false);
  };

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur px-5 supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center mx-auto">
        <div className="mr-4 flex">
          <Link href={isAuthenticated ? (user?.role === 'employee' ? "/dashboard/employee" : "/dashboard") : "/"} className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Antigravity</span>
          </Link>
          {isAuthenticated && (
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {user?.role === 'employee' ? (
                <Link
                  href="/dashboard/employee"
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  Mój panel
                </Link>
              ) : (
                <>
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
                  <Link
                    href="/dashboard/team"
                    className="transition-colors hover:text-foreground/80 text-foreground/60"
                  >
                    Zespół
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Add search or other items here if needed */}
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline truncate max-w-[150px]">
                  {user?.full_name || user?.email}
                </span>
                <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLogoutDialogOpen(true)}
                    className="text-xs sm:text-sm whitespace-nowrap"
                  >
                    Wyloguj
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Wylogowanie</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Czy na pewno chcesz się wylogować?
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsLogoutDialogOpen(false)}
                        >
                          Anuluj
                        </Button>
                        <Button variant="destructive" onClick={handleLogout}>
                          Wyloguj
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Zaloguj się
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">
                    Zarejestruj się
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </nav>
  );
}
