import type { SVGProps } from "react";

type IconName = "search" | "user" | "heart" | "bag" | "menu" | "close" | "arrow" | "plus" | "minus" | "whatsapp" | "instagram" | "mail" | "chevron";
const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.4 3-5 7-5s6.3 1.6 7 5"/></>,
  heart: <path d="M20.8 8.9c0 4.4-8.8 10.1-8.8 10.1S3.2 13.3 3.2 8.9A4.2 4.2 0 0 1 11 6.6l1 1 1-1a4.2 4.2 0 0 1 7.8 2.3Z"/>,
  bag: <><path d="M4 8h16l-1 12H5L4 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  minus: <path d="M5 12h14"/>,
  whatsapp: <><path d="M20.2 11.6a8.2 8.2 0 0 1-12.1 7.2L4 20l1.2-3.9A8.2 8.2 0 1 1 20.2 11.6Z"/><path d="M8.5 8.2c.5 2.4 2.1 4.1 4.5 5l1.3-1.1 2 .9c-.2 1.3-.9 2-2.2 2.1-3.8-.4-6.5-3.4-6.7-6.6.1-1.1.8-1.8 1.7-1.9l.8 1.6-.9 1Z"/></>,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.7h.01"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  chevron: <path d="m6 9 6 6 6-6"/>
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
