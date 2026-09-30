import type { SVGProps } from 'react';
type IconName = 'chevron' | 'search' | 'copy' | 'expand' | 'collapse' | 'link' | 'close' | 'arrow';
const paths: Record<IconName, string> = {
  chevron: 'm9 5 7 7-7 7', search: 'm21 21-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M9 9h12v12H9z M15 9V3H3v12h6', expand: 'm7 10 5-5 5 5 M7 14l5 5 5-5',
  collapse: 'm7 5 5 5 5-5 M7 19l5-5 5 5', link: 'm10 13 4-4 M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  close: 'm6 6 12 12 M6 18 18 6', arrow: 'M4 12h16 m-6-6 6 6-6 6'
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
