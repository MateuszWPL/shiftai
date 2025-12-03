'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { employeesApi, setToken, ApiClientError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const acceptSchema = z.object({
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków'),
  confirmPassword: z.string().min(8, 'Potwierdzenie hasła jest wymagane'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła nie są identyczne',
  path: ['confirmPassword'],
});

type AcceptForm = z.infer<typeof acceptSchema>;

export default function AcceptEmployeeInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = searchParams.get('token');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
  });

  useEffect(() => {
    if (!token) {
      setError('Brak tokenu zaproszenia w adresie URL');
      setIsValidating(false);
    } else {
      setIsValidating(false);
    }
  }, [token]);

  const onSubmit = async (data: AcceptForm) => {
    if (!token) {
      setError('Brak tokenu zaproszenia');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await employeesApi.acceptInvitation({
        token,
        password: data.password,
      });
      
      // Set token and update user
      setToken(response.access_token);
      await refreshUser();
      
      // Redirect to employee dashboard
      router.push('/dashboard/employee');
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Wystąpił błąd podczas akceptacji zaproszenia';
        setError(errorMessage);
      } else {
        setError('Wystąpił nieoczekiwany błąd');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Weryfikowanie zaproszenia...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-center">Nieprawidłowe zaproszenie</h1>
          <p className="text-center text-muted-foreground">
            Brak tokenu zaproszenia w adresie URL. Sprawdź link, który otrzymałeś w emailu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Ustaw hasło</h1>
          <p className="text-muted-foreground">
            Zostałeś zaproszony jako pracownik. Ustaw hasło, aby uzyskać dostęp do swojego panelu.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 znaków"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Powtórz hasło"
              {...register('confirmPassword')}
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Tworzenie konta...' : 'Utwórz konto i zaloguj się'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          <p>W swoim panelu będziesz mógł:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Przeglądać swój grafik pracy</li>
            <li>Zarządzać swoją dyspozycyjnością</li>
            <li>Proponować zamiany zmian</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

