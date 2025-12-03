'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { authApi, setToken, ApiClientError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const registerSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  password: z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków'),
  full_name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  organization_name: z.string().min(1, 'Nazwa zespołu jest wymagana'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.register(data);
      setToken(response.access_token);
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = typeof err.data.detail === 'string' 
          ? err.data.detail 
          : 'Wystąpił błąd podczas rejestracji';
        setError(errorMessage);
      } else {
        setError('Wystąpił nieoczekiwany błąd');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Załóż konto</h1>
          <p className="mt-2 text-muted-foreground">
            Utwórz konto menedżera i swój zespół
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Imię i nazwisko</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Jan Kowalski"
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
              placeholder="twoj@email.pl"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

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
            <Label htmlFor="organization_name">Nazwa zespołu (restauracji)</Label>
            <Input
              id="organization_name"
              type="text"
              placeholder="Restauracja XYZ"
              {...register('organization_name')}
              disabled={isLoading}
            />
            {errors.organization_name && (
              <p className="text-sm text-destructive">{errors.organization_name.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Tworzenie konta...' : 'Załóż konto'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Masz już konto? </span>
          <Link href="/login" className="text-primary hover:underline">
            Zaloguj się
          </Link>
        </div>
      </div>
    </div>
  );
}

