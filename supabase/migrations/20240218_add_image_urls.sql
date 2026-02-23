-- Add image_urls column to tours table
ALTER TABLE tours ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Optional: Migrate existing single image to the array (if needed, but usually redundant if UI handles both)
-- UPDATE tours SET image_urls = ARRAY[image] WHERE image IS NOT NULL AND image_urls = '{}';
