// R2 static assets management routes

import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../../utils/middleware';

const r2 = new Hono<{ Bindings: Env }>();

// All routes require authentication
r2.use('/*', authMiddleware);

/**
 * POST /r2/upload
 * Upload a file to R2
 */
r2.post('/upload', async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string || '';

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const r2Bucket = c.env.STATIC_ASSETS;
    const fileName = path || file.name;
    const key = `users/${user.id}/${fileName}`;

    // Upload to R2
    await r2Bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      key,
      url: `/r2/download/${key}`,
    });
  } catch (error) {
    console.error('R2 upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

/**
 * GET /r2/download/:key
 * Download a file from R2
 */
r2.get('/download/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const r2Bucket = c.env.STATIC_ASSETS;

    const object = await r2Bucket.get(key);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Return file with appropriate headers
    const headers = new Headers();
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }
    headers.set('Content-Disposition', `inline; filename="${key.split('/').pop()}"`);

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('R2 download error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});

/**
 * DELETE /r2/:key
 * Delete a file from R2
 */
r2.delete('/:key', async (c) => {
  try {
    const user = c.get('user');
    const key = c.req.param('key');

    // Verify ownership (file should be under user's path)
    if (!key.startsWith(`users/${user.id}/`)) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const r2Bucket = c.env.STATIC_ASSETS;
    await r2Bucket.delete(key);

    return c.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('R2 delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

/**
 * GET /r2/list
 * List files for the current user
 */
r2.get('/list', async (c) => {
  try {
    const user = c.get('user');
    const r2Bucket = c.env.STATIC_ASSETS;

    const prefix = `users/${user.id}/`;
    const objects = await r2Bucket.list({ prefix });

    const files = objects.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
    }));

    return c.json({ files });
  } catch (error) {
    console.error('R2 list error:', error);
    return c.json({ error: 'List failed' }, 500);
  }
});

export default r2;

