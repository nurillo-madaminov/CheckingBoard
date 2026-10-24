import { supabase } from './supabaseClient';

/**
 * EXTENSIONS: a manager publishes an extension build (.zip) with install steps,
 * and everyone in the team can download it on any computer.
 * Files live in the private 'extensions' storage bucket under <team_id>/;
 * downloads use short-lived signed links.
 */
const BUCKET = 'extensions';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function fetchExtensions() {
  const { data, error } = await supabase
    .from('extensions')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function publishExtension({ teamId, name, version = '', description = '', setupSteps = '', file }) {
  if (!file) throw new Error('Choose the extension file to upload');
  if (file.size > MAX_FILE_BYTES) throw new Error('The file is larger than 50 MB');

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${teamId}/${Date.now()}-${safeName}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/zip',
    upsert: false
  });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase
    .from('extensions')
    .insert([{
      name: name.trim(),
      version: version.trim(),
      description: description.trim(),
      setup_steps: setupSteps.trim(),
      file_path: path,
      file_name: file.name,
      file_size: file.size
    }])
    .select()
    .single();
  if (error) {
    // Don't leave an orphaned file behind
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data;
}

// A one-minute link that downloads the file under its original name
export async function getDownloadUrl(extension) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(extension.file_path, 60, { download: extension.file_name });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteExtension(extension) {
  const { error } = await supabase.from('extensions').delete().eq('id', extension.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([extension.file_path]);
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
