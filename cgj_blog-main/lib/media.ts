import 'server-only';

export type MediaAsset = {
  id: string;
  path: string;
  public_url: string;
  alt_text: string | null;
  content_type: string;
  byte_size: number;
  created_at: string;
};
