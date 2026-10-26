import { useState, type InputHTMLAttributes } from 'react';
import { Icon } from '@/presentation/components/ui/Icon';

/** Campo de contraseña con botón para verla u ocultarla (vistas de administración). */
export function PasswordInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const label = show ? 'Ocultar contraseña' : 'Ver contraseña';
  return (
    <span className="relative flex">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={`h-10 w-full rounded-lg border border-border-subtle bg-surface-container-lowest pr-10 pl-3 text-body-sm font-normal focus:ring-2 focus:ring-secondary focus:outline-none ${className}`}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); // suele ir dentro de un <label>: que no mueva el foco ni envíe nada
          setShow((v) => !v);
        }}
        aria-label={label}
        aria-pressed={show}
        title={label}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-muted hover:text-primary"
      >
        <Icon name={show ? 'visibility_off' : 'visibility'} className="text-[20px]" />
      </button>
    </span>
  );
}
