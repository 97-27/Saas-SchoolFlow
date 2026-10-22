import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, jsonError } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Téléversement d'une photo de profil. Le navigateur n'a plus le droit d'écrire directement dans
 * le stockage Supabase : seul un utilisateur connecté peut téléverser, uniquement des images,
 * et uniquement dans le dossier de son établissement.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('error' in auth) return auth.error;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    if (value && typeof value !== 'string') file = value as File;
  } catch (e) {
    return jsonError('Fichier invalide.', 400);
  }
  if (!file) return jsonError('Aucun fichier reçu.', 400);
  if (!ALLOWED_TYPES.includes(file.type)) return jsonError('Format non autorisé (JPEG, PNG, WEBP ou GIF uniquement).', 415);
  if (file.size > MAX_BYTES) return jsonError('Image trop lourde (5 Mo maximum).', 413);

  // Nom de fichier imprévisible, sans reprendre le nom envoyé par le navigateur.
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${auth.slug}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage.from('avatars').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    console.warn('Upload avatar notice:', error.message);
    return jsonError('Échec du téléversement.', 502);
  }

  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
  return NextResponse.json({ success: true, url: data?.publicUrl || null });
}
