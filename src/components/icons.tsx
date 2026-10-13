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


export function IconGrupos(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 12h18" />
      <path d="M12 4v16" />
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



export function IconPdf(props: IconProps) {
  return (
    <Base width={18} height={18} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Base>
  );
}

export function IconCompartir(props: IconProps) {
  return (
    <Base width={18} height={18} {...props}>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
    </Base>
  );
}

export function IconDescargar(props: IconProps) {
  return (
    <Base width={18} height={18} {...props}>
      <path d="M12 3v12M8 11l4 4 4-4M4 19h16" />
    </Base>
  );
}
