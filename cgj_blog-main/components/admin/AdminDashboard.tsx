'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { BookOpen, Check, Eye, FileText, ImagePlus, Pencil, Plus, Save, Shield, Tags, Trash2, X } from 'lucide-react';
import { CGJLogo } from '@/components/CGJLogo';
import { SignOutButton } from '@/components/admin/SignOutButton';

type Taxonomy = { id: string; name: string; slug: string; description?: string | null };
type MediaAsset = { id: string; path: string; public_url: string; alt_text: string | null; content_type: string; byte_size: number; created_at: string };
type Post = { id: string; title: string; slug: string; excerpt: string | null; content: string; cover_image_url: string | null; cover_image_alt: string | null; category_id?: string | null; status: 'draft' | 'published'; featured: boolean; published_at: string | null; updated_at: string; category: Taxonomy | null; tags: Taxonomy[] };
type PostEditor = { title: string; slug: string; excerpt: string; content: string; cover_image_url: string; cover_image_alt: string; category_id: string | null; tag_ids: string[]; status: 'draft' | 'published'; featured: boolean };

const emptyPost: PostEditor = { title: '', slug: '', excerpt: '', content: '', cover_image_url: '', cover_image_alt: '', category_id: null, tag_ids: [], status: 'draft', featured: false };
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 401) window.location.assign('/admin/login');
  if (response.status === 403) window.location.assign('/admin/unauthorized');
  if (!response.ok) throw new Error(payload.error ?? 'The request could not be completed.');
  return payload;
}

export function AdminDashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [tags, setTags] = useState<Taxonomy[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [editor, setEditor] = useState<PostEditor>(emptyPost);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadWorkspace(); }, []);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [postData, taxonomyData, mediaData] = await Promise.all([
        readResponse(await fetch('/api/admin/posts', { cache: 'no-store' })) as Promise<{ posts: Post[] }>,
        readResponse(await fetch('/api/admin/taxonomy', { cache: 'no-store' })) as Promise<{ categories: Taxonomy[]; tags: Taxonomy[] }>,
        readResponse(await fetch('/api/admin/media', { cache: 'no-store' })) as Promise<{ media: MediaAsset[] }>,
      ]);
      setPosts(postData.posts);
      setCategories(taxonomyData.categories);
      setTags(taxonomyData.tags);
      setMedia(mediaData.media);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the editorial workspace.');
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return setMessage('Choose a PNG, JPG, WebP, or GIF image.');
    if (file.size > 5 * 1024 * 1024) return setMessage('Images must be 5 MB or smaller.');
    setUploading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const payload = await readResponse(await fetch('/api/admin/media', { method: 'POST', body: formData })) as { media: MediaAsset };
      setMedia((current) => [payload.media, ...current]);
      setEditor((current) => ({ ...current, cover_image_url: payload.media.public_url, cover_image_alt: current.cover_image_alt || payload.media.alt_text || '' }));
      setMessage('Image uploaded and selected for this article.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function editPost(post: Post) {
    setEditingId(post.id);
    setEditor({ title: post.title, slug: post.slug, excerpt: post.excerpt ?? '', content: post.content, cover_image_url: post.cover_image_url ?? '', cover_image_alt: post.cover_image_alt ?? '', category_id: post.category?.id ?? null, tag_ids: post.tags.map((tag) => tag.id), status: post.status, featured: post.featured });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetEditor() {
    setEditingId(null);
    setEditor(emptyPost);
  }

  async function savePost(event: FormEvent) {
    event.preventDefault();
    if (!editor.title || !editor.slug || !editor.content) return setMessage('Add a title, URL slug, and article content first.');
    setBusy(true);
    setMessage('');
    try {
      const payload = { ...editor, slug: slugify(editor.slug) };
      await readResponse(await fetch(editingId ? `/api/admin/posts/${editingId}` : '/api/admin/posts', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setMessage(editingId ? 'Article updated.' : 'Article created.');
      resetEditor();
      await loadWorkspace();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this article.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post: Post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await readResponse(await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' }));
      if (editingId === post.id) resetEditor();
      setMessage('Article deleted.');
      await loadWorkspace();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this article.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTaxonomy(kind: 'categories' | 'tags', item: Taxonomy, isNew = false) {
    const endpoint = isNew ? `/api/admin/${kind}` : `/api/admin/${kind}/${item.id}`;
    const body = kind === 'categories' ? { name: item.name, slug: item.slug, description: item.description ?? '' } : { name: item.name, slug: item.slug };
    await readResponse(await fetch(endpoint, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    await loadWorkspace();
  }

  async function addTaxonomy(kind: 'categories' | 'tags') {
    const name = window.prompt(`New ${kind === 'categories' ? 'category' : 'tag'} name:`)?.trim();
    if (!name) return;
    try {
      await saveTaxonomy(kind, { id: '', name, slug: slugify(name), description: '' }, true);
      setMessage(`${kind === 'categories' ? 'Category' : 'Tag'} created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create this item.');
    }
  }

  async function editTaxonomy(kind: 'categories' | 'tags', item: Taxonomy) {
    const name = window.prompt('Name:', item.name)?.trim();
    if (!name) return;
    const slug = window.prompt('URL slug:', item.slug)?.trim();
    if (!slug) return;
    const description = kind === 'categories' ? window.prompt('Description (optional):', item.description ?? '') ?? '' : undefined;
    try {
      await saveTaxonomy(kind, { ...item, name, slug: slugify(slug), description });
      setMessage(`${kind === 'categories' ? 'Category' : 'Tag'} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this item.');
    }
  }

  async function deleteTaxonomy(kind: 'categories' | 'tags', item: Taxonomy) {
    if (!window.confirm(`Delete “${item.name}”? Posts will keep their content; a deleted category is removed from posts and a deleted tag is unlinked.`)) return;
    try {
      await readResponse(await fetch(`/api/admin/${kind}/${item.id}`, { method: 'DELETE' }));
      setMessage(`${kind === 'categories' ? 'Category' : 'Tag'} deleted.`);
      await loadWorkspace();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this item.');
    }
  }

  async function deleteMedia(asset: MediaAsset) {
    if (!window.confirm('Delete this media item? Images used by an article cannot be deleted.')) return;
    try {
      await readResponse(await fetch(`/api/admin/media/${asset.id}`, { method: 'DELETE' }));
      setMedia((current) => current.filter((item) => item.id !== asset.id));
      setMessage('Media item deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this media item.');
    }
  }

  async function editMediaAlt(asset: MediaAsset) {
    const altText = window.prompt('Image description (alt text):', asset.alt_text ?? '');
    if (altText === null) return;
    try {
      const payload = await readResponse(await fetch(`/api/admin/media/${asset.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alt_text: altText }) })) as { media: MediaAsset };
      setMedia((current) => current.map((item) => item.id === asset.id ? payload.media : item));
      setMessage('Image description updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this image description.');
    }
  }

  return <main className="min-h-screen bg-[#f8f6f0]"><header className="border-b bg-[#fffdf8]"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><CGJLogo size="sm" /><b className="tracking-[.12em]">CGJ EDITORIAL</b></div><nav className="hidden gap-4 text-sm font-bold text-[#61707b] md:flex"><a href="#posts">Posts</a><a href="#taxonomy">Categories & tags</a><a href="#media">Media</a></nav><SignOutButton className="text-sm font-bold" /></div></header><div className="mx-auto max-w-7xl px-5 py-10"><p className="eyebrow text-[#ef765d]">Editorial workspace</p><h1 className="mt-3 font-display text-5xl text-[#10223c]">Manage the journal.</h1><p className="mt-3 text-[#61707b]">Create, organise, publish, and maintain CGJ journal content.</p><div className="my-9 grid gap-4 sm:grid-cols-3"><Stat icon={<BookOpen />} value={posts.length} label="All articles" /><Stat icon={<Check />} value={posts.filter((post) => post.status === 'published').length} label="Published" /><Stat icon={<FileText />} value={posts.filter((post) => post.status === 'draft').length} label="Drafts" /></div>{loading ? <p className="border bg-[#fffdf8] p-6 text-sm text-[#61707b]">Loading editorial content…</p> : <><div id="posts" className="grid gap-8 xl:grid-cols-[.9fr_1.1fr]"><section className="border bg-[#fffdf8] p-6"><div className="flex items-start justify-between"><div><p className="eyebrow text-[#ef765d]">{editingId ? 'Editing article' : 'New article'}</p><h2 className="mt-2 font-display text-3xl">{editingId ? 'Refine your story' : 'Write for the journal'}</h2></div>{editingId ? <button onClick={resetEditor} className="flex gap-1 text-sm font-bold"><X size={16} /> Cancel</button> : <Plus className="text-[#ef765d]" />}</div><form onSubmit={savePost} className="mt-6 space-y-4"><input required value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value, slug: editingId ? editor.slug : slugify(event.target.value) })} placeholder="Article title" className="w-full border-b-2 border-[#10223c] bg-transparent py-3 font-display text-2xl outline-none" /><input required value={editor.slug} onChange={(event) => setEditor({ ...editor, slug: slugify(event.target.value) })} placeholder="url-friendly-slug" className="w-full border-b bg-transparent py-3 text-sm outline-none" /><textarea value={editor.excerpt} onChange={(event) => setEditor({ ...editor, excerpt: event.target.value })} placeholder="Short summary for the journal listing" rows={3} className="w-full border bg-[#f8f6f0] p-3" /><textarea required value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} placeholder="Write the full article…" rows={12} className="w-full border bg-[#f8f6f0] p-3 leading-7" /><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Category<select value={editor.category_id ?? ''} onChange={(event) => setEditor({ ...editor, category_id: event.target.value || null })} className="mt-2 w-full border bg-white p-2 font-normal"><option value="">Uncategorised</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="text-sm font-bold">Tags<div className="mt-2 max-h-28 space-y-1 overflow-y-auto border bg-white p-2 font-normal">{tags.length ? tags.map((item) => <label key={item.id} className="flex items-center gap-2"><input type="checkbox" checked={editor.tag_ids.includes(item.id)} onChange={(event) => setEditor({ ...editor, tag_ids: event.target.checked ? [...editor.tag_ids, item.id] : editor.tag_ids.filter((id) => id !== item.id) })} /> {item.name}</label>) : <p className="text-xs text-[#61707b]">Create tags below to use them here.</p>}</div></div></div><div className="border bg-[#f8f6f0] p-4"><div className="flex items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><ImagePlus size={17} /> {uploading ? 'Uploading…' : 'Upload cover image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadImage} className="hidden" /></label><span className="text-xs text-[#61707b]">PNG, JPG, WebP, GIF · max 5 MB</span></div><input value={editor.cover_image_url} onChange={(event) => setEditor({ ...editor, cover_image_url: event.target.value })} placeholder="…or paste an image URL" className="mt-3 w-full border bg-white p-2 text-sm" /><input value={editor.cover_image_alt} onChange={(event) => setEditor({ ...editor, cover_image_alt: event.target.value })} placeholder="Image description (alt text)" className="mt-2 w-full border bg-white p-2 text-sm" />{editor.cover_image_url && <img src={editor.cover_image_url} alt={editor.cover_image_alt || 'Cover preview'} className="mt-3 aspect-video w-full object-cover" />}</div><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex gap-4"><select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as 'draft' | 'published' })} className="border bg-transparent p-2 text-sm"><option value="draft">Save as draft</option><option value="published">Publish now</option></select><label className="flex items-center gap-2 text-sm"><input checked={editor.featured} type="checkbox" onChange={(event) => setEditor({ ...editor, featured: event.target.checked })} /> Featured</label></div><button disabled={busy || uploading} className="flex items-center gap-2 bg-[#10223c] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save size={16} />{busy ? 'Saving…' : editingId ? 'Update article' : 'Create article'}</button></div></form>{message && <p className="mt-4 text-sm text-[#18727a]" role="status">{message}</p>}</section><section className="border bg-[#fffdf8] p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-[#18727a]">All journal articles</p><h2 className="mt-2 font-display text-3xl">Content library</h2></div><Shield className="text-[#18727a]" /></div><div className="mt-6 divide-y">{posts.length ? posts.map((post) => <article key={post.id} className="py-4 first:pt-0"><div className="flex gap-4"><div className="h-16 w-20 shrink-0 bg-[#e4f4f3]">{post.cover_image_url && <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-[#10223c]">{post.title}</h3><p className="mt-1 text-xs text-[#61707b]">/{post.slug} · {post.category?.name ?? 'Uncategorised'} · {new Date(post.updated_at).toLocaleDateString()}</p></div><span className={post.status === 'published' ? 'bg-[#e4f4f3] px-2 py-1 text-[10px] font-bold uppercase text-[#18727a]' : 'bg-[#fff4f0] px-2 py-1 text-[10px] font-bold uppercase text-[#ef765d]'}>{post.status}</span></div>{post.tags.length > 0 && <p className="mt-1 text-xs text-[#61707b]">{post.tags.map((tag) => `#${tag.name}`).join(' ')}</p>}<div className="mt-3 flex flex-wrap gap-3 text-sm font-bold"><a href={`/post/${post.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#18727a]"><Eye size={15} /> View</a><button onClick={() => editPost(post)} className="flex items-center gap-1"><Pencil size={15} /> Edit</button><button disabled={busy} onClick={() => void deletePost(post)} className="flex items-center gap-1 text-[#b94e3a]"><Trash2 size={15} /> Delete</button></div></div></div></article>) : <p className="py-10 text-sm text-[#61707b]">No articles yet. Create the first entry here.</p>}</div></section></div><section id="taxonomy" className="mt-8 grid gap-8 lg:grid-cols-2"><TaxonomyPanel title="Categories" items={categories} kind="categories" onAdd={addTaxonomy} onEdit={editTaxonomy} onDelete={deleteTaxonomy} /><TaxonomyPanel title="Tags" items={tags} kind="tags" onAdd={addTaxonomy} onEdit={editTaxonomy} onDelete={deleteTaxonomy} /></section><section id="media" className="mt-8 border bg-[#fffdf8] p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-[#ef765d]">Media library</p><h2 className="mt-2 font-display text-3xl">Reusable uploaded images</h2></div><ImagePlus className="text-[#ef765d]" /></div><p className="mt-2 text-sm text-[#61707b]">Select an image to use it in the post editor. Images currently used by a post cannot be deleted.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{media.map((asset) => <article key={asset.id} className="border bg-[#f8f6f0]"><img src={asset.public_url} alt={asset.alt_text || ''} className="aspect-video w-full object-cover" /><div className="p-3"><p className="truncate text-xs text-[#61707b]">{asset.alt_text || asset.path}</p><div className="mt-3 flex gap-3 text-xs font-bold"><button onClick={() => { setEditor((current) => ({ ...current, cover_image_url: asset.public_url, cover_image_alt: current.cover_image_alt || asset.alt_text || '' })); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[#18727a]">Use image</button><button onClick={() => void editMediaAlt(asset)}>Edit alt</button><button onClick={() => void deleteMedia(asset)} className="text-[#b94e3a]">Delete</button></div></div></article>)}{!media.length && <p className="text-sm text-[#61707b]">No tracked uploads yet. Upload a cover image above to add it here.</p>}</div></section></>}</div></main>;
}

function TaxonomyPanel({ title, items, kind, onAdd, onEdit, onDelete }: { title: string; items: Taxonomy[]; kind: 'categories' | 'tags'; onAdd: (kind: 'categories' | 'tags') => void; onEdit: (kind: 'categories' | 'tags', item: Taxonomy) => void; onDelete: (kind: 'categories' | 'tags', item: Taxonomy) => void }) {
  return <section className="border bg-[#fffdf8] p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-[#18727a]">Organisation</p><h2 className="mt-2 font-display text-3xl">{title}</h2></div><button onClick={() => onAdd(kind)} className="flex items-center gap-1 bg-[#10223c] px-3 py-2 text-sm font-bold text-white"><Plus size={15} /> Add</button></div><div className="mt-5 divide-y">{items.length ? items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-bold text-[#10223c]">{item.name}</p><p className="text-xs text-[#61707b]">/{item.slug}{item.description ? ` · ${item.description}` : ''}</p></div><div className="flex gap-3 text-sm font-bold"><button onClick={() => onEdit(kind, item)}>Edit</button><button onClick={() => void onDelete(kind, item)} className="text-[#b94e3a]">Delete</button></div></div>) : <p className="py-5 text-sm text-[#61707b]">No {title.toLowerCase()} yet.</p>}</div></section>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="border bg-[#fffdf8] p-5 text-[#10223c]"><span className="text-[#ef765d]">{icon}</span><p className="mt-4 text-3xl font-bold">{value}</p><p className="text-sm text-[#61707b]">{label}</p></div>;
}
