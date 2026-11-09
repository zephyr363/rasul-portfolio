import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import raw from '../../../content/cases.json';
// @ts-expect-error shared contract
import { adaptCase } from '../../../content/cases-contract.mjs';
const mocks = vi.hoisted(() => ({ getCases: vi.fn(), saveCases: vi.fn() }));
vi.mock('@/data/cases', () => ({ ...mocks, describeCasesError: (e: Error) => e.message }));
vi.mock('@/admin/lib/seed', () => ({ seedCasesIfEmpty: vi.fn() }));
import { CasesPage } from './CasesPage';
function render(page: ReactElement) {
  return rtlRender(<RouterProvider router={createMemoryRouter([{ path: '/', element: page }])} />);
}
beforeEach(() => { vi.clearAllMocks(); mocks.getCases.mockResolvedValue(raw.cases.map(adaptCase)); mocks.saveCases.mockResolvedValue(undefined); });
it('loads, edits the same multilingual structure and blocks duplicate saves', async () => {
  let resolve!: () => void;
  mocks.saveCases.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  render(<CasesPage />); expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
  await screen.findAllByText(raw.cases[0].ru.title);
  fireEvent.click(screen.getAllByText('Изменить')[0]);
  expect(screen.getByLabelText('Заголовок (RU)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('EN')); expect(screen.getByLabelText('Описание (EN)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Сохранить'));
  await waitFor(() => expect(mocks.saveCases).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Сохранение…' })).toBeDisabled();
  resolve(); await waitFor(() => expect(screen.queryByText('Редактор кейса')).not.toBeInTheDocument());
});
it('offers retry on loading failure', async () => {
  mocks.getCases.mockRejectedValueOnce(new Error('offline'));
  render(<CasesPage />); await screen.findByText('offline');
  fireEvent.click(screen.getByText('Повторить загрузку'));
  await screen.findAllByText(raw.cases[0].ru.title); expect(mocks.getCases).toHaveBeenCalledTimes(2);
});

it('confirms dirty cancellation once and preserves the draft when declined', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<CasesPage />);
  await screen.findAllByText(raw.cases[0].ru.title);
  fireEvent.click(screen.getAllByText('Изменить')[0]);
  fireEvent.change(screen.getByLabelText('Заголовок (RU)'), { target: { value: 'Changed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Заголовок (RU)')).toHaveValue('Changed');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(confirm).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(screen.queryByText('Редактор кейса')).not.toBeInTheDocument());
  confirm.mockRestore();
});

it('asks to delete a case in a modal instead of an inline block', async () => {
  render(<CasesPage />);
  await screen.findAllByText(raw.cases[0].ru.title);
  fireEvent.click(screen.getAllByText('Удалить')[0]);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Удалить кейс?');
  expect(dialog).toHaveTextContent(raw.cases[0].ru.title);
  expect(screen.queryByRole('group', { name: 'Подтверждение удаления' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление' }));
  await waitFor(() => expect(mocks.saveCases).toHaveBeenCalledTimes(1));
  const [next, removed] = mocks.saveCases.mock.calls[0];
  expect(next).toHaveLength(raw.cases.length - 1);
  expect(removed).toHaveLength(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
