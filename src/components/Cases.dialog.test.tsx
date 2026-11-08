import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { CaseItem } from '@/content/types';
import raw from '../../content/cases.json';
// @ts-expect-error shared contract
import { adaptCase } from '../../content/cases-contract.mjs';
vi.mock('@/lib/i18n', () => ({ useLocale: () => ({ lang: 'en', copy: { cases: { heading: 'Cases' } } }) }));
vi.mock('./SectionNext', () => ({ SectionNext: () => null }));
import { Cases } from './Cases';
it('shows uniform cards, type-specific safe links and image error fallback', () => {
  const items: CaseItem[] = raw.cases.map(adaptCase);
  items[0] = { ...items[0], type: 'website', url: 'https://example.com', previewImageUrl: 'https://example.com/image.jpg' };
  items[1] = { ...items[1], type: 'bot', url: 'https://t.me/example' };
  items[2] = { ...items[2], type: 'ai', url: 'javascript:alert(1)' };
  const { container } = render(<Cases cases={items} />);
  expect(screen.getByRole('link', { name: 'Open website' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByRole('link', { name: 'Open bot' })).toHaveAttribute('href', 'https://t.me/example');
  expect(screen.queryByText('Open AI project')).not.toBeInTheDocument();
  expect(screen.queryByText(raw.cases[0].en.metric)).not.toBeInTheDocument();
  const image = container.querySelector('img')!; fireEvent.error(image); expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('.lucide-send')).not.toBeNull(); expect(container.querySelector('.lucide-sparkles')).not.toBeNull();
});
