import { redirect } from 'next/navigation';

export default function EditPostPage() {
  redirect('/admin#posts');
}
