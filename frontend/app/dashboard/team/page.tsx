'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { invitationsApi, usersApi, ApiClientError, type User } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

const inviteSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  full_name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
});

type InviteForm = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, invitationsData] = await Promise.all([
        usersApi.getOrganizationUsers(),
        invitationsApi.list(),
      ]);
      setTeamMembers(usersData);
      setInvitations(invitationsData);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('Sesja wygasła. Zaloguj się ponownie.');
      } else {
        setError('Nie udało się załadować danych');
      }
    }
  };

  const onSubmit = async (data: InviteForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const newInvitation = await invitationsApi.create(data);
      setInvitations([newInvitation, ...invitations]);
      reset();
      setIsDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Wystąpił błąd podczas wysyłania zaproszenia';
        setError(errorMessage);
      } else {
        setError('Wystąpił nieoczekiwany błąd');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Oczekujące';
      case 'accepted':
        return 'Zaakceptowane';
      case 'expired':
        return 'Wygasłe';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600';
      case 'accepted':
        return 'text-green-600';
      case 'expired':
        return 'text-gray-600';
      default:
        return '';
    }
  };

  return (
    <AuthGuard>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Zarządzanie zespołem</h1>
          <p className="text-muted-foreground mt-2">
            Zarządzaj członkami zespołu z kontem (menedżerowie) i zaproszeniami. 
            <Link href="/dashboard/employees" className="text-primary hover:underline ml-1">
              Pracowników bez konta dodajesz tutaj
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Zaproś członka zespołu</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Zaproś członka zespołu</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Członkowie zespołu vs Pracownicy</p>
                  <p className="text-xs">
                    <strong>Członkowie zespołu</strong> (tutaj) - mają konto i mogą się logować do systemu (menedżerowie).
                    <br />
                    <strong>Pracownicy</strong> - dodajesz w sekcji "Pracownicy", nie mają konta, tylko są przypisani do zmian.
                  </p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Imię i nazwisko</Label>
                    <Input
                      id="full_name"
                      type="text"
                      placeholder="Adam Nowak"
                      {...register('full_name')}
                      disabled={isLoading}
                    />
                    {errors.full_name && (
                      <p className="text-sm text-destructive">{errors.full_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="adam@example.com"
                      {...register('email')}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Na ten adres zostanie wysłane zaproszenie z linkiem do rejestracji
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Members Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Członkowie zespołu</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rola</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Brak członków zespołu
                    </TableCell>
                  </TableRow>
                ) : (
                  teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name || 'Brak imienia'}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {member.role === 'owner' ? 'Właściciel' : 'Menedżer'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Invitations Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Zaproszenia</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead>Wygasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Brak zaproszeń
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <span className={getStatusColor(invitation.status)}>
                          {getStatusLabel(invitation.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.created_at).toLocaleDateString('pl-PL')}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expires_at).toLocaleDateString('pl-PL')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        </div>
      </div>
    </AuthGuard>
  );
}

