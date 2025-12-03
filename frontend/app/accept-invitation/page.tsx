'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { invitationsApi, setToken, ApiClientError } from '@/lib/api';
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

export default function AcceptInvitationPage() {
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
      const response = await invitationsApi.accept({
        token,
        password: data.password,
      });
      setToken(response.access_token);
      await refreshUser();
      router.push('/dashboard');
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
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">Weryfikowanie zaproszenia...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">Błąd</h1>
          <p className="text-muted-foreground">
            Nieprawidłowy link zaproszenia. Sprawdź, czy link jest kompletny.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Akceptuj zaproszenie</h1>
          <p className="mt-2 text-muted-foreground">
            Utwórz hasło, aby dołączyć do zespołu
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimum 8 znaków
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Tworzenie konta...' : 'Dołącz do zespołu'}
          </Button>
        </form>
      </div>
    </div>
  );
}

