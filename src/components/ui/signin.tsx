import { forwardRef, useId, useRef, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

export interface SignInButtonProps
  extends
    Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showIcon?: boolean;
  signInText?: string;
  signOutText?: string;
  loadingText?: string;
  asChild?: boolean;
}

type PasswordFlow = "signIn" | "signUp";

export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Entrar",
      signOutText = "Salir",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { signIn, signOut } = useAuthActions();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const [open, setOpen] = useState(false);
    const [flow, setFlow] = useState<PasswordFlow>("signIn");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const fieldId = useId();
    const signingUp = flow === "signUp";

    const changeOpen = (nextOpen: boolean) => {
      if (busy.current) return;
      setOpen(nextOpen);
      setError(null);
      setPassword("");
      if (nextOpen) setFlow("signIn");
    };

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || busy.current) return;
      if (!isAuthenticated) {
        changeOpen(true);
        return;
      }
      busy.current = true;
      setPending(true);
      try {
        await signOut();
      } catch {
        toast.error("No pudimos cerrar la sesión. Inténtalo de nuevo.");
      } finally {
        busy.current = false;
        setPending(false);
      }
    };

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy.current) return;
      const emailInput = event.currentTarget.elements.namedItem(
        "email",
      ) as HTMLInputElement;
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || emailInput.validity.typeMismatch) {
        setError("Escribe un correo electrónico válido.");
        emailInput.focus();
        return;
      }
      if (!password) {
        setError("Escribe tu contraseña.");
        return;
      }
      if (signingUp && password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }

      busy.current = true;
      setPending(true);
      setError(null);
      try {
        await signIn("password", {
          email: normalizedEmail,
          password,
          flow,
        });
        setOpen(false);
        setPassword("");
      } catch {
        setError(
          signingUp
            ? "No pudimos crear la cuenta. Revisa tus datos o inicia sesión si ya tienes una cuenta."
            : "No pudimos iniciar sesión. Revisa tu correo y contraseña.",
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    };

    const buttonLoading = pending || isLoading;
    const buttonText = buttonLoading
      ? (loadingText ?? (isAuthenticated ? "Saliendo..." : "Entrando..."))
      : isAuthenticated
        ? signOutText
        : signInText;

    return (
      <>
        <Button
          ref={ref}
          type="button"
          onClick={handleClick}
          disabled={disabled || buttonLoading}
          variant={variant}
          size={size}
          className={className}
          asChild={asChild}
          aria-busy={buttonLoading}
          {...props}
        >
          {showIcon &&
            (buttonLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : isAuthenticated ? (
              <LogOut className="size-4" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            ))}
          {buttonText}
        </Button>
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogContent
            className="sm:max-w-md"
            showCloseButton={!pending}
            onEscapeKeyDown={(event) => {
              if (pending) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {signingUp ? "Crear cuenta" : "Entrar a VISO"}
              </DialogTitle>
              <DialogDescription>
                {signingUp
                  ? "Guarda tu deck, tus estados y tus dispositivos en tu cuenta."
                  : "Usa tu correo y contraseña para abrir tu panel."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} noValidate aria-busy={pending}>
              <fieldset disabled={pending} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-email`}>Correo electrónico</Label>
                  <Input
                    id={`${fieldId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@correo.com"
                    required
                    maxLength={254}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-password`}>Contraseña</Label>
                  <Input
                    id={`${fieldId}-password`}
                    name="password"
                    type="password"
                    autoComplete={
                      signingUp ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={signingUp ? 8 : 1}
                    aria-describedby={
                      error
                        ? `${fieldId}-error`
                        : signingUp
                          ? `${fieldId}-password-help`
                          : undefined
                    }
                  />
                  {signingUp && (
                    <p
                      id={`${fieldId}-password-help`}
                      className="text-xs text-muted-foreground"
                    >
                      Usa al menos 8 caracteres.
                    </p>
                  )}
                </div>
                {error && (
                  <p
                    id={`${fieldId}-error`}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full">
                  {pending && (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {pending
                    ? signingUp
                      ? "Creando cuenta..."
                      : "Entrando..."
                    : signingUp
                      ? "Crear cuenta"
                      : "Entrar"}
                </Button>
              </fieldset>
            </form>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setFlow(signingUp ? "signIn" : "signUp");
                setPassword("");
                setError(null);
              }}
            >
              {signingUp ? "Ya tengo una cuenta" : "Crear una cuenta"}
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

SignInButton.displayName = "SignInButton";
