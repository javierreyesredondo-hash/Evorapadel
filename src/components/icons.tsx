import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconInicio(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Base>
  );
}

export function IconJugadores(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14a6.5 6.5 0 0 1 3 6" />
    </Base>
  );
}

export function IconEvaluaciones(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="3.5" width="14" height="18" rx="2" />
      <path d="M9 3.5h6v3H9z" />
      <path d="m9 13 2 2 4-4" />
    </Base>
  );
}

export function IconObjetivos(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </Base>
  );
}

export function IconFlecha(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  );
}

export function IconSube(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 14 6-6 6 6" />
    </Base>
  );
}

export function IconBaja(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 10 6 6 6-6" />
    </Base>
  );
}
