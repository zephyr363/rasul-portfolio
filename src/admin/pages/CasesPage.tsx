import { useEffect, useRef, useState } from 'react';
import type { CaseItem, CaseLocale, Lang } from '@/content/types';
import { getCases, saveCases, describeCasesError } from '@/data/cases';
import { seedCasesIfEmpty } from '@/admin/lib/seed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChanges } from '@/admin/lib/navigation-protection';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// @ts-expect-error shared contract
import { validateCasesDoc } from '../../../content/cases-contract.mjs';

const LANGS: Lang[] = ['ru', 'kz', 'en'];
function savedFields(item: CaseItem) {
  return JSON.stringify([item.id.trim(), item.type, item.order, item.url?.trim() || '', item.previewImageUrl?.trim() || '', ...LANGS.map(lang => [item[lang].title.trim(), item[lang].subtitle.trim()])]);
}
function emptyCase(order: number): CaseItem {
  const locale = (): CaseLocale => ({ title: '', subtitle: '' });
  return { id: '', type: 'website', order, ru: locale(), kz: locale(), en: locale() };
}
export function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<CaseItem | null>(null);
  const [baseline, setBaseline] = useState('');
  const { confirmDiscard } = useUnsavedChanges({ dirty: !!draft && savedFields(draft) !== baseline, pending });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [deleting, setDeleting] = useState<CaseItem | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setLoadError('');
    void getCases({ forceRefresh: true }).then(list => { if (active) setCases(list); }).catch(err => { if (active) setLoadError(describeCasesError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  async function operation(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(''); setSaved(false);
    try { await action(); setSaved(true); } catch (err) { setError(describeCasesError(err)); }
    finally { lock.current = false; setPending(false); }
  }
  async function persist(next: CaseItem[], removed: CaseItem[] = []) {
    const ordered = next.map((item, i) => ({ ...item, order: i + 1 }));
    await saveCases(ordered, removed); setCases(ordered);
  }
  function edit(item: CaseItem | null) {
    const next = item ? structuredClone(item) : emptyCase(cases.length + 1);
    setBaseline(savedFields(next));
    setEditingId(item?.id ?? null); setDraft(next); setLang('ru'); setError('');
  }
  function closeEditor() {
    if (!pending && confirmDiscard()) setDraft(null);
  }
  function save() {
    if (!draft) return;
    const item = { ...draft, id: draft.id.trim(), ...Object.fromEntries(LANGS.map(l => [l, { ...draft[l], title: draft[l].title.trim(), subtitle: draft[l].subtitle.trim() }])) } as CaseItem;
    const next = editingId ? cases.map(c => c.id === editingId ? item : c) : [...cases, item];
    const validation = validateCasesDoc({ version: 2, cases: next });
    if (!validation.ok) { setError(`Проверьте поля: ${validation.errors.join(', ')}`); return; }
    void operation(async () => { await persist(next); setDraft(null); });
  }
  return <div aria-busy={pending}>
    <h1 className="text-display text-2xl font-bold">Кейсы</h1>
    <p className="mt-2 text-sm text-muted">Единая структура карточек: тип, заголовок и описание на трёх языках.</p>
    <Button className="mt-4" disabled={loading || !!loadError || pending} onClick={() => edit(null)}>Добавить кейс</Button>
    {loading && <LoadingScreen label="Загрузка кейсов…" />}
    {loadError && <div role="alert"><p>{loadError}</p><Button onClick={() => setReload(v => v + 1)}>Повторить загрузку</Button></div>}
    {pending && <p role="status">Сохранение…</p>}
    {saved && <p role="status">Сохранено</p>}
    {error && <p role="alert" className="my-3 text-destructive">{error}</p>}
    {!loading && !loadError && !cases.length && <div className="mt-5"><p>Кейсов пока нет.</p><Button disabled={pending} onClick={() => void operation(async () => { await seedCasesIfEmpty(); setReload(v => v + 1); })}>Импортировать шаблон</Button></div>}
    <ul className="mt-5 space-y-3">{cases.map((item, index) => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
      <span className="min-w-0 flex-1">{item.ru.title}</span>
      {([-1, 1] as const).map(dir => <Button key={dir} variant="outline" aria-label={`${dir < 0 ? 'Выше' : 'Ниже'}: ${item.ru.title}`} disabled={pending || index + dir < 0 || index + dir >= cases.length} onClick={() => void operation(async () => { const next = [...cases]; [next[index], next[index + dir]] = [next[index + dir], next[index]]; await persist(next); })}>{dir < 0 ? '↑' : '↓'}</Button>)}
      <Button disabled={pending} variant="outline" onClick={() => edit(item)}>Изменить</Button>
      <Button disabled={pending} variant="outline" onClick={() => { setDeleting(item); setError(''); }}>Удалить</Button>
    </li>)}</ul>
    <Dialog open={deleting != null} onOpenChange={open => { if (!open && !pending) setDeleting(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить кейс?</DialogTitle>
          <DialogDescription>Кейс «{deleting?.ru.title}» будет удалён безвозвратно.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>Отмена</Button>
          <Button variant="destructive" disabled={pending} onClick={() => { const target = deleting; if (!target) return; void operation(async () => { await persist(cases.filter(c => c.id !== target.id), [target]); setDeleting(null); }); }}>{pending ? 'Удаляем…' : 'Подтвердить удаление'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Sheet open={!!draft} onOpenChange={open => { if (!open) closeEditor(); }}>
      <SheetContent className="overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>Редактор кейса</SheetTitle><SheetDescription>Заполните заголовок и описание на RU, KZ и EN. Ссылки необязательны, только HTTPS.</SheetDescription></SheetHeader>
        {draft && <fieldset disabled={pending} className="space-y-4 px-4 pb-6 [&_input]:min-h-11 sm:[&_input]:min-h-0">
          <div><label htmlFor="case-id">ID</label><Input id="case-id" disabled={!!editingId} value={draft.id} maxLength={64} onChange={e => setDraft({ ...draft, id: e.target.value })} /></div>
          <div><label htmlFor="case-type">Тип</label><select id="case-type" className="min-h-11 sm:min-h-0 w-full rounded-md border border-border bg-bg p-2" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as CaseItem['type'] })}><option value="website">Сайт</option><option value="bot">Telegram-бот</option><option value="ai">ИИ-проект</option></select></div>
          <div><label htmlFor="case-url">Ссылка на проект (HTTPS)</label><Input id="case-url" type="url" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value.trim() })} /></div>
          <div><label htmlFor="case-preview">URL изображения превью (HTTPS)</label><Input id="case-preview" type="url" aria-describedby="preview-help" value={draft.previewImageUrl ?? ''} onChange={e => setDraft({ ...draft, previewImageUrl: e.target.value.trim() })} /><p id="preview-help" className="text-sm text-muted">Для сайта укажите прямую ссылку на изображение вручную. Автоматическое чтение OG-метаданных ограничено CORS. При ошибке будет показана иконка.</p></div>
          <div className="flex gap-2" role="group" aria-label="Язык кейса">{LANGS.map(l => <Button key={l} variant={lang === l ? 'default' : 'outline'} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</Button>)}</div>
          <div><label htmlFor="case-title">Заголовок ({lang.toUpperCase()})</label><Input id="case-title" value={draft[lang].title} maxLength={1000} onChange={e => setDraft({ ...draft, [lang]: { ...draft[lang], title: e.target.value } })} /></div>
          <div><label htmlFor="case-subtitle">Описание ({lang.toUpperCase()})</label><Textarea id="case-subtitle" value={draft[lang].subtitle} maxLength={1000} onChange={e => setDraft({ ...draft, [lang]: { ...draft[lang], subtitle: e.target.value } })} /></div>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button onClick={save} disabled={pending}>{pending ? 'Сохранение…' : 'Сохранить'}</Button>
          <Button variant="outline" onClick={closeEditor} disabled={pending}>Отмена</Button>
        </fieldset>}
      </SheetContent>
    </Sheet>
  </div>;
}
import { LoadingScreen } from "@/components/LoadingScreen";
