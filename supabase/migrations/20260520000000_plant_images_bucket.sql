-- Create the plant-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-images', 'plant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload own plant images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'plant-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update/delete their own images
CREATE POLICY "Users can manage own plant images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'plant-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read of all plant images
CREATE POLICY "Plant images are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'plant-images');
